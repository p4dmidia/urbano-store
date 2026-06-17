import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, Mail, Lock, User, 
    Sparkles, Check, ArrowRight, Loader2,
    Shield, Cpu, Zap, ShoppingCart
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const RegisterMerchantPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'starter' | 'growth' | 'pro'>('starter');
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        storeName: '',
        storeSlug: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAutoSlug = (storeName: string) => {
        const slug = storeName
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
            .replace(/\s+/g, "-") // collapse whitespace and replace by -
            .replace(/-+/g, "-"); // collapse dashes
        setFormData(prev => ({
            ...prev,
            storeName,
            storeSlug: slug
        }));
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.fullName || !formData.email || !formData.password || !formData.storeName || !formData.storeSlug) {
            toast.error("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }

        setLoading(true);

        try {
            // 1. Chamar o onboarding no billing-engine
            const { data, error } = await supabase.functions.invoke('billing-engine/tenants', {
                body: {
                    email: formData.email,
                    password: formData.password,
                    full_name: formData.fullName,
                    tenant_name: formData.storeName,
                    tenant_slug: formData.storeSlug
                }
            });

            if (error || !data?.success) {
                throw new Error(error?.message || data?.error || 'Erro ao registrar loja.');
            }

            // 2. Realizar login automático do novo lojista
            const { error: loginError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password
            });

            if (loginError) {
                toast.success('Loja criada! Redirecionando para login...');
                navigate('/admin/login');
                return;
            }

            // 3. Se for plano diferente do Starter (Growth ou Pro), realizar atualização
            if (selectedPlan !== 'starter') {
                const newPlanId = selectedPlan === 'growth' 
                    ? 'b111af72-27a5-41fd-8ed9-8c51b78b4fb2' 
                    : 'c111af72-27a5-41fd-8ed9-8c51b78b4fc3';

                await supabase.functions.invoke('billing-engine/subscription/change-plan', {
                    body: {
                        tenant_id: data.tenant_id,
                        plan_id: newPlanId
                    }
                });
            }

            toast.success('Conta de Lojista ativada com sucesso! Bem-vindo.');
            
            // Força um pequeno delay para que o perfil seja propagado nas tabelas
            setTimeout(() => {
                navigate('/admin/dashboard');
            }, 1500);

        } catch (err: any) {
            console.error('Merchant registration error:', err);
            toast.error(err.message || 'Falha ao registrar loja. Tente outra slug.');
        } finally {
            setLoading(false);
        }
    };

    const plans = [
        {
            id: 'starter',
            name: 'Starter',
            price: 'R$ 99',
            description: 'Ideal para lojas de moda iniciantes.',
            features: ['Até 100 produtos cadastrados', '500 renders do Provador/mês', 'Suporte por E-mail', 'Provador IA L1 Cache'],
            icon: Zap,
            color: 'border-slate-100 hover:border-slate-300'
        },
        {
            id: 'growth',
            name: 'Growth',
            price: 'R$ 199',
            description: 'Para lojas em ritmo de crescimento acelerado.',
            features: ['Até 1.000 produtos cadastrados', '5.000 renders do Provador/mês', 'Outfit Engine (Looks Completos)', 'Suporte Prioritário WhatsApp', 'Multi-dimensional Cache L2'],
            icon: Cpu,
            color: 'border-slate-100 hover:border-slate-300'
        },
        {
            id: 'pro',
            name: 'Pro Enterprise',
            price: 'R$ 499',
            description: 'Escala total sem limites de renders.',
            features: ['Produtos ilimitados', 'Renders VTON ilimitados', 'Outfit Engine Premium', 'Analytics Avançado & CRO Engine', 'Gerente de Contas Dedicado', 'Customização Visual do Provador'],
            icon: Sparkles,
            color: 'border-[#FBC02D]/30 shadow-md shadow-[#FBC02D]/5'
        }
    ];

    return (
        <div className="bg-[#05080F] min-h-screen text-white font-sans flex flex-col justify-between">
            {/* Header / Branding */}
            <header className="px-8 py-6 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-[#FBC02D]" />
                    <span className="font-black text-lg uppercase tracking-wider text-white">Fashion Mall <span className="text-[#FBC02D]">SaaS</span></span>
                </div>
                <button 
                    onClick={() => navigate('/login')}
                    className="text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
                >
                    Entrar como Cliente
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex items-center justify-center py-16 px-4 md:px-8">
                <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    
                    {/* Left side: Value proposition */}
                    <div className="lg:col-span-5 space-y-8 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 bg-[#FBC02D]/10 border border-[#FBC02D]/20 text-[#FBC02D] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
                            <Sparkles className="w-3.5 h-3.5 fill-current" /> Plano de Expansão SaaS
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight text-white">
                            Leve o provador virtual para a sua <span className="text-[#FBC02D]">loja de moda</span>.
                        </h1>
                        <p className="text-slate-400 text-sm md:text-base leading-relaxed font-medium">
                            Nossa tecnologia de Inteligência Artificial VTON e recomendação de look completo integrada diretamente ao seu catálogo de roupas. Venda mais, reduza devoluções e aumente o ticket médio da sua marca.
                        </p>
                        <div className="flex flex-col gap-4 text-left">
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                                <span className="text-xs font-bold text-slate-300">Isolamento absoluto de dados entre inquilinos.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                                <span className="text-xs font-bold text-slate-300">Gateway de faturamento recorrente integrado.</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                </div>
                                <span className="text-xs font-bold text-slate-300">Painel exclusivo para controle de estoque, vendas e estatísticas.</span>
                            </div>
                        </div>
                    </div>

                    {/* Right side: Multistep Register Form */}
                    <div className="lg:col-span-7 bg-[#0B1221] rounded-[2.5rem] border border-slate-800 p-8 md:p-10 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FBC02D]/5 blur-3xl rounded-full translate-x-12 -translate-y-12"></div>
                        
                        <form onSubmit={handleRegister} className="space-y-8 relative z-10">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-white">Abra a sua Loja</h2>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Onboarding de novo inquilino comercial</p>
                            </div>

                            {/* Section 1: Plan selection cards */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Escolha seu plano SaaS</label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {plans.map((p) => {
                                        const PlanIcon = p.icon;
                                        const isSelected = selectedPlan === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setSelectedPlan(p.id as any)}
                                                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                                                    isSelected 
                                                    ? 'bg-white/5 border-[#FBC02D] text-white shadow-lg' 
                                                    : 'bg-white/[0.02] border-slate-800 text-slate-400 hover:border-slate-700'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex justify-between items-center">
                                                        <PlanIcon className={`w-5 h-5 ${isSelected ? 'text-[#FBC02D]' : 'text-slate-500'}`} />
                                                        {isSelected && (
                                                            <div className="w-4 h-4 bg-[#FBC02D] rounded-full flex items-center justify-center text-[#0B1221]">
                                                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h3 className="font-black text-xs uppercase tracking-wider text-white mt-3">{p.name}</h3>
                                                    <p className="text-[9px] font-bold text-slate-500 mt-1">{p.description}</p>
                                                </div>
                                                <p className="text-sm font-black text-white mt-4">{p.price}<span className="text-[10px] text-slate-500 font-bold">/mês</span></p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section 2: Input fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Nome Completo</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="text" name="fullName" required
                                            value={formData.fullName} onChange={handleChange}
                                            className="w-full bg-white/[0.03] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="Ex: Amanda Santos"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">E-mail de Acesso</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="email" name="email" required
                                            value={formData.email} onChange={handleChange}
                                            className="w-full bg-white/[0.03] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="amanda@loja.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Nome da Loja</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="text" name="storeName" required
                                            value={formData.storeName}
                                            onChange={(e) => handleAutoSlug(e.target.value)}
                                            className="w-full bg-white/[0.03] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="Ex: Amanda Boutique"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Slug da URL (Único)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs select-none">/t/</span>
                                        <input
                                            type="text" name="storeSlug" required
                                            value={formData.storeSlug}
                                            onChange={(e) => setFormData({ ...formData, storeSlug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                            className="w-full bg-white/[0.03] border border-slate-800 rounded-2xl py-4 pl-10 pr-4 font-bold text-white outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="amanda-boutique"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="password" name="password" required
                                            value={formData.password} onChange={handleChange}
                                            className="w-full bg-white/[0.03] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="********"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Confirmar Senha</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="password" name="confirmPassword" required
                                            value={formData.confirmPassword} onChange={handleChange}
                                            className="w-full bg-white/[0.03] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 font-bold text-white outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="********"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-5 bg-[#FBC02D] hover:bg-[#f9b100] text-[#05080F] rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-3 uppercase tracking-widest shadow-lg shadow-[#FBC02D]/10 disabled:opacity-50"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Criando Loja & Conta...
                                    </>
                                ) : (
                                    <>
                                        Criar minha loja e ativar provador
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="px-8 py-6 border-t border-slate-900 text-center text-[10px] text-slate-500 uppercase tracking-widest max-w-7xl mx-auto w-full">
                Fashion Mall SaaS © 2026 - Todos os direitos reservados.
            </footer>
        </div>
    );
};

export default RegisterMerchantPage;
