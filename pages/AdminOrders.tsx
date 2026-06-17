import React, { useState, useEffect } from 'react';
import {
    ShoppingBag,
    Search,
    Filter,
    Calendar,
    ChevronRight,
    Loader2,
    Eye,
    CheckCircle2,
    Truck,
    Package,
    XCircle,
    User,
    CreditCard,
    ArrowUpRight,
    Clock,
    DollarSign
} from 'lucide-react';
import { ORGANIZATION_ID } from '../lib/config';
import { useAuth } from '../components/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface Order {
    id: string;
    customer_name: string;
    total_amount: number;
    status: 'Pendente' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado' | 'pending' | 'shipped' | 'completed' | 'cancelled';
    payment_status: 'pending' | 'paid' | 'failed';
    created_at: string;
    items_count: number;
    payment_method: string;
}

const AdminOrders: React.FC = () => {
    const { profile } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed' | 'shipped' | 'cancelled'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ordersPerPage = 10;

    useEffect(() => {
        fetchOrders();
    }, [profile?.tenant_id]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter]);

    const fetchOrders = async () => {
        const tenantId = profile?.tenant_id || ORGANIZATION_ID;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
            toast.error('Erro ao carregar pedidos.');
        } finally {
            setIsLoading(false);
        }
    };

    const updateOrderStatus = async (orderId: string, newStatus: Order['status'], paymentStatus?: Order['payment_status']) => {
        try {
            const updateData: any = { 
                status: newStatus,
                updated_at: new Date().toISOString()
            };
            
            if (paymentStatus) {
                updateData.payment_status = paymentStatus;
                if (paymentStatus === 'paid') {
                    updateData.payment_status_detail = 'Accreditated Manual';
                }
            }

            const { error } = await supabase
                .from('orders')
                .update(updateData)
                .eq('id', orderId);

            if (error) throw error;
            toast.success(`Pedido atualizado para ${newStatus}!`);
            fetchOrders();
        } catch (error) {
            console.error('Error updating order status:', error);
            toast.error('Erro ao atualizar status.');
        }
    };

    const filteredOrders = orders.filter(order => {
        const matchesSearch = order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            order.id.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchesStatus = true;
        if (statusFilter !== 'all') {
            if (statusFilter === 'pending') {
                matchesStatus = order.status === 'pending' || order.status === 'Pendente';
            } else if (statusFilter === 'shipped') {
                matchesStatus = order.status === 'shipped' || order.status === 'Enviado';
            } else if (statusFilter === 'completed') {
                matchesStatus = order.status === 'completed' || order.status === 'Pago' || order.status === 'Entregue';
            } else if (statusFilter === 'cancelled') {
                matchesStatus = order.status === 'cancelled' || order.status === 'Cancelado';
            }
        }
        
        return matchesSearch && matchesStatus;
    });

    // Pagination calculations
    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const paginatedOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

    const stats = {
        total: orders.length,
        pending: orders.filter(o => o.status === 'pending' || o.status === 'Pendente').length,
        revenue: orders.filter(o => o.status === 'completed' || o.status === 'Pago' || o.status === 'Entregue').reduce((acc, curr) => acc + curr.total_amount, 0),
        shipped: orders.filter(o => o.status === 'shipped' || o.status === 'Enviado').length
    };

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                    <Loader2 className="w-10 h-10 text-[#FBC02D] animate-spin" />
                    <p className="font-bold text-slate-400">Carregando pedidos...</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-[#05080F]">Gestão de Pedidos</h1>
                        <p className="text-slate-500 font-medium text-sm md:text-base">Acompanhe as vendas e status de entrega em tempo real.</p>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Pedidos', value: stats.total, icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
                        { label: 'Pendentes', value: stats.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
                        { label: 'Enviados', value: stats.shipped, icon: Truck, color: 'text-purple-500', bg: 'bg-purple-50' },
                        { label: 'Receita Total', value: `R$ ${stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    ].map((card, i) => (
                        <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                            <div className={`w-12 h-12 ${card.bg} rounded-2xl flex items-center justify-center mb-4`}>
                                <card.icon className={`w-6 h-6 ${card.color}`} />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{card.label}</p>
                            <h3 className="text-xl font-black text-[#05080F]">{card.value}</h3>
                        </div>
                    ))}
                </div>

                {/* Filters & Table */}
                <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-50">
                        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
                            <h3 className="text-lg md:text-xl font-black text-[#05080F]">Fila de Pedidos</h3>

                            <div className="flex flex-col sm:flex-row w-full xl:w-auto gap-4">
                                <div className="relative flex-1 sm:min-w-[320px]">
                                    <input
                                        type="text"
                                        placeholder="Buscar por cliente ou ID do pedido..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-10 outline-none text-[10px] md:text-xs font-medium focus:border-[#FBC02D] transition-all"
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                </div>
                                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 overflow-x-auto no-scrollbar">
                                    {(['all', 'pending', 'shipped', 'completed', 'cancelled'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setStatusFilter(f)}
                                            className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-white shadow-sm text-[#05080F]' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {f === 'all' ? 'Ver Todos' : f === 'pending' ? 'Pendentes' : f === 'shipped' ? 'Enviados' : f === 'completed' ? 'Finalizados' : 'Cancelados'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-50">
                                    <th className="text-left py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">ID / Cliente</th>
                                    <th className="text-left py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Data</th>
                                    <th className="text-left py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Pagamento</th>
                                    <th className="text-left py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Valor Total</th>
                                    <th className="text-left py-6 px-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Status</th>
                                    <th className="text-right py-6 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {paginatedOrders.length > 0 ? paginatedOrders.map((order) => (
                                    <tr key={order.id} className="group hover:bg-slate-50/30 transition-all">
                                        <td className="py-6 px-6">
                                            <div>
                                                <p className="font-black text-[#05080F] text-sm">{order.customer_name || 'Cliente'}</p>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">#{order.id.replace(/^#/, '').slice(0, 8)}</p>
                                            </div>
                                        </td>
                                        <td className="py-6 px-4">
                                            <p className="text-slate-500 font-bold text-xs">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                                            <p className="text-[10px] text-slate-400 font-medium">{new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </td>
                                        <td className="py-6 px-4">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                    {order.payment_status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                    {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                                                </span>
                                                <p className="text-[10px] font-medium text-slate-400">{order.payment_method}</p>
                                            </div>
                                        </td>
                                        <td className="py-6 px-4">
                                            <p className="font-black text-[#05080F]">R$ {order.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{order.items_count} Itens</p>
                                        </td>
                                        <td className="py-6 px-4">
                                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                order.status === 'completed' || order.status === 'Pago' || order.status === 'Entregue' ? 'bg-emerald-50 text-emerald-600' :
                                                order.status === 'Enviado' || order.status === 'shipped' ? 'bg-purple-50 text-purple-600' :
                                                order.status === 'Cancelado' || order.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${
                                                    order.status === 'completed' || order.status === 'Pago' || order.status === 'Entregue' ? 'bg-emerald-500' :
                                                    order.status === 'Enviado' || order.status === 'shipped' ? 'bg-purple-500' :
                                                    order.status === 'Cancelado' || order.status === 'cancelled' ? 'bg-red-500' : 'bg-amber-500'
                                                }`}></div>
                                                {order.status === 'pending' || order.status === 'Pendente' ? 'Pendente' :
                                                 order.status === 'shipped' || order.status === 'Enviado' ? 'Enviado' :
                                                 order.status === 'completed' || order.status === 'Pago' || order.status === 'Entregue' ? 'Concluído' : 'Cancelado'}
                                            </span>
                                        </td>
                                        <td className="py-6 px-6 text-right">
                                            <div className="flex flex-col gap-2">
                                                {(order.status === 'Pendente' || order.status === 'pending') && (
                                                    <>
                                                        <button 
                                                            onClick={() => updateOrderStatus(order.id, 'Pago', 'paid')}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase hover:bg-emerald-600 transition-all"
                                                            title="Marcar como Pago"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                                            PAGO
                                                        </button>
                                                        <button 
                                                            onClick={() => updateOrderStatus(order.id, 'Cancelado')}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase hover:bg-red-100 transition-all"
                                                            title="Cancelar Pedido"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                            CANCELAR
                                                        </button>
                                                    </>
                                                )}
                                                {(order.status === 'Pago' || order.status === 'completed') && (
                                                    <button 
                                                        onClick={() => updateOrderStatus(order.id, 'Enviado')}
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-[#05080F] text-white rounded-lg text-[9px] font-black uppercase hover:bg-slate-800 transition-all"
                                                        title="Marcar como Enviado"
                                                    >
                                                        <Truck className="w-3.5 h-3.5" />
                                                        ENVIAR
                                                    </button>
                                                )}
                                                <button className="flex items-center justify-center p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-[#05080F] transition-all">
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-4 text-slate-400">
                                                <ShoppingBag className="w-12 h-12 opacity-20" />
                                                <p className="font-bold">Nenhum pedido encontrado.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Control */}
                    {totalPages > 1 && (
                        <div className="p-6 md:p-8 bg-slate-50/30 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Página {currentPage} de {totalPages} — {filteredOrders.length} Pedidos
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white disabled:opacity-30 transition-all hover:bg-slate-50"
                                >
                                    Anterior
                                </button>
                                <div className="flex items-center gap-1">
                                    {[...Array(totalPages)].map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i + 1)}
                                            className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${currentPage === i + 1 ? 'bg-[#FBC02D] text-white' : 'hover:bg-slate-50 text-slate-400'}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white disabled:opacity-30 transition-all hover:bg-slate-50"
                                >
                                    Próximo
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminOrders;
