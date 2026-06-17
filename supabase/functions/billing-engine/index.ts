import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || ""
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
        const supabase = createClient(supabaseUrl, supabaseKey)

        const url = new URL(req.url)
        const segments = url.pathname.split("/").filter(Boolean)
        const actionIndex = segments.indexOf("billing-engine")
        
        let action = ""
        let subAction = ""
        
        if (actionIndex !== -1 && actionIndex < segments.length - 1) {
            action = segments[actionIndex + 1]
            if (actionIndex < segments.length - 2) {
                subAction = segments[actionIndex + 2]
            }
        }

        // ROTA 1: POST /billing-engine/tenants (Onboarding do lojista)
        if (action === "tenants" && req.method === "POST") {
            const body = await req.json().catch(() => ({}))
            const { email, password, full_name, tenant_name, tenant_slug } = body

            if (!email || !password || !tenant_name || !tenant_slug) {
                return new Response(
                    JSON.stringify({ error: "Campos email, password, tenant_name e tenant_slug são obrigatórios." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // 1. Verificar se slug já existe
            const { data: existingTenant } = await supabase
                .from("tenants")
                .select("id")
                .eq("slug", tenant_slug.toLowerCase())
                .maybeSingle()

            if (existingTenant) {
                return new Response(
                    JSON.stringify({ error: "O slug da loja informado já está em uso por outro lojista." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // 2. Criar inquilino (tenant) com plano Starter por padrão
            const starterPlanId = "a111af72-27a5-41fd-8ed9-8c51b78b4fa1"
            const { data: tenant, error: tenantErr } = await supabase
                .from("tenants")
                .insert([{
                    name: tenant_name,
                    slug: tenant_slug.toLowerCase(),
                    plan_id: starterPlanId,
                    status: "active"
                }])
                .select()
                .single()

            if (tenantErr || !tenant) {
                throw new Error(`Erro ao criar inquilino: ${tenantErr?.message}`)
            }

            // 3. Criar usuário Owner no auth.users do Supabase
            const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name,
                    role: "admin",
                    tenant_id: tenant.id
                }
            })

            if (authErr || !authUser.user) {
                // Rollback tenant se falhar ao criar usuário
                await supabase.from("tenants").delete().eq("id", tenant.id)
                throw new Error(`Erro ao criar usuário administrador: ${authErr?.message}`)
            }

            // 4. Forçar/atualizar perfil na tabela user_profiles (uma vez que o trigger de sincronia pode demorar)
            const { error: profileErr } = await supabase
                .from("user_profiles")
                .update({ 
                    tenant_id: tenant.id,
                    role: "admin",
                    status: "active"
                })
                .eq("id", authUser.user.id)

            // Se o perfil ainda não foi criado pelo trigger, vamos criá-lo manualmente
            if (profileErr) {
                const { error: insertProfileErr } = await supabase
                    .from("user_profiles")
                    .insert([{
                        id: authUser.user.id,
                        email: email,
                        full_name: full_name || "Lojista Owner",
                        role: "admin",
                        tenant_id: tenant.id,
                        status: "active"
                    }])
                if (insertProfileErr) {
                    console.error("Erro ao inserir perfil manual:", insertProfileErr)
                }
            }

            // 5. Vincular usuário administrador na tabela tenant_users com papel 'owner'
            const { error: roleErr } = await supabase
                .from("tenant_users")
                .insert([{
                    tenant_id: tenant.id,
                    user_id: authUser.user.id,
                    role: "owner"
                }])

            if (roleErr) {
                console.error("Erro ao registrar papel de owner do inquilino:", roleErr)
            }

            // 6. Criar assinatura inicial Starter
            const { error: subErr } = await supabase
                .from("subscriptions")
                .insert([{
                    tenant_id: tenant.id,
                    plan_id: starterPlanId,
                    status: "active",
                    billing_interval: "month",
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                }])

            if (subErr) {
                console.error("Erro ao iniciar assinatura Starter:", subErr)
            }

            // 7. Criar tabela de consumo inicial
            const startOfMonth = new Date()
            startOfMonth.setDate(1)
            startOfMonth.setHours(0,0,0,0)
            const endOfMonth = new Date(startOfMonth)
            endOfMonth.setMonth(endOfMonth.getMonth() + 1)

            await supabase
                .from("tenant_usage")
                .insert([{
                    tenant_id: tenant.id,
                    billing_period_start: startOfMonth.toISOString(),
                    billing_period_end: endOfMonth.toISOString(),
                    renders_total: 0,
                    renders_month: 0,
                    cache_hits: 0,
                    estimated_ai_cost: 0
                }])

            // Gravar evento de faturamento
            await supabase
                .from("billing_events")
                .insert([{
                    tenant_id: tenant.id,
                    event_type: "onboarding_completed",
                    amount: 0,
                    metadata: { plan: "Starter" }
                }])

            return new Response(
                JSON.stringify({ success: true, tenant_id: tenant.id, user_id: authUser.user.id }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 2: GET /billing-engine/tenant/current
        if (action === "tenant" && subAction === "current" && req.method === "GET") {
            const tenantId = url.searchParams.get("tenant_id") || url.searchParams.get("org_id")
            const slug = url.searchParams.get("slug")

            let query = supabase.from("tenants").select("id, name, slug, logo_url, status, plan_id, plans(name)")
            
            if (tenantId) {
                query = query.eq("id", tenantId)
            } else if (slug) {
                query = query.eq("slug", slug.toLowerCase())
            } else {
                return new Response(
                    JSON.stringify({ error: "Parâmetro tenant_id ou slug é necessário." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            const { data: tenant, error: fetchErr } = await query.maybeSingle()

            if (fetchErr || !tenant) {
                return new Response(
                    JSON.stringify({ error: "Inquilino não encontrado." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
                )
            }

            return new Response(
                JSON.stringify({ success: true, tenant }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 3: POST /billing-engine/subscription/create
        if (action === "subscription" && subAction === "create" && req.method === "POST") {
            const body = await req.json().catch(() => ({}))
            const { tenant_id, plan_id, billing_interval } = body

            if (!tenant_id || !plan_id) {
                return new Response(
                    JSON.stringify({ error: "tenant_id e plan_id são obrigatórios." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // Obter preço do plano
            const { data: plan } = await supabase.from("plans").select("monthly_price, yearly_price").eq("id", plan_id).single()
            const price = billing_interval === "year" ? plan?.yearly_price : plan?.monthly_price

            // Criar/substituir assinatura
            const { data: sub, error } = await supabase
                .from("subscriptions")
                .insert([{
                    tenant_id,
                    plan_id,
                    status: "active",
                    billing_interval: billing_interval || "month",
                    current_period_start: new Date().toISOString(),
                    current_period_end: new Date(Date.now() + (billing_interval === "year" ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString()
                }])
                .select()

            if (error) throw error

            // Atualizar plano no tenant
            await supabase.from("tenants").update({ plan_id }).eq("id", tenant_id)

            // Registrar log de faturamento
            await supabase.from("billing_events").insert([{
                tenant_id,
                event_type: "subscription_created",
                amount: price || 0,
                metadata: { plan_id, billing_interval }
            }])

            return new Response(
                JSON.stringify({ success: true, subscription: sub }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 4: POST /billing-engine/subscription/change-plan (Upgrade/Downgrade)
        if (action === "subscription" && subAction === "change-plan" && req.method === "POST") {
            const body = await req.json().catch(() => ({}))
            const { tenant_id, plan_id } = body

            if (!tenant_id || !plan_id) {
                return new Response(
                    JSON.stringify({ error: "tenant_id e plan_id são obrigatórios." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // Atualizar assinatura ativa
            const { error: subErr } = await supabase
                .from("subscriptions")
                .update({ 
                    plan_id, 
                    updated_at: new Date().toISOString() 
                })
                .eq("tenant_id", tenant_id)
                .eq("status", "active")

            if (subErr) throw subErr

            // Atualizar plano no inquilino
            await supabase.from("tenants").update({ plan_id }).eq("id", tenant_id)

            // Registrar evento
            const { data: plan } = await supabase.from("plans").select("name, monthly_price").eq("id", plan_id).single()
            await supabase.from("billing_events").insert([{
                tenant_id,
                event_type: "subscription_upgraded",
                amount: plan?.monthly_price || 0,
                metadata: { plan_name: plan?.name, plan_id }
            }])

            return new Response(
                JSON.stringify({ success: true, message: `Plano atualizado com sucesso para ${plan?.name}.` }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 5: POST /billing-engine/subscription/cancel
        if (action === "subscription" && subAction === "cancel" && req.method === "POST") {
            const body = await req.json().catch(() => ({}))
            const { tenant_id } = body

            if (!tenant_id) {
                return new Response(
                    JSON.stringify({ error: "tenant_id é obrigatório." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // Cancelar assinatura
            const { error: subErr } = await supabase
                .from("subscriptions")
                .update({ status: "canceled", updated_at: new Date().toISOString() })
                .eq("tenant_id", tenant_id)

            if (subErr) throw subErr

            // Remover plano do tenant
            await supabase.from("tenants").update({ plan_id: null }).eq("id", tenant_id)

            // Registrar log
            await supabase.from("billing_events").insert([{
                tenant_id,
                event_type: "subscription_canceled",
                amount: 0
            }])

            return new Response(
                JSON.stringify({ success: true, message: "Assinatura cancelada com sucesso." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 6: GET /billing-engine/usage/vton
        if (action === "usage" && subAction === "vton" && req.method === "GET") {
            const tenantId = url.searchParams.get("tenant_id") || url.searchParams.get("org_id")

            if (!tenantId) {
                return new Response(
                    JSON.stringify({ error: "tenant_id é obrigatório." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // Buscar registro de consumo mais recente
            const { data: usage, error } = await supabase
                .from("tenant_usage")
                .select("*")
                .eq("tenant_id", tenantId)
                .order("billing_period_start", { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) throw error

            const defaults = {
                renders_total: 0,
                renders_month: 0,
                cache_hits: 0,
                estimated_ai_cost: 0,
                cache_rate: 0
            }

            if (!usage) {
                return new Response(
                    JSON.stringify({ success: true, usage: defaults }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                )
            }

            const totalCalls = (usage.renders_month || 0) + (usage.cache_hits || 0)
            const cacheRate = totalCalls > 0 ? Math.round((usage.cache_hits / totalCalls) * 100) : 0
            const costSaved = (usage.cache_hits || 0) * 0.15 // R$ 0.15 economizado por cache hit

            return new Response(
                JSON.stringify({
                    success: true,
                    usage: {
                        ...usage,
                        cache_rate: cacheRate,
                        cost_saved: costSaved
                    }
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 7: GET /billing-engine/usage/limits
        if (action === "usage" && subAction === "limits" && req.method === "GET") {
            const tenantId = url.searchParams.get("tenant_id") || url.searchParams.get("org_id")

            if (!tenantId) {
                return new Response(
                    JSON.stringify({ error: "tenant_id é obrigatório." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // 1. Obter informações de limite do plano do tenant
            const { data: tenant, error: tenantErr } = await supabase
                .from("tenants")
                .select("id, plan_id, plans(*)")
                .eq("id", tenantId)
                .single()

            if (tenantErr || !tenant) {
                throw new Error("Tenant não encontrado para limite.")
            }

            const plan = tenant.plans

            // 2. Obter contagem de produtos ativos cadastrados
            const { count: productsCount } = await supabase
                .from("products")
                .select("*", { count: "exact", head: true })
                .eq("tenant_id", tenantId)
                .is("deleted_at", null)

            // 3. Obter renders consumidos no mês atual
            const { data: usage } = await supabase
                .from("tenant_usage")
                .select("renders_month")
                .eq("tenant_id", tenantId)
                .order("billing_period_start", { ascending: false })
                .limit(1)
                .maybeSingle()

            const rendersMonth = usage?.renders_month || 0
            const maxRenders = plan?.max_renders || 0
            const maxProducts = plan?.max_products || 0

            const isRendersExceeded = maxRenders !== -1 && rendersMonth >= maxRenders
            const isProductsExceeded = maxProducts !== -1 && (productsCount || 0) >= maxProducts

            return new Response(
                JSON.stringify({
                    success: true,
                    plan_name: plan?.name || "Sem Plano",
                    renders_month: rendersMonth,
                    max_renders: maxRenders,
                    is_renders_exceeded: isRendersExceeded,
                    products_count: productsCount || 0,
                    max_products: maxProducts,
                    is_products_exceeded: isProductsExceeded
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        return new Response(
            JSON.stringify({ error: "Endpoint ou método não suportado." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        )

    } catch (error: any) {
        console.error("[Billing Engine Error]:", error)
        return new Response(
            JSON.stringify({ error: true, message: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        )
    }
})
