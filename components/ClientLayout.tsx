import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    ShoppingBag,
    UserCheck,
    Heart,
    LogOut,
    Menu,
    X,
    ChevronRight,
    User
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface ClientLayoutProps {
    children: React.ReactNode;
}

const ClientLayout: React.FC<ClientLayoutProps> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            toast.success('Sessão encerrada com sucesso!');
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
            toast.error('Erro ao sair da conta.');
        }
    };

    const menuItems = [
        { label: 'Visão Geral', icon: LayoutDashboard, path: '/dashboard' },
        { label: 'Meus Pedidos', icon: ShoppingBag, path: '/dashboard/orders' },
        { label: 'Perfil Corporal', icon: UserCheck, path: '/dashboard/body-profiles' },
        { label: 'Favoritos', icon: Heart, path: '/dashboard/wishlist' },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden bg-[#020204] text-white p-4 flex items-center justify-between border-b border-white/5">
                <Link to="/" className="flex items-center">
                    <img src="/assets/logo.png" alt="Urbano Store" className="h-10 w-auto object-contain" />
                </Link>
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 text-slate-200 hover:text-[#C5A880] transition-colors"
                >
                    {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Sidebar Container */}
            <aside className={`
                w-72 bg-[#020204] flex flex-col p-6 text-white fixed md:sticky md:top-0 h-screen z-50 transition-transform duration-300 md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo Area */}
                <div className="mb-10 px-2 flex items-center justify-between">
                    <Link to="/" className="flex items-center">
                        <img src="/assets/logo.png" alt="Urbano Store" className="h-14 w-auto object-contain" />
                    </Link>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-white p-2">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Profile Widget */}
                <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#C5A880]/20 text-[#C5A880] flex items-center justify-center shrink-0 font-bold uppercase">
                        {profile?.full_name?.charAt(0) || <User className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-black truncate text-white">{profile?.full_name || 'Cliente'}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Conta Cliente</p>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <nav className="flex-grow space-y-2">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.label}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-wider group ${isActive
                                    ? 'bg-[#C5A880] text-[#111111]'
                                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <item.icon className="w-4 h-4 shrink-0" />
                                {item.label}
                                {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="mt-auto pt-6 border-t border-white/10">
                    <Link
                        to="/shop"
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white mb-3 text-center transition-all"
                    >
                        Voltar para a Loja
                    </Link>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-red-400 hover:bg-red-400/10 transition-all w-full text-left"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair da Conta
                    </button>
                </div>
            </aside>

            {/* Sidebar Overlay (Mobile) */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-45 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Content Area */}
            <main className="flex-grow p-6 md:p-10 max-w-7xl mx-auto w-full">
                {children}
            </main>
        </div>
    );
};

export default ClientLayout;
