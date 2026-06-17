import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendConfirmationEmail(order: any) {
  if (!resendApiKey) {
    console.error("[Email] RESEND_API_KEY não configurada nas Secrets do Supabase.");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Classe A <onboarding@resend.dev>", // Usar o domínio padrão caso o real não esteja verificado
        to: [order.customer_email],
        subject: `Pagamento Confirmado! 🚀 - Pedido ${order.id}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
            <div style="background-color: #0B1221; padding: 40px; text-align: center;">
              <h1 style="color: #FBC02D; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px;">Pagamento Confirmado</h1>
            </div>
            <div style="padding: 40px; color: #333; line-height: 1.6;">
              <p>Olá, <strong>${order.customer_name}</strong>!</p>
              <p>Boas notícias! Recebemos a confirmação do seu pagamento para o pedido <strong>${order.id}</strong>.</p>
              
              <div style="background-color: #f8f9fa; border-radius: 15px; padding: 20px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Valor Total:</strong> R$ ${Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                <p style="margin: 5px 0;"><strong>Método:</strong> ${order.payment_method}</p>
              </div>

              <p>Nossa equipe já está preparando tudo com o padrão de excelência Classe A. Você receberá novas atualizações assim que seu pedido for postado.</p>
              
              <div style="text-align: center; margin-top: 40px;">
                <p style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Classe A Premium Lifestyle</p>
              </div>
            </div>
          </div>
        `
      }),
    });

    if (!res.ok) {
        const errorData = await res.json();
        console.error("[Email] Erro ao disparar email via Resend:", errorData);
    } else {
        console.log(`[Email] Confirmação enviada com sucesso para ${order.customer_email}`);
    }
  } catch (err) {
    console.error("[Email] Erro catastrófico no envio:", err);
  }
}

serve(async (req) => {
    try {
        const url = new URL(req.url);
        const topic = url.searchParams.get("topic") || url.searchParams.get("type");
        const id = url.searchParams.get("id") || url.searchParams.get("data.id");

        console.log(`[Webhook] Recebida notificação: topic=${topic}, id=${id}`);

        if (!id) {
            return new Response("No ID provided", { status: 200 });
        }

        const orgId = url.searchParams.get("org_id");
        if (!orgId) {
            console.error("[Webhook] org_id não fornecido na URL.");
            return new Response("org_id missing", { status: 400 });
        }

        const { data: org, error: orgError } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", orgId)
            .single();

        const accessToken = org?.mercadopago_access_token || (org?.mercadopago_config as any)?.access_token;

        if (orgError || !accessToken) {
            return new Response("Organization token not found", { status: 404 });
        }

        if (topic === "payment") {
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (!response.ok) {
                return new Response("Error fetching payment", { status: 200 });
            }

            const payment = await response.json();
            const orderId = payment.external_reference;
            const status = payment.status;

            console.log(`[Webhook] Pedido: ${orderId}, Status MP: ${status}`);

            if (orderId && (status === "approved" || status === "authorized")) {
                const cleanOrderId = orderId.replace(/^#/, '');
                const { data: success, error: confirmError } = await supabase
                    .rpc("confirm_order_payment", {
                        p_order_id: cleanOrderId,
                        p_payment_id: payment.id.toString(),
                        p_status_detail: payment.status_detail || 'approved'
                    });

                if (confirmError) throw confirmError;

                if (success) {
                    console.log(`[Webhook] ✅ Pedido ${cleanOrderId} confirmado via RPC com sucesso.`);
                } else {
                    console.log(`[Webhook] ⚠️ Pedido ${cleanOrderId} não pôde ser atualizado via RPC (pode já estar pago ou não existe).`);
                }
            } else {
                console.log(`[Webhook] ℹ️ Notificação ignorada: Pedido ${orderId}, Status: ${status}. Aguardando status 'approved'.`);
            }
        }

        return new Response("Webhook received", { status: 200 });
    } catch (error) {
        console.error("[Webhook Error]:", error.message);
        return new Response(error.message, { status: 400 });
    }
});
