import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

const MAX_CONCURRENT_JOBS = 2;

// Versionamento de IA (Camada 5)
const MODEL_VERSION = "idm-vton-v1";
const PROMPT_VERSION = "v2";
const RENDER_PIPELINE_VERSION = "v1";

// Camada 4: Result Caching L1 (RAM)
// Cache de ativos concluídos (prompt_hash -> generated_url) com TTL de 10 minutos
const AssetL1Cache = new Map<string, { url: string; expiresAt: number }>();

// Cache de status de jobs (job_id -> status & progress) com TTL curto (1.5s) para polling
const JobL1Cache = new Map<string, {
    status: string;
    progress?: number;
    generated_url?: string;
    error?: string;
    queue_position?: number;
    message?: string;
    expiresAt: number;
}>();

function resolveCategory(categoryName?: string): string {
    if (!categoryName) return "top";
    const name = categoryName.toLowerCase();
    if (name.includes("calça") || name.includes("calca") || name.includes("short") || name.includes("bermuda") || name.includes("saia") || name.includes("bottom")) {
        return "bottom";
    }
    if (name.includes("vestido") || name.includes("macacão") || name.includes("macacao") || name.includes("one-piece") || name.includes("body")) {
        return "one-piece";
    }
    return "top";
}

function getAssetL1(hash: string): string | null {
    const cached = AssetL1Cache.get(hash);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
        AssetL1Cache.remove(hash);
        return null;
    }
    return cached.url;
}

function setAssetL1(hash: string, url: string) {
    AssetL1Cache.set(hash, {
        url,
        expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutos
    });
}

function getJobL1(jobId: string) {
    const cached = JobL1Cache.get(jobId);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
        JobL1Cache.delete(jobId);
        return null;
    }
    return cached;
}

function setJobL1(jobId: string, data: any, ttlMs = 1500) {
    JobL1Cache.set(jobId, {
        ...data,
        expiresAt: Date.now() + ttlMs
    });
}

async function generateHash(data: string) {
    const encoder = new TextEncoder();
    const raw = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", raw);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getBase64FromUrl(url: string): Promise<{ mimeType: string; data: string } | null> {
    try {
        if (!url) return null;
        if (url.startsWith("data:image")) {
            const parts = url.split(";base64,");
            const mimeType = parts[0].split(":")[1];
            const data = parts[1];
            return { mimeType, data };
        }
        if (url.includes("placehold.co") || url.startsWith("/")) {
            return null;
        }
        const res = await fetch(url);
        if (!res.ok) return null;
        const contentType = res.headers.get("content-type") || "image/jpeg";
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const data = btoa(binary);
        return { mimeType: contentType, data };
    } catch (e) {
        console.error("Error fetching base64 from url:", url, e);
        return null;
    }
}

async function describeGarmentOrPerson(url: string, prompt: string, apiKey: string): Promise<string | null> {
    const imageData = await getBase64FromUrl(url);
    if (!imageData) return null;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: imageData.mimeType,
                                data: imageData.data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    maxOutputTokens: 100
                }
            })
        });

        if (!res.ok) {
            console.error("Gemini description failed with status:", res.status);
            return null;
        }

        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        return text ? text.trim() : null;
    } catch (e) {
        console.error("Error calling Gemini Flash:", e);
        return null;
    }
}

async function uploadGeneratedImage(supabase: any, base64Bytes: string): Promise<string> {
    const binaryString = atob(base64Bytes);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const fileName = `generated/${crypto.randomUUID()}.jpg`;
    
    const { error } = await supabase.storage
        .from("product-images")
        .upload(fileName, bytes, {
            contentType: "image/jpeg",
            upsert: true
        });
        
    if (error) {
        throw new Error(`Storage upload error: ${error.message}`);
    }
    
    const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);
        
    return publicUrl;
}

async function incrementCacheHits(supabase: any, tenantId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0,0,0,0);
    const endOfMonth = new Date(startOfMonth);
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);

    try {
        await supabase.rpc("execute_sql", {
            query: `
                INSERT INTO public.tenant_usage (tenant_id, billing_period_start, billing_period_end, cache_hits)
                VALUES ('${tenantId}', '${startOfMonth.toISOString()}', '${endOfMonth.toISOString()}', 1)
                ON CONFLICT (tenant_id, billing_period_start, billing_period_end)
                DO UPDATE SET cache_hits = tenant_usage.cache_hits + 1, updated_at = now();
            `
        });
    } catch (err) {
        console.error("Error updating cache hit usage:", err);
    }
}

async function startJobProcessing(supabase: any, asset: any) {
    const inputParams = asset.input_parameters || {};
    const variantIds = inputParams.variant_ids || [];
    const stepIndex = inputParams.step_index || 0;
    const currentVariantId = variantIds[stepIndex] || inputParams.variant_id;
    const userProfile = inputParams.user_profile;

    if (!currentVariantId) {
        console.error("Erro startJobProcessing: nenhum variant_id encontrado.");
        return;
    }

    if (GEMINI_API_KEY) {
        try {
            console.log(`Starting Imagen 3 processing loop for asset ${asset.id}`);
            let currentHumanImage = userProfile.photo_url;
            const newStepOutputs: string[] = [];

            for (let i = 0; i < variantIds.length; i++) {
                const vid = variantIds[i];
                // Resolve variant details
                const { data: vRow } = await supabase
                    .from("product_variants")
                    .select(`
                        id,
                        variant_image_url,
                        color,
                        size,
                        products (
                            image_url,
                            product_categories (
                                name
                            )
                        )
                    `)
                    .eq("id", vid)
                    .single();

                if (!vRow) {
                    throw new Error(`Variant ${vid} not found`);
                }

                const productImages = vRow.products?.image_url ? vRow.products.image_url.split(",") : [];
                const garmentImageResolved = vRow.variant_image_url || productImages[0];
                const categoryResolved = resolveCategory(vRow.products?.product_categories?.name);
                const colorResolved = vRow.color || "";
                const sizeResolved = vRow.size || "";

                const [garmentData, humanData] = await Promise.all([
                    getBase64FromUrl(garmentImageResolved),
                    getBase64FromUrl(currentHumanImage)
                ]);

                if (!garmentData || !humanData) {
                    throw new Error("Não foi possível carregar as imagens de entrada para o provador virtual.");
                }

                const promptText = `A virtual try-on of the garment on the person. Fit the garment from the second image onto the person in the first image, maintaining the person's pose, facial features, body shape, and hair. High quality, photorealistic, solid light grey background, soft studio lighting, sharp focus, detailed fabric textures, 8k. 3:4 aspect ratio.`;

                console.log(`Calling gemini-3.1-flash-image for step ${i + 1}/${variantIds.length} with multimodal input`);

                const imagenResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${GEMINI_API_KEY}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: promptText },
                                {
                                    inlineData: {
                                        mimeType: humanData.mimeType,
                                        data: humanData.data
                                    }
                                },
                                {
                                    inlineData: {
                                        mimeType: garmentData.mimeType,
                                        data: garmentData.data
                                    }
                                }
                            ]
                        }]
                    })
                });

                if (!imagenResponse.ok) {
                    const errTxt = await imagenResponse.text();
                    let errMsg = errTxt;
                    try {
                        const parsed = JSON.parse(errTxt);
                        if (parsed.error?.message) {
                            errMsg = parsed.error.message;
                        }
                    } catch (_) {}
                    throw new Error(`Imagen API error: ${errMsg}`);
                }

                const imagenJson = await imagenResponse.json();
                const base64Bytes = imagenJson.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
                if (!base64Bytes) {
                    throw new Error("No image bytes returned from Gemini Image API");
                }

                const stepUrl = await uploadGeneratedImage(supabase, base64Bytes);
                console.log(`Step ${i + 1} completed: ${stepUrl}`);
                
                newStepOutputs.push(stepUrl);
                currentHumanImage = stepUrl; // Use as input for next step
            }

            const finalUrl = newStepOutputs[newStepOutputs.length - 1];

            // Update database to completed
            await supabase
                .from("ai_generated_assets")
                .update({
                    status: "completed",
                    generated_url: finalUrl,
                    input_parameters: {
                        ...inputParams,
                        step_index: variantIds.length,
                        step_outputs: newStepOutputs
                    }
                })
                .eq("id", asset.id);

            await supabase
                .from("ai_tryon_sessions")
                .update({ status: "completed", updated_at: new Date().toISOString() })
                .eq("asset_id", asset.id);

            // Activate next pending job
            await activateNextPendingJob(supabase);

            return; // Success
        } catch (err: any) {
            console.error("Error in Imagen 3 processing loop:", err);
            
            // Mark the asset as failed in the database
            await supabase
                .from("ai_generated_assets")
                .update({
                    status: "failed",
                    error_message: err.message || "Erro na geração do Imagen 3"
                })
                .eq("id", asset.id);

            await supabase
                .from("ai_tryon_sessions")
                .update({ status: "failed", updated_at: new Date().toISOString() })
                .eq("asset_id", asset.id);

            // Activate next pending job
            await activateNextPendingJob(supabase);
            return;
        }
    }

    // FALLBACK FLOW (Replicate / Mock)
    let replicateId = "";
    // Resolve variant details from DB
    const { data: variant } = await supabase
        .from("product_variants")
        .select(`
            id,
            variant_image_url,
            color,
            size,
            products (
                image_url,
                product_categories (
                    name
                )
            )
        `)
        .eq("id", currentVariantId)
        .single();

    if (!variant) {
        console.error(`Erro: Variante ${currentVariantId} não encontrada no banco.`);
        return;
    }

    const parentProduct = variant.products as any;
    const productImages = parentProduct?.image_url ? parentProduct.image_url.split(",") : [];
    const garmentImageResolved = variant.variant_image_url || productImages[0];
    const categoryResolved = resolveCategory(parentProduct?.product_categories?.name);
    const colorResolved = variant.color || "";
    const sizeResolved = variant.size || "";

    // A imagem humana de entrada:
    // Se for o primeiro passo, usa a foto original.
    // Se for um passo seguinte, usa o resultado do passo anterior.
    let humanImageInput = userProfile.photo_url;
    if (stepIndex > 0 && inputParams.step_outputs && inputParams.step_outputs[stepIndex - 1]) {
        humanImageInput = inputParams.step_outputs[stepIndex - 1];
    }

    if (REPLICATE_API_TOKEN) {
        try {
            const categoryMapping = categoryResolved === "one-piece" ? "dress" : (categoryResolved === "bottom" ? "lower_body" : "upper_body");
            const response = await fetch("https://api.replicate.com/v1/predictions", {
                method: "POST",
                headers: {
                    "Authorization": `Token ${REPLICATE_API_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    version: "da995c03c990b7df3c530fd66a4da9cb22718e8d89582d22edec3dbb3cd91959",
                    input: {
                        crop: true,
                        steps: 30,
                        category: categoryMapping,
                        garm_img: garmentImageResolved,
                        human_img: humanImageInput,
                        garment_des: `Peça de tamanho ${sizeResolved} e cor ${colorResolved}`,
                        force_dc: false,
                        seed: 42
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Erro Replicate API: ${errText}`);
            }

            const prediction = await response.json();
            replicateId = prediction.id;
        } catch (err: any) {
            console.error("Erro ao invocar Replicate na fila, ativando fallback:", err);
            replicateId = `mock_${Date.now()}`;
        }
    } else {
        console.log("REPLICATE_API_TOKEN ausente. Ativando modo de simulação/mock.");
        replicateId = `mock_${Date.now()}`;
    }

    // Atualiza o asset na base de dados
    const updatedInputParams = {
        ...inputParams,
        replicate_id: replicateId,
        step_index: stepIndex,
        step_outputs: inputParams.step_outputs || []
    };

    await supabase
        .from("ai_generated_assets")
        .update({
            status: "processing",
            created_at: new Date().toISOString(), // reseta timestamp para o mock
            input_parameters: updatedInputParams
        })
        .eq("id", asset.id);

    // Atualiza a sessão de provador (se existir)
    await supabase
        .from("ai_tryon_sessions")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("asset_id", asset.id);
}

async function activateNextPendingJob(supabase: any) {
    try {
        const { count: activeCount } = await supabase
            .from("ai_generated_assets")
            .select("*", { count: "exact", head: true })
            .eq("status", "processing")
            .gt("created_at", new Date(Date.now() - 120 * 1000).toISOString());

        if ((activeCount || 0) < MAX_CONCURRENT_JOBS) {
            const { data: pendingJobs } = await supabase
                .from("ai_generated_assets")
                .select("*")
                .eq("status", "pending")
                .order("created_at", { ascending: true })
                .limit(5);

            if (pendingJobs && pendingJobs.length > 0) {
                // Prioriza usuários logados ('high') > visitantes ('normal') > prefetch ('low')
                const priorityOrder: Record<string, number> = { high: 1, normal: 2, low: 3 };
                
                pendingJobs.sort((a: any, b: any) => {
                    const aPri = priorityOrder[a.input_parameters?.priority] || 2;
                    const bPri = priorityOrder[b.input_parameters?.priority] || 2;
                    if (aPri !== bPri) return aPri - bPri;
                    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                });

                const nextJob = pendingJobs[0];
                console.log(`Fila Cooperativa: Ativando job ${nextJob.id} com prioridade ${nextJob.input_parameters?.priority}`);
                await startJobProcessing(supabase, nextJob);
            }
        }
    } catch (err) {
        console.error("Erro na fila cooperativa:", err);
    }
}

serve(async (req) => {
    // CORS Preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
        
        // Roteamento RESTful por Pathname
        const url = new URL(req.url);
        const segments = url.pathname.split("/").filter(Boolean);
        const actionIndex = segments.indexOf("generate-tryon");
        
        let action = "";
        let param = "";
        
        if (actionIndex !== -1 && actionIndex < segments.length - 1) {
            action = segments[actionIndex + 1];
            if (actionIndex < segments.length - 2) {
                param = segments[actionIndex + 2];
            }
        }

        // Tentar autenticar o usuário através do JWT enviado
        let userId: string | null = null;
        const authHeader = req.headers.get("Authorization");
        if (authHeader) {
            const token = authHeader.replace("Bearer ", "");
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                userId = user.id;
            }
        }

        // ROTA 1: GET /cache/:cache_key OU GET /cache/hit?key=<cache_key>
        if (action === "cache" && req.method === "GET") {
            const cacheKey = param === "hit" ? url.searchParams.get("key") : param;
            if (!cacheKey) {
                return new Response(
                    JSON.stringify({ error: "cache_key/key ausente" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // 1. Checa L1 RAM cache
            const l1AssetUrl = getAssetL1(cacheKey);
            if (l1AssetUrl) {
                return new Response(
                    JSON.stringify({ status: "completed", generated_url: l1AssetUrl, source: "L1" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // 2. Checa L2 Database cache
            const { data: cachedAsset } = await supabase
                .from("ai_generated_assets")
                .select("*")
                .eq("prompt_hash", cacheKey)
                .maybeSingle();

            if (cachedAsset) {
                if (cachedAsset.status === "completed") {
                    setAssetL1(cacheKey, cachedAsset.generated_url);
                    return new Response(
                        JSON.stringify({ status: "completed", generated_url: cachedAsset.generated_url, source: "L2" }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                } else {
                    return new Response(
                        JSON.stringify({ status: "processing", job_id: cachedAsset.id }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            return new Response(
                JSON.stringify({ status: "miss" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
            );
        }

        // ROTA 2: GET /status/:job_id
        if (action === "status" && req.method === "GET") {
            const jobId = param;
            if (!jobId) {
                return new Response(
                    JSON.stringify({ error: "job_id ausente" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // 1. Checa L1 RAM Cache (TTL curto para Polling)
            const cachedJob = getJobL1(jobId);
            if (cachedJob) {
                return new Response(
                    JSON.stringify({
                        status: cachedJob.status,
                        progress: cachedJob.progress,
                        generated_url: cachedJob.generated_url,
                        error: cachedJob.error,
                        queue_position: cachedJob.queue_position,
                        message: cachedJob.message,
                        source: "L1"
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // 2. Checa L2 DB
            const { data: asset, error: fetchError } = await supabase
                .from("ai_generated_assets")
                .select("*")
                .eq("id", jobId)
                .single();

            if (fetchError || !asset) {
                return new Response(
                    JSON.stringify({ error: "Job não encontrado" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
                );
            }

            // Se concluído ou falhou, cacheia em L1 por 10 minutos e retorna
            if (asset.status === "completed" || asset.status === "failed") {
                setJobL1(jobId, {
                    status: asset.status,
                    generated_url: asset.generated_url,
                    error: asset.error_message
                }, 10 * 60 * 1000);

                if (asset.status === "completed" && asset.prompt_hash) {
                    setAssetL1(asset.prompt_hash, asset.generated_url);
                }

                // Ativa o próximo pendente na fila
                await activateNextPendingJob(supabase);
                
                return new Response(
                    JSON.stringify({ 
                        status: asset.status, 
                        generated_url: asset.generated_url,
                        error: asset.error_message,
                        source: "L2"
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Se está na fila (pending)
            if (asset.status === "pending") {
                // Checa capacidade para auto-ativar
                const { count: activeCount } = await supabase
                    .from("ai_generated_assets")
                    .select("*", { count: "exact", head: true })
                    .eq("status", "processing")
                    .gt("created_at", new Date(Date.now() - 120 * 1000).toISOString());

                if ((activeCount || 0) < MAX_CONCURRENT_JOBS) {
                    console.log(`Auto-ativação: Ativando job ${asset.id} pendente durante o polling.`);
                    await startJobProcessing(supabase, asset);
                    setJobL1(jobId, { status: "processing", progress: 0 }, 1500);
                    return new Response(
                        JSON.stringify({ status: "processing", progress: 0 }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Calcula a posição na fila
                const { count: queuePos } = await supabase
                    .from("ai_generated_assets")
                    .select("*", { count: "exact", head: true })
                    .eq("status", "pending")
                    .lt("created_at", asset.created_at);

                const pos = (queuePos || 0) + 1;
                setJobL1(jobId, { status: "pending", queue_position: pos }, 1500);

                return new Response(
                    JSON.stringify({ status: "pending", queue_position: pos, source: "L2" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // Se está processando
            const inputParams = asset.input_parameters || {};
            const variantIds = inputParams.variant_ids || (inputParams.variant_id ? [inputParams.variant_id] : []);
            const stepIndex = inputParams.step_index || 0;
            const stepOutputs = inputParams.step_outputs || [];
            const replicateId = inputParams.replicate_id;

            if (replicateId && replicateId.startsWith("mock_")) {
                const elapsed = (Date.now() - new Date(asset.created_at).getTime()) / 1000;
                const secondsPerStep = 8;
                
                if (elapsed >= secondsPerStep) {
                    const currentVariantId = variantIds[stepIndex];
                    const { data: vRow } = await supabase
                        .from("product_variants")
                        .select(`
                            id,
                            variant_image_url,
                            products (image_url)
                        `)
                        .eq("id", currentVariantId)
                        .single();
                    
                    const productImages = vRow?.products?.image_url ? vRow.products.image_url.split(",") : [];
                    const vImage = vRow?.variant_image_url || productImages[0] || "https://placehold.co/400x500?text=Mock+Step+Image";
                    const newStepOutputs = [...stepOutputs, vImage];
                    const nextStepIndex = stepIndex + 1;

                    if (nextStepIndex < variantIds.length) {
                        const mockId = `mock_${Date.now()}`;
                        const updatedInputParams = {
                            ...inputParams,
                            replicate_id: mockId,
                            step_index: nextStepIndex,
                            step_outputs: newStepOutputs
                        };

                        await supabase
                            .from("ai_generated_assets")
                            .update({
                                created_at: new Date().toISOString(), // reset time
                                input_parameters: updatedInputParams
                            })
                            .eq("id", asset.id);

                        const progress = Math.round((nextStepIndex / variantIds.length) * 100);
                        const msg = `Vestindo peça ${nextStepIndex + 1} de ${variantIds.length}...`;
                        setJobL1(jobId, { status: "processing", progress, message: msg }, 1500);

                        return new Response(
                            JSON.stringify({ status: "processing", progress, message: msg }),
                            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    } else {
                        const finalUrl = newStepOutputs[newStepOutputs.length - 1];
                        await supabase
                            .from("ai_generated_assets")
                            .update({ status: "completed", generated_url: finalUrl })
                            .eq("id", asset.id);

                        await supabase
                            .from("ai_tryon_sessions")
                            .update({ status: "completed", updated_at: new Date().toISOString() })
                            .eq("asset_id", asset.id);

                        setJobL1(jobId, { status: "completed", generated_url: finalUrl }, 10 * 60 * 1000);
                        if (asset.prompt_hash) {
                            setAssetL1(asset.prompt_hash, finalUrl);
                        }

                        // Libera vaga na fila
                        await activateNextPendingJob(supabase);

                        return new Response(
                            JSON.stringify({ status: "completed", generated_url: finalUrl }),
                            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }
                } else {
                    const totalProgress = Math.round(((stepIndex + (elapsed / secondsPerStep)) / variantIds.length) * 100);
                    const msg = `Vestindo peça ${stepIndex + 1} de ${variantIds.length}...`;
                    const prog = Math.min(totalProgress, 99);
                    
                    setJobL1(jobId, { status: "processing", progress: prog, message: msg }, 1500);
                    
                    return new Response(
                        JSON.stringify({ status: "processing", progress: prog, message: msg }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            } else if (replicateId) {
                const resp = await fetch(`https://api.replicate.com/v1/predictions/${replicateId}`, {
                    headers: {
                        "Authorization": `Token ${REPLICATE_API_TOKEN}`,
                        "Content-Type": "application/json"
                    }
                });

                if (!resp.ok) {
                    throw new Error("Erro ao consultar status no Replicate.");
                }

                const prediction = await resp.json();
                
                if (prediction.status === "succeeded") {
                    const stepOutputUrl = prediction.output?.[0] || prediction.output;
                    const newStepOutputs = [...stepOutputs, stepOutputUrl];
                    const nextStepIndex = stepIndex + 1;

                    if (nextStepIndex < variantIds.length) {
                        const nextVariantId = variantIds[nextStepIndex];
                        const { data: vRow } = await supabase
                            .from("product_variants")
                            .select(`
                                id,
                                variant_image_url,
                                size,
                                color,
                                products (
                                    image_url,
                                    product_categories (
                                        name
                                    )
                                )
                            `)
                            .eq("id", nextVariantId)
                            .single();
                        
                        const productImages = vRow?.products?.image_url ? vRow.products.image_url.split(",") : [];
                        const nextGarmentImage = vRow?.variant_image_url || productImages[0];
                        const nextCategory = resolveCategory(vRow?.products?.product_categories?.name);
                        const nextCategoryResolved = nextCategory === "one-piece" ? "dress" : (nextCategory === "bottom" ? "lower_body" : "upper_body");

                        let newReplicateId = "";
                        try {
                            const response = await fetch("https://api.replicate.com/v1/predictions", {
                                method: "POST",
                                headers: {
                                    "Authorization": `Token ${REPLICATE_API_TOKEN}`,
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    version: "da995c03c990b7df3c530fd66a4da9cb22718e8d89582d22edec3dbb3cd91959",
                                    input: {
                                        crop: true,
                                        steps: 30,
                                        category: nextCategoryResolved,
                                        garm_img: nextGarmentImage,
                                        human_img: stepOutputUrl,
                                        garment_des: `Peça de tamanho ${vRow?.size || 'M'} e cor ${vRow?.color || ''}`,
                                        force_dc: false,
                                        seed: 42
                                    }
                                })
                            });

                            if (!response.ok) {
                                throw new Error("Erro na predição sequencial.");
                            }

                            const newPred = await response.json();
                            newReplicateId = newPred.id;
                        } catch (err) {
                            console.error("Erro sequencial Replicate, ativando mock:", err);
                            newReplicateId = `mock_${Date.now()}`;
                        }

                        const updatedInputParams = {
                            ...inputParams,
                            replicate_id: newReplicateId,
                            step_index: nextStepIndex,
                            step_outputs: newStepOutputs
                        };

                        await supabase
                            .from("ai_generated_assets")
                            .update({
                                created_at: new Date().toISOString(), // reset
                                input_parameters: updatedInputParams
                            })
                            .eq("id", asset.id);

                        const progress = Math.round((nextStepIndex / variantIds.length) * 100);
                        const msg = `Vestindo peça ${nextStepIndex + 1} de ${variantIds.length}...`;
                        setJobL1(jobId, { status: "processing", progress, message: msg }, 1500);

                        return new Response(
                            JSON.stringify({ status: "processing", progress, message: msg }),
                            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    } else {
                        const finalUrl = newStepOutputs[newStepOutputs.length - 1];
                        await supabase
                            .from("ai_generated_assets")
                            .update({ status: "completed", generated_url: finalUrl })
                            .eq("id", asset.id);

                        await supabase
                            .from("ai_tryon_sessions")
                            .update({ status: "completed", updated_at: new Date().toISOString() })
                            .eq("asset_id", asset.id);

                        setJobL1(jobId, { status: "completed", generated_url: finalUrl }, 10 * 60 * 1000);
                        if (asset.prompt_hash) {
                            setAssetL1(asset.prompt_hash, finalUrl);
                        }

                        await activateNextPendingJob(supabase);

                        return new Response(
                            JSON.stringify({ status: "completed", generated_url: finalUrl }),
                            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        );
                    }
                } else if (prediction.status === "failed" || prediction.status === "canceled") {
                    const errMsg = prediction.error || "Geração falhou no Replicate.";
                    await supabase
                        .from("ai_generated_assets")
                        .update({ status: "failed", error_message: errMsg })
                        .eq("id", asset.id);

                    await supabase
                        .from("ai_tryon_sessions")
                        .update({ status: "failed", updated_at: new Date().toISOString() })
                        .eq("asset_id", asset.id);

                    setJobL1(jobId, { status: "failed", error: errMsg }, 10 * 60 * 1000);

                    await activateNextPendingJob(supabase);

                    return new Response(
                        JSON.stringify({ status: "failed", error: errMsg }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                } else {
                    const totalProgress = Math.round(((stepIndex + 0.5) / variantIds.length) * 100);
                    const msg = `Vestindo peça ${stepIndex + 1} de ${variantIds.length}...`;
                    setJobL1(jobId, { status: "processing", progress: totalProgress, message: msg }, 1500);

                    return new Response(
                        JSON.stringify({ status: "processing", progress: totalProgress, message: msg }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            setJobL1(jobId, { status: "processing", progress: 10 }, 1500);
            return new Response(
                JSON.stringify({ status: "processing", progress: 10 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ROTA 3: POST /render OU POST /prefetch (Inicia renderização / prefetch)
        if (((action === "render" || action === "prefetch" || action === "") && req.method === "POST")) {
            const body = await req.json().catch(() => ({}));
            const { variant_id, variant_ids, garment_image_url, category, color, size, user_profile } = body;

            const targetVariantIds: string[] = variant_ids || (variant_id ? [variant_id] : []);

            if (targetVariantIds.length === 0) {
                return new Response(
                    JSON.stringify({ error: "O parâmetro variant_id ou variant_ids é obrigatório." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // 1. Validar variantes e estoque no banco
            const { data: dbVariants, error: varError } = await supabase
                .from("product_variants")
                .select(`
                    id,
                    stock_quantity,
                    variant_image_url,
                    color,
                    size,
                    product_id,
                    products (
                        image_url,
                        product_categories (
                            name
                        )
                    )
                `)
                .in("id", targetVariantIds);

            if (varError || !dbVariants || dbVariants.length === 0) {
                console.error("Validation failed. varError:", varError, "dbVariants:", dbVariants, "targetVariantIds:", targetVariantIds);
                return new Response(
                    JSON.stringify({ 
                        error: "Variantes de produto inválidas ou não encontradas no banco.",
                        details: varError ? varError.message : "Nenhuma variante encontrada",
                        targetVariantIds,
                        dbVariants,
                        varError
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
                );
            }

            // Se for prefetch, se não houver estoque em alguma peça, apenas ignora silenciosamente
            const hasOutOfStock = dbVariants.some(v => (v.stock_quantity ?? 0) <= 0);
            if (hasOutOfStock) {
                if (action === "prefetch") {
                    return new Response(
                        JSON.stringify({ status: "ignored", reason: "no_stock" }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
                return new Response(
                    JSON.stringify({ error: "Uma ou mais peças selecionadas estão sem estoque." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // Resolver dados de todas as variantes e ordenar IDs para consistência determinística do cache
            const sortedVariants = [...dbVariants].sort((a, b) => a.id.localeCompare(b.id));
            const sortedVariantIds = sortedVariants.map(v => v.id);

            const resolvedGarments = sortedVariants.map(v => {
                const parentProduct = v.products as any;
                const productImages = parentProduct?.image_url ? parentProduct.image_url.split(",") : [];
                const catName = parentProduct?.product_categories?.name;
                return {
                    variant_id: v.id,
                    garment_image_url: v.variant_image_url || productImages[0] || garment_image_url,
                    category: (resolveCategory(catName) || category || "top").toLowerCase(),
                    color: v.color || color || "",
                    size: v.size || size || ""
                };
            });

            // 2. Resolver Perfil Corporal (se autenticado)
            let bodyProfileId = null;
            let resolvedProfile = user_profile || {
                height: 170,
                weight: 70,
                gender: "female",
                body_type: "medium",
                fit_preference: "normal",
                photo_url: "https://placehold.co/400x500?text=Default+Avatar"
            };

            if (userId) {
                let { data: profileRow } = await supabase
                    .from("user_body_profiles")
                    .select("*")
                    .eq("user_id", userId)
                    .eq("is_default", true)
                    .maybeSingle();

                if (!profileRow) {
                    const { data: newProfile, error: profileInsertErr } = await supabase
                        .from("user_body_profiles")
                        .insert([{
                            user_id: userId,
                            profile_name: "Meu Perfil Padrão",
                            gender: resolvedProfile.gender || "female",
                            height_cm: resolvedProfile.height || 165,
                            weight_kg: resolvedProfile.weight || 60,
                            body_type: resolvedProfile.body_type || "medium",
                            fit_preference: resolvedProfile.fit_preference || "normal",
                            user_photo_url: resolvedProfile.photo_url || null,
                            is_default: true
                        }])
                        .select()
                        .single();

                    if (!profileInsertErr && newProfile) {
                        profileRow = newProfile;
                    }
                }

                if (profileRow) {
                    bodyProfileId = profileRow.id;
                    resolvedProfile = {
                        height: Number(profileRow.height_cm),
                        weight: Number(profileRow.weight_kg),
                        gender: profileRow.gender || "female",
                        body_type: profileRow.body_type || "medium",
                        fit_preference: profileRow.fit_preference || "normal",
                        photo_url: profileRow.user_photo_url || resolvedProfile.photo_url
                    };
                }
            }

            // 3. Calcular Cache Key (prompt_hash) estável, multidimensional e determinístico (Camada 1 e 5)
            const stableInputString = JSON.stringify({
                variant_ids: sortedVariantIds,
                garments: resolvedGarments,
                user_profile: {
                    height: resolvedProfile.height,
                    weight: resolvedProfile.weight,
                    body_type: resolvedProfile.body_type,
                    fit_preference: resolvedProfile.fit_preference,
                    photo_url: resolvedProfile.photo_url
                },
                pose_config: body.pose_config || "front",
                image_style_version: body.image_style_version || "v1",
                model_version: MODEL_VERSION,
                prompt_version: PROMPT_VERSION,
                render_pipeline_version: RENDER_PIPELINE_VERSION
            });

            const promptHash = await generateHash(stableInputString);
            const tenantId = body.tenant_id || "5111af72-27a5-41fd-8ed9-8c51b78b4fdd";

            // 4. Verificar Cache L1 (RAM)
            const l1AssetUrl = getAssetL1(promptHash);
            if (l1AssetUrl) {
                if (action !== "prefetch" && userId && bodyProfileId) {
                    const { data: dbAsset } = await supabase
                        .from("ai_generated_assets")
                        .select("id")
                        .eq("prompt_hash", promptHash)
                        .maybeSingle();

                      if (dbAsset) {
                          // Registra sessão para cada variante
                          for (const vid of sortedVariantIds) {
                              const { data: existingSession } = await supabase
                                  .from("ai_tryon_sessions")
                                  .select("id")
                                  .eq("user_id", userId)
                                  .eq("variant_id", vid)
                                  .eq("body_profile_id", bodyProfileId)
                                  .maybeSingle();

                              if (!existingSession) {
                                  await supabase
                                      .from("ai_tryon_sessions")
                                      .insert([{
                                          user_id: userId,
                                          variant_id: vid,
                                          body_profile_id: bodyProfileId,
                                          asset_id: dbAsset.id,
                                          status: "completed"
                                      }]);
                              }
                          }
                      }
                  }

                // Increment cache hits metric
                incrementCacheHits(supabase, tenantId);

                return new Response(
                    JSON.stringify({ status: "completed", generated_url: l1AssetUrl, source: "L1" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // 5. Verificar Cache L2 (DB)
            const { data: cachedAsset } = await supabase
                .from("ai_generated_assets")
                .select("*")
                .eq("prompt_hash", promptHash)
                .maybeSingle();

            if (cachedAsset) {
                setAssetL1(promptHash, cachedAsset.generated_url || "");
                
                if (action !== "prefetch" && userId && bodyProfileId) {
                    for (const vid of sortedVariantIds) {
                        const { data: existingSession } = await supabase
                            .from("ai_tryon_sessions")
                            .select("id")
                            .eq("user_id", userId)
                            .eq("variant_id", vid)
                            .eq("body_profile_id", bodyProfileId)
                            .maybeSingle();

                        if (!existingSession) {
                            await supabase
                                .from("ai_tryon_sessions")
                                .insert([{
                                    user_id: userId,
                                    variant_id: vid,
                                    body_profile_id: bodyProfileId,
                                    asset_id: cachedAsset.id,
                                    status: cachedAsset.status
                                }]);
                        }
                    }
                }

                if (cachedAsset.status === "completed") {
                    // Increment cache hits metric
                    incrementCacheHits(supabase, tenantId);

                    return new Response(
                        JSON.stringify({ status: "completed", generated_url: cachedAsset.generated_url, source: "L2" }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                } else {
                    return new Response(
                        JSON.stringify({ status: "processing", job_id: cachedAsset.id }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            let limitInfo = null;
            try {
                const { data } = await supabase.rpc("execute_sql", {
                    query: `
                        SELECT 
                            p.max_renders,
                            p.name as plan_name,
                            coalesce(u.renders_month, 0) as renders_month
                        FROM public.tenants t
                        LEFT JOIN public.plans p ON p.id = t.plan_id
                        LEFT JOIN public.tenant_usage u ON u.tenant_id = t.id 
                            AND u.billing_period_start <= now() 
                            AND u.billing_period_end >= now()
                        WHERE t.id = '${tenantId}';
                    `
                });
                limitInfo = data;
            } catch (e) {
                console.error("Error checking plan limits:", e);
            }

            const limitRow = limitInfo?.[0];
            if (limitRow) {
                const maxRenders = Number(limitRow.max_renders);
                const rendersMonth = Number(limitRow.renders_month);
                const planName = limitRow.plan_name || "Starter";

                if (maxRenders !== -1 && rendersMonth >= maxRenders) {
                    return new Response(
                        JSON.stringify({ 
                            status: "blocked", 
                            reason: "limit_reached", 
                            message: `Limite de provador virtual do plano ${planName} atingido (${maxRenders} renders/mês). Faça o upgrade para continuar.` 
                        }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            // Validar limites e debitar créditos do lojista (Cache Miss)
            const isPrefetch = action === "prefetch";
            if (!isPrefetch) {
                if (!userId) {
                    return new Response(
                        JSON.stringify({ error: "Autenticação requerida para gerar o provador." }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
                    );
                }

                const { data: creditRes, error: creditErr } = await supabase.rpc("deduct_tryon_credit", {
                    p_tenant_id: tenantId,
                    p_user_id: userId
                });

                if (creditErr || !creditRes || creditRes.status === "error") {
                    return new Response(
                        JSON.stringify({ 
                            status: "blocked", 
                            reason: "limit_reached", 
                            message: creditRes?.message || "Erro ao validar créditos ou limite diário atingido."
                        }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }

            // 7. Cache Miss: Inserir nova geração na fila
            const { count: activeCount } = await supabase
                .from("ai_generated_assets")
                .select("*", { count: "exact", head: true })
                .eq("status", "processing")
                .gt("created_at", new Date(Date.now() - 120 * 1000).toISOString());

            const isUnderLimit = (activeCount || 0) < MAX_CONCURRENT_JOBS;
            const initialStatus = (!isPrefetch && isUnderLimit) ? "processing" : "pending";
            const priority = isPrefetch ? "low" : (userId ? "high" : "normal");

            // Registrar asset no cache
            const { data: newAsset, error: insertError } = await supabase
                .from("ai_generated_assets")
                .insert([{
                    tenant_id: tenantId,
                    asset_type: "tryon",
                    prompt_hash: promptHash,
                    status: initialStatus,
                    input_parameters: {
                        priority,
                        replicate_id: "",
                        variant_ids: sortedVariantIds,
                        step_index: 0,
                        step_outputs: [],
                        user_profile: resolvedProfile
                    }
                }])
                .select()
                .single();

            if (insertError || !newAsset) {
                throw new Error(`Erro ao salvar cache de IA: ${insertError?.message}`);
            }

            // Registrar histórico da sessão se for render ativo
            if (!isPrefetch && userId && bodyProfileId) {
                for (const vid of sortedVariantIds) {
                    await supabase
                        .from("ai_tryon_sessions")
                        .insert([{
                            user_id: userId,
                            variant_id: vid,
                            body_profile_id: bodyProfileId,
                            asset_id: newAsset.id,
                            status: initialStatus
                        }]);
                }
            }

            // Se iniciou direto em processamento
            if (initialStatus === "processing") {
                console.log(`Fila: Capacidade livre (${activeCount}/${MAX_CONCURRENT_JOBS}). Iniciando job ${newAsset.id} imediatamente.`);
                await startJobProcessing(supabase, newAsset);
                
                // Buscar o status atualizado do asset (se concluiu de forma síncrona com Imagen 3)
                const { data: updatedAsset } = await supabase
                    .from("ai_generated_assets")
                    .select("*")
                    .eq("id", newAsset.id)
                    .single();

                if (updatedAsset && updatedAsset.status === "completed") {
                    return new Response(
                        JSON.stringify({ status: "completed", generated_url: updatedAsset.generated_url }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                return new Response(
                    JSON.stringify({ status: "processing", job_id: newAsset.id }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } else {
                // Calcula a posição atual na fila pendente
                const { count: queuePos } = await supabase
                    .from("ai_generated_assets")
                    .select("*", { count: "exact", head: true })
                    .eq("status", "pending")
                    .lt("created_at", newAsset.created_at);

                const pos = (queuePos || 0) + 1;
                
                if (isPrefetch) {
                    if ((activeCount || 0) < MAX_CONCURRENT_JOBS) {
                        activateNextPendingJob(supabase).catch(e => console.error("Prefetch background run err:", e));
                    }
                    return new Response(
                        JSON.stringify({ status: "pending", job_id: newAsset.id, queue_position: pos, prefetch: true }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                return new Response(
                    JSON.stringify({ 
                        status: "pending", 
                        job_id: newAsset.id, 
                        queue_position: pos 
                    }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // ROTA 4: GET /outfit/recommendations/:variant_id
        if (action === "outfit" && param === "recommendations" && req.method === "GET") {
            const variantId = segments[actionIndex + 3];
            if (!variantId) {
                return new Response(
                    JSON.stringify({ error: "variant_id ausente" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                );
            }

            // 1. Carregar a variante base e seu produto
            const { data: baseVariant, error: vErr } = await supabase
                .from("product_variants")
                .select(`
                    id,
                    color,
                    size,
                    product_id,
                    products (
                        name,
                        description,
                        category_id,
                        image_url,
                        base_price,
                        product_categories (
                            name
                        )
                    )
                `)
                .eq("id", variantId)
                .single();

            if (vErr || !baseVariant) {
                return new Response(
                    JSON.stringify({ error: "Variante base não encontrada" }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
                );
            }

            const parentProduct = baseVariant.products as any;
            const categoryName = parentProduct?.product_categories?.name || "";
            const baseColor = baseVariant.color || "";
            const baseDescription = parentProduct?.description || "";
            const baseName = parentProduct?.name || "";

            // Determinar tipo do item
            let baseType: "top" | "bottom" | "shoes" | "one-piece" = "top";
            const categoryLower = categoryName.toLowerCase();
            if (categoryLower.includes("calça") || categoryLower.includes("bermuda") || categoryLower.includes("short") || categoryLower.includes("pants") || categoryLower.includes("bottom")) {
                baseType = "bottom";
            } else if (categoryLower.includes("calçado") || categoryLower.includes("tênis") || categoryLower.includes("sapato") || categoryLower.includes("shoes") || categoryLower.includes("footwear")) {
                baseType = "shoes";
            } else if (categoryLower.includes("vestido") || categoryLower.includes("macacão") || categoryLower.includes("dress") || categoryLower.includes("one-piece")) {
                baseType = "one-piece";
            }

            // Determinar estilo
            let baseStyle = "casual";
            const descriptionLower = (baseName + " " + baseDescription).toLowerCase();
            if (descriptionLower.includes("streetwear") || descriptionLower.includes("oversized") || descriptionLower.includes("urbano") || descriptionLower.includes("corta-vento") || descriptionLower.includes("street")) {
                baseStyle = "streetwear";
            } else if (descriptionLower.includes("social") || descriptionLower.includes("formal") || descriptionLower.includes("terno") || descriptionLower.includes("camisa social")) {
                baseStyle = "formal";
            }

            // Determinar gênero
            let baseGender = "unisex";
            if (descriptionLower.includes("feminino") || descriptionLower.includes("mulher") || descriptionLower.includes("para mulher")) {
                baseGender = "female";
            } else if (descriptionLower.includes("masculino") || descriptionLower.includes("homem") || descriptionLower.includes("para homem")) {
                baseGender = "male";
            }

            // 2. Buscar candidatos (outros produtos ativos com estoque)
            const { data: candidates, error: cErr } = await supabase
                .from("product_variants")
                .select(`
                    id,
                    color,
                    size,
                    stock_quantity,
                    variant_image_url,
                    additional_price,
                    product_id,
                    products (
                        name,
                        description,
                        base_price,
                        image_url,
                        product_categories (
                            name
                        )
                    )
                `)
                .eq("is_active", true)
                .gt("stock_quantity", 0)
                .neq("product_id", baseVariant.product_id); // evitar recomendar o mesmo produto

            if (cErr || !candidates) {
                return new Response(
                    JSON.stringify({ recommendations: [] }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }

            // 3. Classificar e pontuar candidatos
            const scoredRecommendations = candidates.map((cand: any) => {
                const candProduct = cand.products as any;
                const candCategory = candProduct?.product_categories?.name || "";
                const candColor = cand.color || "";
                const candDesc = candProduct?.description || "";
                const candName = candProduct?.name || "";

                // Determinar tipo do candidato
                let candType: "top" | "bottom" | "shoes" | "one-piece" = "top";
                const candCategoryLower = candCategory.toLowerCase();
                if (candCategoryLower.includes("calça") || candCategoryLower.includes("bermuda") || candCategoryLower.includes("short") || candCategoryLower.includes("pants")) {
                    candType = "bottom";
                } else if (candCategoryLower.includes("calçado") || candCategoryLower.includes("tênis") || candCategoryLower.includes("sapato") || candCategoryLower.includes("shoes")) {
                    candType = "shoes";
                } else if (candCategoryLower.includes("vestido") || candCategoryLower.includes("macacão") || candCategoryLower.includes("dress")) {
                    candType = "one-piece";
                }

                // Determinar estilo do candidato
                let candStyle = "casual";
                const candDescLower = (candName + " " + candDesc).toLowerCase();
                if (candDescLower.includes("streetwear") || candDescLower.includes("oversized") || candDescLower.includes("urbano") || candDescLower.includes("corta-vento") || candDescLower.includes("street")) {
                    candStyle = "streetwear";
                } else if (candDescLower.includes("social") || candDescLower.includes("formal") || candDescLower.includes("terno")) {
                    candStyle = "formal";
                }

                // Determinar gênero do candidato
                let candGender = "unisex";
                if (candDescLower.includes("feminino") || candDescLower.includes("mulher")) {
                    candGender = "female";
                } else if (candDescLower.includes("masculino") || candDescLower.includes("homem")) {
                    candGender = "male";
                }

                // Pontuar
                let score = 0.5;

                // Estilo idêntico
                if (candStyle === baseStyle) {
                    score += 0.3;
                }

                // Gênero compatível
                if (baseGender !== "unisex" && candGender !== "unisex") {
                    if (baseGender === candGender) {
                        score += 0.2;
                    } else {
                        score -= 0.4;
                    }
                }

                // Harmonia de cores
                const neutralColors = ["preto", "branco", "cinza", "gray", "white", "black", "off-white", "creme", "beige", "bege"];
                const baseColorLower = baseColor.toLowerCase();
                const candColorLower = candColor.toLowerCase();
                
                if (neutralColors.includes(baseColorLower) || neutralColors.includes(candColorLower)) {
                    score += 0.15;
                } else if (baseColorLower === candColorLower) {
                    score += 0.1;
                }

                // Bônus de estoque
                if (cand.stock_quantity > 5) {
                    score += 0.05;
                }

                return {
                    variant_id: cand.id,
                    product_id: cand.product_id,
                    name: candName,
                    price: (candProduct?.base_price || 0) + (Number(cand.additional_price) || 0),
                    image: cand.variant_image_url || candProduct?.image_url?.split(',')[0]?.trim() || "https://placehold.co/400x500?text=Recommended+Image",
                    color: candColor,
                    size: cand.size,
                    type: candType,
                    score: Number(score.toFixed(2))
                };
            });

            // 4. Selecionar os melhores de cada categoria complementar
            let targetTypes: ("top" | "bottom" | "shoes")[] = [];
            if (baseType === "top") {
                targetTypes = ["bottom", "shoes"];
            } else if (baseType === "bottom") {
                targetTypes = ["top", "shoes"];
            } else if (baseType === "shoes") {
                targetTypes = ["top", "bottom"];
            } else {
                targetTypes = ["shoes", "top"];
            }

            const recommendations: any[] = [];
            
            targetTypes.forEach(t => {
                const candidatesOfType = scoredRecommendations
                    .filter(r => r.type === t && r.score > 0.2)
                    .sort((a, b) => b.score - a.score);
                
                if (candidatesOfType.length > 0) {
                    recommendations.push(candidatesOfType[0]);
                    if (candidatesOfType.length > 1 && recommendations.length < 3) {
                        recommendations.push(candidatesOfType[1]);
                    }
                }
            });

            return new Response(
                JSON.stringify({ recommendations: recommendations.sort((a, b) => b.score - a.score) }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ error: "Endpoint ou método não suportado." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );

    } catch (error: any) {
        console.error("VTON Engine Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
})
