import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MELHOR_ENVIO_TOKEN = Deno.env.get('MELHOR_ENVIO_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (!MELHOR_ENVIO_TOKEN) {
            console.error('ERRO: MELHOR_ENVIO_TOKEN não configurado nas variáveis de ambiente.');
            return new Response(
                JSON.stringify({ error: 'Configuração do servidor incompleta (Token de API ausente)' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
            )
        }

        const body = await req.json().catch(() => ({}));
        const { zip, items, organization_id } = body;


        if (!zip || !items || !items.length) {
            return new Response(
                JSON.stringify({ error: 'CEP de destino e itens são obrigatórios' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
        }

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

        // 1. Buscar detalhes dos produtos com categorias
        const productIds = items.map((item: any) => item.id)
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, name, weight, length, width, height, origin_zip, price, product_categories(name)')
            .in('id', productIds)


        if (productsError || !products) {
            throw new Error('Erro ao buscar produtos: ' + productsError?.message)
        }

        // 2. Separar itens com frete fixo e agrupar os demais por CEP de origem
        let fixedShippingTotal = 0
        const groups: { [key: string]: any[] } = {}
        
        products.forEach(p => {
            const cartItem = items.find((i: any) => i.id === p.id)
            if (!cartItem) return

            const quantity = cartItem.quantity
            const productName = p.name || ''
            
            // Garantir que pegamos o nome da categoria, seja objeto ou array
            let categoryName = ''
            const catData = p.product_categories
            if (catData) {
                categoryName = Array.isArray(catData) ? (catData[0]?.name || '') : ((catData as any).name || '')
            }
            
            // Verificação de Frete Fixo (ISOLADO PARA CLASSE A)
            let fixedRate = 0
            const isClasseA = organization_id === '5111af72-27a5-41fd-8ed9-8c51b78b4fdd'
            
            const normalizedCat = categoryName.toLowerCase()
            const normalizedName = productName.toLowerCase()

            // Isenção de Frete Específica (MEIA)
            const isFreeShipping = isClasseA && (normalizedName === 'meia' || p.id === '0c53e1fe-6660-485f-84c1-f13a0550229a')
            if (isFreeShipping) return

            const isConsorcio = normalizedCat.includes('consórcio') || normalizedName.includes('consórcio')

            if (isClasseA && !isConsorcio) {
                // Busca por termos nas categorias ou no nome do produto
                if (normalizedCat.includes('colch') || normalizedName.includes('colchão') || normalizedName.includes('colchao')) {
                    fixedRate = 450
                } else if (normalizedCat.includes('box') || normalizedName.includes('box')) {
                    fixedRate = 300
                } else if (normalizedCat.includes('cabeceira') || normalizedName.includes('cabeceira')) {
                    fixedRate = 250
                }
            }




            if (fixedRate > 0) {
                fixedShippingTotal += (fixedRate * quantity)
            } else {
                const groupKey = p.origin_zip || '82820-160' // Default fallback
                if (!groups[groupKey]) groups[groupKey] = []

                groups[groupKey].push({
                    id: p.id,
                    width: p.width || 11,
                    height: p.height || 2,
                    length: p.length || 16,
                    weight: p.weight || 0.5,
                    insurance_value: p.price,
                    quantity: quantity
                })
            }
        })


        // 3.5 Se houver APENAS itens com frete fixo
        if (Object.keys(groups).length === 0) {
            return new Response(
                JSON.stringify([{
                    id: 'fixed-delivery',
                    name: fixedShippingTotal === 0 ? 'Frete Grátis' : 'Transportadora Parceira',
                    price: fixedShippingTotal.toFixed(2),
                    delivery_time: 15,
                    company: { 
                        name: 'Classe A Logística', 
                        picture: 'https://clnuievcdnbwqbyqhwys.supabase.co/storage/v1/object/public/logos/classea-icon.png' 
                    },
                    custom_delivery_time: 15
                }]),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 3. Calcular frete para cada grupo (origem)
        const shippingPromises = Object.keys(groups).map(async (originZip) => {
            const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
                    'User-Agent': 'ClasseA Integration (agenciap4d@gmail.com)'
                },
                body: JSON.stringify({
                    from: { postal_code: originZip.replace(/\D/g, '') },
                    to: { postal_code: zip.replace(/\D/g, '') },
                    products: groups[originZip]
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`Erro API Melhor Envio (Origem ${originZip}):`, errorText)
                return []
            }

            return await response.json()
        })

        const allResults = await shippingPromises
        const flatResults = await Promise.all(allResults)

        // 4. Consolidar resultados
        // Se houver apenas uma origem, somamos o frete fixo aos resultados
        if (Object.keys(groups).length === 1) {
            const validResults = (flatResults[0] || []).filter((s: any) => !s.error).map((s: any) => ({
                ...s,
                price: (parseFloat(s.price) + fixedShippingTotal).toFixed(2)
            }))
            
            return new Response(
                JSON.stringify(validResults),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }


        // Se houver múltiplas origens, precisamos somar os fretes por modalidade (ou simplificar)
        // Para simplificar esta primeira versão, vamos agrupar por nome de serviço e empresa
        const consolidated: { [key: string]: any } = {}

        flatResults.forEach((originResult, index) => {
            originResult.forEach((service: any) => {
                if (service.error) return

                const key = `${service.company.name} - ${service.name}`
                if (!consolidated[key]) {
                    consolidated[key] = {
                        id: service.id,
                        name: service.name,
                        price: 0,
                        delivery_time: 0,
                        company: service.company,
                        custom_delivery_time: 0
                    }
                }

                consolidated[key].price += parseFloat(service.price)
                // O tempo de entrega será o maior entre as origens
                consolidated[key].delivery_time = Math.max(consolidated[key].delivery_time, service.delivery_time)
            })
        })

        // 5. Adicionar frete fixo aos resultados consolidados e formatar preço final
        const finalResults = Object.values(consolidated).map(s => ({
            ...s,
            price: (s.price + fixedShippingTotal).toFixed(2)
        })).filter(s => {
            // Opcional: verificar se este serviço está presente em todos os flatResults
            // Por agora, vamos retornar o que foi somado
            return true
        })


        return new Response(
            JSON.stringify(finalResults),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
    }
})
