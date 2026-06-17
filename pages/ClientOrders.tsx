import React, { useEffect, useState } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Package, Clock, HelpCircle } from 'lucide-react';

interface OrderItem {
    id: string;
    product_name: string;
    size_color_label: string;
    quantity: number;
    unit_price: number;
}

interface Order {
    id: string;
    created_at: string;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    status: string;
    tracking_code: string | null;
    items?: OrderItem[];
}

const ClientOrders: React.FC = () => {
    const { profile } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.id) {
            fetchOrders(profile.id);
        }
    }, [profile?.id]);

    const fetchOrders = async (userId: string) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    created_at,
                    total_amount,
                    payment_method,
                    payment_status,
                    status,
                    tracking_code
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Fetch items for each order
                const ordersWithItems = await Promise.all(data.map(async (order) => {
                    const { data: items } = await supabase
                        .from('order_items')
                        .select('id, product_name, size_color_label, quantity, unit_price')
                        .eq('order_id', order.id);
                    return {
                        ...order,
                        items: items || []
                    };
                }));
                setOrders(ordersWithItems);
            }
        } catch (err) {
            console.error('Error fetching client orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'pago':
            case 'concluido':
            case 'entregue':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'pendente':
            case 'processando':
                return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'cancelado':
                return 'bg-rose-50 text-rose-700 border-rose-100';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    return (
        <ClientLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#C5A880]">Meus Pedidos</span>
                    <h2 className="text-3xl font-black text-[#111111] mt-1">Histórico de Compras</h2>
                    <p className="text-slate-500 text-sm mt-1">Acompanhe o andamento de seus pedidos e rastreie suas entregas.</p>
                </div>

                {/* Orders Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#C5A880]"></div>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-12 text-center shadow-sm space-y-4">
                        <Package className="w-12 h-12 text-slate-350 mx-auto" />
                        <div>
                            <h4 className="text-base font-bold text-[#111111]">Nenhum pedido encontrado</h4>
                            <p className="text-slate-400 text-xs mt-1">Você ainda não realizou compras em nossa loja.</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-white rounded-[2rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
                                {/* Top info bar */}
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-50 pb-6">
                                    <div className="flex flex-wrap gap-4 md:gap-8 text-xs">
                                        <div>
                                            <p className="text-slate-450 font-bold uppercase tracking-wider mb-1">Pedido ID</p>
                                            <p className="font-black text-[#111111]">{order.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-450 font-bold uppercase tracking-wider mb-1">Realizado em</p>
                                            <p className="font-medium text-slate-700 flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {new Date(order.created_at).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-slate-450 font-bold uppercase tracking-wider mb-1">Valor Total</p>
                                            <p className="font-black text-[#111111]">R$ {order.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                </div>

                                {/* Items details */}
                                <div className="space-y-4">
                                    {order.items?.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between text-sm py-1">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                                                    <Package className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-[#111111]">{item.product_name}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">Tamanho/Cor: {item.size_color_label}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-[#111111]">R$ {item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                <p className="text-xs text-slate-400 mt-0.5">Qtd: {item.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Tracking Info */}
                                {order.tracking_code && (
                                    <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3 border border-slate-100/50">
                                        <Clock className="w-4 h-4 text-[#C5A880]" />
                                        <p className="text-xs font-medium text-slate-700">
                                            Código de Rastreamento: <span className="font-bold text-[#111111] select-all">{order.tracking_code}</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ClientLayout>
    );
};

export default ClientOrders;
