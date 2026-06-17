
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const AdminLoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Authenticate with Supabase
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) throw authError;

            // 2. Check Role in user_profiles
            const { data: profile, error: profileError } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (profileError) throw new Error('Falha ao verificar permissões de acesso.');

            if (profile?.role !== 'admin') {
                // Not an admin - Force Logout
                await supabase.auth.signOut();
                toast.error('Acesso negado. Esta área é restrita a administradores.');
                setIsLoading(false);
                return;
            }

            // 3. Success
            toast.success('Autenticação realizada com sucesso!');
            navigate('/admin/dashboard');

        } catch (error: any) {
            console.error('Admin Login Error:', error);
            toast.error(error.message || 'Erro ao realizar login. Verifique suas credenciais.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#05080F] flex items-center justify-center p-6 font-['Inter',_sans-serif]">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#FBC02D]/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="w-full max-w-[440px] relative z-10 transition-all duration-700 animate-in fade-in slide-in-from-bottom-8">
                {/* Logo/Icon Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 border border-white/10 rounded-[2rem] mb-6 backdrop-blur-xl group">
                        <ShieldAlert className="w-10 h-10 text-[#FBC02D] transition-transform duration-500 group-hover:scale-110" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2 uppercase">Urbano Store</h1>
                    <div className="flex items-center justify-center gap-2">
                        <div className="h-px w-8 bg-white/10"></div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Ambiente Restrito</span>
                        <div className="h-px w-8 bg-white/10"></div>
                    </div>
                </div>

                {/* Login Card */}
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 md:p-10 backdrop-blur-2xl shadow-2xl relative overflow-hidden group">
                    {/* Glowing border effect */}
                    <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#FBC02D]/50 to-transparent opacity-50"></div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Username Field */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail Administrativo</label>
                            <div className="relative group/input">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-[#FBC02D] transition-colors">
                                    <User className="w-5 h-5" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="admin@urbanostore.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-white placeholder:text-slate-600 outline-none focus:border-[#FBC02D]/50 focus:bg-white/10 transition-all font-medium"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha de Acesso</label>
                            </div>
                            <div className="relative group/input">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-[#FBC02D] transition-colors">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-14 text-white placeholder:text-slate-600 outline-none focus:border-[#FBC02D]/50 focus:bg-white/10 transition-all font-medium"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#FBC02D] hover:bg-[#ffcd54] text-[#05080F] py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 group shadow-xl shadow-[#FBC02D]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? (
                                <div className="w-6 h-6 border-4 border-[#05080F]/20 border-t-[#05080F] rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    AUTENTICAR ACESSO
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer Warning */}
                    <div className="mt-8 flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                        <p className="text-[10px] leading-relaxed text-slate-400 font-medium">
                            Conexão segura e criptografada (SSL). Tentativas de acesso não autorizado serão registradas.
                        </p>
                    </div>
                </div>

                {/* Return Note (Optional/Hidden) */}
                <div className="mt-10 text-center">
                    <p className="text-slate-600 text-xs font-medium">
                        © 2026 Urbano Store - Sistema de Gestão Interna
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminLoginPage;
