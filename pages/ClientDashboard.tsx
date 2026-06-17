import React, { useEffect, useState } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { ShoppingBag, UserCheck, Heart, ArrowRight } from 'lucide-react';
import { useWishlist } from '../components/WishlistContext';

const ClientDashboard: React.FC = () => {
    const { profile } = useAuth();
    const { wishlistCount } = useWishlist();
    const [stats, setStats] = useState({
        ordersCount: 0,
        profilesCount: 0,
        wishlistCount: 0
    });

    useEffect(() => {
        if (profile?.id) {
            fetchStats(profile.id);
        }
    }, [profile?.id]);

    const fetchStats = async (userId: string) => {
        try {
            // Count Orders
            const { count: ordersCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Count Body Profiles
            const { count: profilesCount } = await supabase
                .from('user_body_profiles')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Set placeholder for wishlist (or count actual favorites if implemented)
            setStats({
                ordersCount: ordersCount || 0,
                profilesCount: profilesCount || 0,
                wishlistCount: 0 // Will implement actual query if we support wishlist table
            });
        } catch (err) {
            console.error('Error fetching client stats:', err);
        }
    };

    return (
        <ClientLayout>
            <div className="space-y-8">
                {/* Greeting Header */}
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#C5A880]">Área do Cliente</span>
                    <h2 className="text-3xl font-black text-[#111111] mt-1">Olá, {profile?.full_name?.split(' ')[0] || 'Cliente'}!</h2>
                    <p className="text-slate-500 text-sm mt-1">Bem-vindo à sua área exclusiva. Gerencie suas compras e perfil de medidas.</p>
                </div>

                {/* Stats Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-[#111111]">{stats.ordersCount}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pedidos Feitos</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#C5A880]/10 text-[#C5A880] flex items-center justify-center">
                            <UserCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-[#111111]">{stats.profilesCount}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Perfis Corporais</p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
                            <Heart className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-[#111111]">{wishlistCount}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Meus Favoritos</p>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Size Recommender / Virtual Fitting Box */}
                    <div className="bg-[#020204] text-white p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col justify-between h-72">
                        {/* Glow decorative layer */}
                        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-[#C5A880]/20 rounded-full blur-3xl"></div>
                        <div className="space-y-4">
                            <span className="inline-block bg-[#C5A880]/15 text-[#C5A880] text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded">
                                Provador Inteligente
                            </span>
                            <h3 className="text-xl md:text-2xl font-black max-w-xs leading-tight">
                                Configure suas medidas corporais e compre o tamanho exato.
                            </h3>
                            <p className="text-slate-400 text-xs max-w-sm">
                                O assistente inteligente analisará suas dimensões para indicar se o tamanho P, M, G ou GG terá o caimento perfeito.
                            </p>
                        </div>
                        <Link
                            to="/dashboard/body-profiles"
                            className="bg-[#C5A880] hover:bg-[#B59870] text-[#111111] font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all self-start flex items-center gap-2"
                        >
                            Gerenciar Medidas
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>

                    {/* Quick Access List */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-72">
                        <div>
                            <h3 className="text-lg font-black text-[#111111] mb-6">Atalhos da Conta</h3>
                            <div className="space-y-4">
                                <Link to="/dashboard/orders" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-[#C5A880]/5 rounded-2xl transition-all group">
                                    <span className="text-sm font-bold text-[#111111]">Verificar histórico de pedidos</span>
                                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <Link to="/shop" className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-[#C5A880]/5 rounded-2xl transition-all group">
                                    <span className="text-sm font-bold text-[#111111]">Ir para a vitrine de produtos</span>
                                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center">
                            Urbano Store • Moda & Tecnologia IA
                        </p>
                    </div>
                </div>
            </div>
        </ClientLayout>
    );
};

export default ClientDashboard;
