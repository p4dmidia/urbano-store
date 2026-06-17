import { supabase } from './supabase';
import { ORGANIZATION_ID } from './config';

export const trackEvent = async (eventType: string, metadata: any = {}) => {
    // Execução silenciosa em background. Envolver em try/catch para garantir que falhas de rede do analytics nunca afetem o fluxo do cliente.
    try {
        const sessionId = localStorage.getItem('cart_session_id') || 'guest_session';
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;

        const sessionTenantId = session?.user?.user_metadata?.tenant_id;
        const tenantId = metadata.tenant_id || sessionTenantId || ORGANIZATION_ID;

        const payload = {
            tenant_id: tenantId,
            session_id: sessionId,
            user_id: userId,
            event_type: eventType,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        };

        // Dispara de forma assíncrona (fire-and-forget)
        supabase.functions.invoke('analytics-engine/event', {
            body: payload
        }).catch(err => {
            console.warn('Analytics tracking warning (non-blocking):', err);
        });
    } catch (err) {
        console.warn('Analytics tracking exception (non-blocking):', err);
    }
};
