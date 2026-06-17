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
        const actionIndex = segments.indexOf("checkout-engine")
        
        let action = ""
        if (actionIndex !== -1 && actionIndex < segments.length - 1) {
            action = segments[actionIndex + 1]
        }

        const body = await req.json().catch(() => ({}))
        console.log(`[Checkout Engine] Action: ${action}, Body:`, JSON.stringify(body, null, 2))

        // ROTA 1: POST /cart/add
        if (action === "cart" && segments[actionIndex + 2] === "add") {
            const { variant_id, quantity, session_id, organization_id } = body
            if (!variant_id || !session_id || !organization_id) {
                return new Response(
                    JSON.stringify({ error: "Parâmetros variant_id, session_id e organization_id são obrigatórios." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            const targetQty = Number(quantity) || 1

            // Invocar RPC atômica de reserva de estoque
            const { data, error } = await supabase.rpc("reserve_stock_atomic", {
                p_org_id: organization_id,
                p_variant_id: variant_id,
                p_session_id: session_id,
                p_quantity: targetQty,
                p_minutes: 15 // Reserva de 15 minutos
            })

            if (error || !data) {
                throw new Error(error?.message || "Erro desconhecido ao reservar estoque.")
            }

            if (!data.success) {
                return new Response(
                    JSON.stringify({ success: false, message: data.message }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
                )
            }

            return new Response(
                JSON.stringify({ success: true, reserved_until: data.reserved_until }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 2: POST /cart/remove
        if (action === "cart" && segments[actionIndex + 2] === "remove") {
            const { variant_id, session_id } = body
            if (!variant_id || !session_id) {
                return new Response(
                    JSON.stringify({ error: "Parâmetros variant_id e session_id são obrigatórios." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            const { error } = await supabase.rpc("release_stock_reservation", {
                p_variant_id: variant_id,
                p_session_id: session_id
            })

            if (error) {
                throw new Error(error.message)
            }

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ROTA 3: POST /checkout/start
        if (action === "checkout" && segments[actionIndex + 2] === "start") {
            const {
                order_id,
                customer_info,
                payment_method,
                shipping_cost,
                shipping_method,
                cart_items,
                session_id,
                organization_id,
                user_id,
                origin
            } = body

            if (!order_id || !customer_info || !payment_method || !cart_items || cart_items.length === 0 || !session_id || !organization_id) {
                return new Response(
                    JSON.stringify({ error: "Parâmetros obrigatórios incompletos para iniciar o checkout." }),
                    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
                )
            }

            // 1. Validar que todas as peças no carrinho possuem reservas ativas e válidas para esta sessão
            const { data: activeReservations, error: resError } = await supabase
                .from("inventory_reservations")
                .select("variant_id, quantity, reserved_until")
                .eq("session_id", session_id)
                .eq("status", "active")
                .gt("reserved_until", new Date().toISOString())

            if (resError) throw new Error("Erro ao validar reservas de estoque.")

            for (const item of cart_items) {
                const res = activeReservations?.find(r => r.variant_id === item.variant_id)
                if (!res || res.quantity < item.quantity) {
                    return new Response(
                        JSON.stringify({ 
                            error: true, 
                            message: `A reserva de estoque para a peça ${item.name} expirou ou é insuficiente. Adicione o item novamente ao carrinho.` 
                        }),
                        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
                    )
                }
            }

            // 2. Inserir Pedido no Supabase
            const totalAmount = cart_items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0) + (Number(shipping_cost) || 0)
            const fullAddressString = `${customer_info.street}, ${customer_info.number} ${customer_info.complement ? `(${customer_info.complement})` : ""} - ${customer_info.neighborhood}, ${customer_info.city} - ${customer_info.state} (CEP: ${customer_info.cep})`

            const { error: orderError } = await supabase
                .from("orders")
                .insert([{
                    id: order_id,
                    organization_id,
                    user_id: user_id || null,
                    customer_name: customer_info.name,
                    customer_email: customer_info.email,
                    customer_phone: customer_info.phone,
                    customer_cpf: customer_info.cpf,
                    shipping_address: fullAddressString,
                    total_amount: totalAmount,
                    shipping_cost: Number(shipping_cost) || 0,
                    shipping_method: shipping_method || "Não informado",
                    status: "Pendente",
                    payment_method: payment_method === "credit" ? "Cartão de Crédito" : "Pix"
                }])

            if (orderError) throw new Error(`Erro ao criar pedido no banco: ${orderError.message}`)

            // 3. Inserir Itens do Pedido
            const { error: itemsError } = await supabase
                .from("order_items")
                .insert(cart_items.map((item: any) => ({
                    order_id,
                    organization_id,
                    variant_id: item.variant_id,
                    product_name: item.name,
                    size_color_label: `Tamanho: ${item.selectedVariations?.sizes || "Único"} | Cor: ${item.selectedVariations?.colors || "Única"}`,
                    quantity: item.quantity,
                    unit_price: item.price
                })))

            if (itemsError) throw new Error(`Erro ao salvar itens do pedido: ${itemsError.message}`)

            // 4. Vincular as reservas de estoque a este order_id
            await supabase
                .from("inventory_reservations")
                .update({ order_id, updated_at: new Date().toISOString() })
                .eq("session_id", session_id)
                .eq("status", "active")
                .gt("reserved_until", new Date().toISOString())

            // 5. Integrar com Mercado Pago
            const { data: org } = await supabase.from("organizations").select("*").eq("id", organization_id).single()
            const accessToken = org?.mercadopago_access_token || (org?.mercadopago_config as any)?.access_token

            if (!accessToken) throw new Error("Configuração do Mercado Pago não encontrada para esta organização.")

            if (payment_method === "pix") {
                const cleanDoc = customer_info.cpf.replace(/\D/g, "")
                const docType = cleanDoc.length === 11 ? "CPF" : cleanDoc.length === 14 ? "CNPJ" : null
                if (!docType) throw new Error("Documento (CPF/CNPJ) inválido para pagamento PIX.")

                const paymentData = {
                    transaction_amount: Number(totalAmount),
                    description: `Pedido ${order_id} - ${org?.name || "Loja Urbano"}`,
                    payment_method_id: "pix",
                    installments: 1,
                    payer: {
                        email: customer_info.email || "cliente@mercado.com",
                        first_name: customer_info.name.split(" ")[0] || "Cliente",
                        last_name: customer_info.name.split(" ").slice(1).join(" ") || "Urbano",
                        identification: { type: docType, number: cleanDoc }
                    },
                    external_reference: order_id,
                    notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook?org_id=${organization_id}`,
                }

                const response = await fetch("https://api.mercadopago.com/v1/payments", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                        "X-Idempotency-Key": `pix-${order_id}-${Date.now()}`
                    },
                    body: JSON.stringify(paymentData),
                })

                const result = await response.json()
                if (!response.ok) throw new Error(result.message || "Erro no processamento do PIX no Mercado Pago.")

                const transactionData = result.point_of_interaction?.transaction_data

                await supabase.from("orders").update({ 
                    payment_id: result.id.toString(),
                    pix_qr_code: transactionData?.qr_code,
                    pix_qr_code_base64: transactionData?.qr_code_base64,
                    pix_copy_paste: transactionData?.qr_code,
                    status: "Pendente"
                }).eq("id", order_id)

                return new Response(JSON.stringify({
                    success: true,
                    qr_code: transactionData?.qr_code,
                    qr_code_base64: transactionData?.qr_code_base64,
                    copy_paste: transactionData?.qr_code,
                    payment_id: result.id,
                    ticket_url: transactionData?.ticket_url
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })

            } else {
                // Checkout Pro (Cartão de Crédito)
                const items = cart_items.map((item: any) => ({
                    title: item.name,
                    quantity: item.quantity,
                    unit_price: Number(item.price),
                    currency_id: "BRL"
                }))

                if (Number(shipping_cost) > 0) {
                    items.push({
                        title: "Frete",
                        quantity: 1,
                        unit_price: Number(shipping_cost),
                        currency_id: "BRL"
                    })
                }

                const preferenceData = {
                    items,
                    payer: { email: customer_info.email || "cliente@mercado.com" },
                    external_reference: order_id,
                    back_urls: {
                        success: `${origin || "https://classea.vercel.app"}/checkout/success/${order_id}`,
                        failure: `${origin || "https://classea.vercel.app"}/checkout`,
                        pending: `${origin || "https://classea.vercel.app"}/checkout`
                    },
                    auto_return: "approved",
                    notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook?org_id=${organization_id}`,
                }

                const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify(preferenceData),
                })

                const result = await response.json()
                if (!result.id) throw new Error(result.message || "Erro ao criar preferência de pagamento Mercado Pago.")

                await supabase.from("orders").update({ payment_preference_id: result.id }).eq("id", order_id)

                return new Response(JSON.stringify({ 
                    success: true, 
                    id: result.id, 
                    init_point: result.init_point 
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
            }
        }

        return new Response(
            JSON.stringify({ error: "Endpoint ou método não suportado." }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        )

    } catch (error: any) {
        console.error("[Checkout Engine Error]:", error)
        return new Response(
            JSON.stringify({ error: true, message: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        )
    }
})
