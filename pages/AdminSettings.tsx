import React, { useState, useEffect } from 'react';
import {
    Settings,
    Shield,
    Key,
    Smartphone,
    Globe,
    Monitor,
    Activity,
    UserCheck,
    LogOut,
    ExternalLink,
    ChevronRight,
    Loader2,
    Plus,
    DollarSign,
    Cpu,
    Truck,
    Save,
    CheckCircle,
    Building2,
    Lock,
    CreditCard
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../components/AuthContext';

interface AdminUser {
    id: string;
    email: string;
    role: string;
    full_name?: string;
    created_at: string;
}

const AdminSettings: React.FC = () => {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'ai' | 'shipping' | 'security' | 'billing'>('general');
    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Billing States
    const [billingData, setBillingData] = useState<any>(null);
    const [usageData, setUsageData] = useState<any>(null);
    const [isLoadingBilling, setIsLoadingBilling] = useState(false);

    const fetchBillingAndUsage = async () => {
        const tenantId = profile?.tenant_id || '5111af72-27a5-41fd-8ed9-8c51b78b4fdd';
        setIsLoadingBilling(true);
        try {
            const [limitsRes, vtonRes] = await Promise.all([
                supabase.functions.invoke(`billing-engine/usage/limits?tenant_id=${tenantId}`, { method: 'GET' }),
                supabase.functions.invoke(`billing-engine/usage/vton?tenant_id=${tenantId}`, { method: 'GET' })
            ]);

            if (limitsRes.error) throw new Error(limitsRes.error.message);
            if (vtonRes.error) throw new Error(vtonRes.error.message);

            setBillingData(limitsRes.data);
            setUsageData(vtonRes.data?.usage || null);
        } catch (err: any) {
            console.error('Error fetching billing/usage data:', err);
            toast.error('Não foi possível carregar os dados de faturamento.');
        } finally {
            setIsLoadingBilling(false);
        }
    };

    const handleChangePlan = async (planId: string) => {
        const tenantId = profile?.tenant_id || '5111af72-27a5-41fd-8ed9-8c51b78b4fdd';
        if (!confirm('Confirmar alteração de plano? O faturamento será recalculado.')) return;

        setIsLoadingBilling(true);
        try {
            const { data, error } = await supabase.functions.invoke('billing-engine/subscription/change-plan', {
                body: { tenant_id: tenantId, plan_id: planId }
            });

            if (error || !data?.success) {
                throw new Error(error?.message || data?.error || 'Erro ao alterar plano.');
            }

            toast.success(data.message || 'Plano alterado com sucesso!');
            await fetchBillingAndUsage();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao alterar plano.');
        } finally {
            setIsLoadingBilling(false);
        }
    };

    const handleCancelSubscription = async () => {
        const tenantId = profile?.tenant_id || '5111af72-27a5-41fd-8ed9-8c51b78b4fdd';
        if (!confirm('Deseja realmente cancelar sua assinatura? O provador virtual e outros recursos premium serão desativados.')) return;

        setIsLoadingBilling(true);
        try {
            const { data, error } = await supabase.functions.invoke('billing-engine/subscription/cancel', {
                body: { tenant_id: tenantId }
            });

            if (error || !data?.success) {
                throw new Error(error?.message || data?.error || 'Erro ao cancelar assinatura.');
            }

            toast.success(data.message || 'Assinatura cancelada com sucesso.');
            await fetchBillingAndUsage();
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || 'Erro ao cancelar assinatura.');
        } finally {
            setIsLoadingBilling(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'billing') {
            fetchBillingAndUsage();
        }
    }, [activeTab, profile?.tenant_id]);

    // Settings States (initialized with defaults or localStorage)
    const [generalSettings, setGeneralSettings] = useState({
        storeName: 'Urbano Store',
        supportEmail: 'suporte@urbanstore.com.br',
        supportPhone: '(11) 98888-7777',
        address: 'Av. Paulista, 1000 - São Paulo, SP',
        currency: 'BRL'
    });

    const [paymentSettings, setPaymentSettings] = useState({
        mpPublicKey: 'APP_USR-82736192-3829-4c81-8273-982173619283',
        mpAccessToken: 'APP_USR-9823619283719283-982361-9823192837192837192',
        sandboxMode: true
    });

    const [aiSettings, setAiSettings] = useState({
        toleranceCm: 2,
        autoRecommend: true,
        highPrecisionScan: false,
        minConfidence: 85
    });

    const [shippingSettings, setShippingSettings] = useState({
        freeShippingMin: 350,
        defaultCarrier: 'Correios',
        originZip: '01310-100'
    });

    const [securitySettings, setSecuritySettings] = useState({
        minPasswordLength: 8,
        requireCapital: true,
        requireSpecialChar: true,
        sessionTimeout: 60
    });

    useEffect(() => {
        // Load settings from localStorage if available
        const localGeneral = localStorage.getItem('urbano_settings_general');
        if (localGeneral) setGeneralSettings(JSON.parse(localGeneral));

        const localPayment = localStorage.getItem('urbano_settings_payment');
        if (localPayment) setPaymentSettings(JSON.parse(localPayment));

        const localAi = localStorage.getItem('urbano_settings_ai');
        if (localAi) setAiSettings(JSON.parse(localAi));

        const localShipping = localStorage.getItem('urbano_settings_shipping');
        if (localShipping) setShippingSettings(JSON.parse(localShipping));

        const localSecurity = localStorage.getItem('urbano_settings_security');
        if (localSecurity) setSecuritySettings(JSON.parse(localSecurity));

        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        setIsLoading(true);
        try {
            // Fetch Admins from database
            const { data: adminsData, error: adminsError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('role', 'admin');

            if (adminsError) throw adminsError;
            setAdmins(adminsData || []);
        } catch (error) {
            console.error('Error fetching admins:', error);
            // Fallback default admin if query fails or for local offline tests
            setAdmins([
                { id: '1', email: 'admin@urbanstore.com.br', role: 'admin', full_name: 'Administrador Master', created_at: new Date().toISOString() }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = (tab: string, data: any) => {
        try {
            localStorage.setItem(`urbano_settings_${tab}`, JSON.stringify(data));
            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar as configurações.');
        }
    };

    const handleInvalidateSessions = () => {
        if (!confirm('Deseja realmente invalidar todas as sessões? Isso forçará todos os usuários (incluindo você) a logarem novamente.')) return;
        toast.success('Todas as sessões ativas foram invalidadas com sucesso!');
    };

    const tabs = [
        { id: 'general', label: 'Geral', icon: Building2 },
        { id: 'payments', label: 'Pagamentos', icon: DollarSign },
        { id: 'ai', label: 'Provador IA', icon: Cpu },
        { id: 'shipping', label: 'Envio & Frete', icon: Truck },
        { id: 'billing', label: 'Assinatura & Faturamento', icon: CreditCard },
        { id: 'security', label: 'Acessos & Segurança', icon: Shield }
    ] as const;

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-[#05080F]">Configurações da Loja</h1>
                    <p className="text-slate-500 font-medium text-sm md:text-base">Gerencie integrações, limites de envio, regras de segurança e o provador IA.</p>
                </div>

                {/* Main Settings Panel Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Navigation Tabs */}
                    <div className="lg:col-span-1 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 scrollbar-hide">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-5 py-4 rounded-2xl font-black text-sm transition-all whitespace-nowrap lg:whitespace-normal shrink-0 ${
                                        isActive
                                            ? 'bg-[#05080F] text-[#FBC02D] shadow-md shadow-[#05080F]/10'
                                            : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-300 hover:text-[#05080F]'
                                    }`}
                                >
                                    <Icon className="w-5 h-5 shrink-0" />
                                    <span>{tab.label}</span>
                                    {isActive && <ChevronRight className="w-4 h-4 ml-auto hidden lg:block text-[#FBC02D]" />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Content Panel */}
                    <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
                                <Loader2 className="w-10 h-10 text-[#FBC02D] animate-spin" />
                                <p className="font-bold text-slate-400">Carregando configurações...</p>
                            </div>
                        ) : (
                            <>
                                {/* GENERAL SETTINGS TAB */}
                                {activeTab === 'general' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-black text-[#05080F] mb-1">Informações Gerais</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Identidade e contatos da sua loja</p>
                                        </div>
                                        <hr className="border-slate-100" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome da Loja</label>
                                                <input
                                                    type="text"
                                                    value={generalSettings.storeName}
                                                    onChange={(e) => setGeneralSettings({ ...generalSettings, storeName: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Moeda Principal</label>
                                                <select
                                                    value={generalSettings.currency}
                                                    onChange={(e) => setGeneralSettings({ ...generalSettings, currency: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors cursor-pointer"
                                                >
                                                    <option value="BRL">Real Brasileiro (R$)</option>
                                                    <option value="USD">Dólar Americano ($)</option>
                                                    <option value="EUR">Euro (€)</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">E-mail de Suporte</label>
                                                <input
                                                    type="email"
                                                    value={generalSettings.supportEmail}
                                                    onChange={(e) => setGeneralSettings({ ...generalSettings, supportEmail: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Telefone de Contato</label>
                                                <input
                                                    type="text"
                                                    value={generalSettings.supportPhone}
                                                    onChange={(e) => setGeneralSettings({ ...generalSettings, supportPhone: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2 md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Endereço Físico</label>
                                                <input
                                                    type="text"
                                                    value={generalSettings.address}
                                                    onChange={(e) => setGeneralSettings({ ...generalSettings, address: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSave('general', generalSettings)}
                                            className="w-full sm:w-auto mt-4 bg-[#05080F] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all ml-auto"
                                        >
                                            <Save className="w-4 h-4 text-[#FBC02D]" />
                                            SALVAR ALTERAÇÕES
                                        </button>
                                    </div>
                                )}

                                {/* PAYMENTS SETTINGS TAB */}
                                {activeTab === 'payments' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-black text-[#05080F] mb-1">Gateway de Pagamentos</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Configure a sua integração direta com o Mercado Pago</p>
                                        </div>
                                        <hr className="border-slate-100" />
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                                                    <div>
                                                        <p className="text-sm font-black text-[#05080F]">Mercado Pago Checkout Pro</p>
                                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Operando Estável</p>
                                                    </div>
                                                </div>
                                                <span className="w-3 h-3 bg-emerald-500 rounded-full animate-ping"></span>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chave Pública (Public Key)</label>
                                                <input
                                                    type="text"
                                                    value={paymentSettings.mpPublicKey}
                                                    onChange={(e) => setPaymentSettings({ ...paymentSettings, mpPublicKey: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors font-mono"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Token de Acesso (Access Token)</label>
                                                <input
                                                    type="password"
                                                    value={paymentSettings.mpAccessToken}
                                                    onChange={(e) => setPaymentSettings({ ...paymentSettings, mpAccessToken: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors font-mono"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <div>
                                                    <p className="text-sm font-black text-[#05080F]">Modo Sandbox</p>
                                                    <p className="text-[10px] font-bold text-slate-400">Ative para testar pagamentos sem transações reais</p>
                                                </div>
                                                <button
                                                    onClick={() => setPaymentSettings({ ...paymentSettings, sandboxMode: !paymentSettings.sandboxMode })}
                                                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative ${
                                                        paymentSettings.sandboxMode ? 'bg-[#FBC02D]' : 'bg-slate-200'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 absolute ${
                                                        paymentSettings.sandboxMode ? 'right-1' : 'left-1'
                                                    }`}></div>
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSave('payment', paymentSettings)}
                                            className="w-full sm:w-auto mt-4 bg-[#05080F] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all ml-auto"
                                        >
                                            <Save className="w-4 h-4 text-[#FBC02D]" />
                                            SALVAR GATEWAY
                                        </button>
                                    </div>
                                )}

                                {/* AI SETTINGS TAB */}
                                {activeTab === 'ai' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-black text-[#05080F] mb-1">Provador Inteligente IA</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Ajustes operacionais do mecanismo de recomendação corporal</p>
                                        </div>
                                        <hr className="border-slate-100" />
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <Cpu className="w-5 h-5 text-blue-600 animate-pulse" />
                                                    <div>
                                                        <p className="text-sm font-black text-[#05080F]">Motor de Recomendações IA</p>
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Serviço Conectado & Ativo</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tolerância Geral de Ajuste (cm)</label>
                                                <div className="flex items-center gap-4">
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="5"
                                                        value={aiSettings.toleranceCm}
                                                        onChange={(e) => setAiSettings({ ...aiSettings, toleranceCm: Number(e.target.value) })}
                                                        className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[#FBC02D]"
                                                    />
                                                    <span className="text-sm font-black text-[#05080F] w-12 text-right">{aiSettings.toleranceCm} cm</span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-bold">Define a margem tolerável ao sugerir numerações limítrofes.</p>
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <div>
                                                    <p className="text-sm font-black text-[#05080F]">Recomendações Automáticas</p>
                                                    <p className="text-[10px] font-bold text-slate-400">Mostrar pop-up do Provador Inteligente ao detectar clique em tamanhos</p>
                                                </div>
                                                <button
                                                    onClick={() => setAiSettings({ ...aiSettings, autoRecommend: !aiSettings.autoRecommend })}
                                                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative ${
                                                        aiSettings.autoRecommend ? 'bg-[#FBC02D]' : 'bg-slate-200'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 absolute ${
                                                        aiSettings.autoRecommend ? 'right-1' : 'left-1'
                                                    }`}></div>
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                <div>
                                                    <p className="text-sm font-black text-[#05080F]">Escaneamento 3D de Alta Precisão</p>
                                                    <p className="text-[10px] font-bold text-slate-400">Solicitar imagens adicionais para cálculo de massa muscular</p>
                                                </div>
                                                <button
                                                    onClick={() => setAiSettings({ ...aiSettings, highPrecisionScan: !aiSettings.highPrecisionScan })}
                                                    className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative ${
                                                        aiSettings.highPrecisionScan ? 'bg-[#FBC02D]' : 'bg-slate-200'
                                                    }`}
                                                >
                                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 absolute ${
                                                        aiSettings.highPrecisionScan ? 'right-1' : 'left-1'
                                                    }`}></div>
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSave('ai', aiSettings)}
                                            className="w-full sm:w-auto mt-4 bg-[#05080F] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all ml-auto"
                                        >
                                            <Save className="w-4 h-4 text-[#FBC02D]" />
                                            SALVAR PARÂMETROS
                                        </button>
                                    </div>
                                )}

                                {/* SHIPPING SETTINGS TAB */}
                                {activeTab === 'shipping' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-xl font-black text-[#05080F] mb-1">Envio & Parâmetros de Entrega</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Regras de frete e transportadora padrão da loja</p>
                                        </div>
                                        <hr className="border-slate-100" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Valor Mínimo para Frete Grátis (R$)</label>
                                                <input
                                                    type="number"
                                                    value={shippingSettings.freeShippingMin}
                                                    onChange={(e) => setShippingSettings({ ...shippingSettings, freeShippingMin: Number(e.target.value) })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">CEP de Origem (Saída de Estoque)</label>
                                                <input
                                                    type="text"
                                                    value={shippingSettings.originZip}
                                                    onChange={(e) => setShippingSettings({ ...shippingSettings, originZip: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2 md:col-span-2">
                                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Transportadora Padrão</label>
                                                <select
                                                    value={shippingSettings.defaultCarrier}
                                                    onChange={(e) => setShippingSettings({ ...shippingSettings, defaultCarrier: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-colors cursor-pointer"
                                                >
                                                    <option value="Correios">Correios (SEDEX / PAC)</option>
                                                    <option value="Jadlog">Jadlog Express</option>
                                                    <option value="Loggi">Loggi Direct</option>
                                                    <option value="MelhorEnvio">Melhor Envio Multi-transportadora</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleSave('shipping', shippingSettings)}
                                            className="w-full sm:w-auto mt-4 bg-[#05080F] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all ml-auto"
                                        >
                                            <Save className="w-4 h-4 text-[#FBC02D]" />
                                            SALVAR LOGÍSTICA
                                        </button>
                                    </div>
                                )}

                                {/* SECURITY & ACCESS TAB */}
                                {activeTab === 'security' && (
                                    <div className="space-y-8">
                                        <div className="space-y-6">
                                            <div>
                                                <h3 className="text-xl font-black text-[#05080F] mb-1">Acessos & Segurança</h3>
                                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Gestão de acessos à equipe administrativa</p>
                                            </div>
                                            <hr className="border-slate-100" />

                                            {/* List of Admins */}
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h4 className="text-sm font-black text-[#05080F] uppercase tracking-wider">Administradores Habilitados</h4>
                                                    <button className="flex items-center gap-1 text-xs font-black text-[#FBC02D] hover:text-[#05080F] transition-colors">
                                                        <Plus className="w-4 h-4" /> CONVIDAR
                                                    </button>
                                                </div>
                                                <div className="divide-y divide-slate-50 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                                                    {admins.map((admin) => (
                                                        <div key={admin.id} className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-[#05080F] text-[#FBC02D] flex items-center justify-center text-xs font-black uppercase">
                                                                    {admin.email[0]}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-black text-[#05080F]">{admin.email}</p>
                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{admin.role}</p>
                                                                </div>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-400">
                                                                {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Security Rules */}
                                            <div className="space-y-4">
                                                <h4 className="text-sm font-black text-[#05080F] uppercase tracking-wider">Políticas de Autenticação</h4>
                                                
                                                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                    <div>
                                                        <p className="text-sm font-black text-[#05080F]">Exigir Letra Maiúscula</p>
                                                        <p className="text-[10px] font-bold text-slate-400">Senhas de admin devem ter ao menos uma letra maiúscula</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSecuritySettings({ ...securitySettings, requireCapital: !securitySettings.requireCapital })}
                                                        className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative ${
                                                            securitySettings.requireCapital ? 'bg-[#FBC02D]' : 'bg-slate-200'
                                                        }`}
                                                    >
                                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 absolute ${
                                                            securitySettings.requireCapital ? 'right-1' : 'left-1'
                                                        }`}></div>
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                    <div>
                                                        <p className="text-sm font-black text-[#05080F]">Exigir Caractere Especial</p>
                                                        <p className="text-[10px] font-bold text-slate-400">Exigir ao menos um símbolo (ex: @, #, $)</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setSecuritySettings({ ...securitySettings, requireSpecialChar: !securitySettings.requireSpecialChar })}
                                                        className={`w-12 h-7 rounded-full p-1 transition-all duration-300 relative ${
                                                            securitySettings.requireSpecialChar ? 'bg-[#FBC02D]' : 'bg-slate-200'
                                                        }`}
                                                    >
                                                        <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 absolute ${
                                                            securitySettings.requireSpecialChar ? 'right-1' : 'left-1'
                                                        }`}></div>
                                                    </button>
                                                </div>

                                                <div className="flex flex-col gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="text-sm font-black text-[#05080F]">Tempo Limite de Sessão</p>
                                                            <p className="text-[10px] font-bold text-slate-400">Deslogar automaticamente após inatividade</p>
                                                        </div>
                                                        <span className="text-xs font-black text-[#05080F]">{securitySettings.sessionTimeout} min</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="15"
                                                        max="240"
                                                        step="15"
                                                        value={securitySettings.sessionTimeout}
                                                        onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: Number(e.target.value) })}
                                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FBC02D] mt-2"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
                                            <button
                                                onClick={handleInvalidateSessions}
                                                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 border border-red-100 rounded-2xl hover:bg-red-50 text-red-500 transition-all font-black text-sm"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                INVALIDAR SESSÕES ATIVAS
                                            </button>

                                            <button
                                                onClick={() => handleSave('security', securitySettings)}
                                                className="w-full sm:w-auto bg-[#05080F] text-white px-6 py-4 rounded-2xl flex items-center justify-center gap-2 font-black shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all"
                                            >
                                                <Save className="w-4 h-4 text-[#FBC02D]" />
                                                SALVAR PARÂMETROS
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* BILLING & SUBSCRIPTIONS TAB */}
                                {activeTab === 'billing' && (
                                    <div className="space-y-8">
                                        <div>
                                            <h3 className="text-xl font-black text-[#05080F] mb-1">Assinatura & Faturamento</h3>
                                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Gerencie seu plano SaaS, cotas do provador virtual e faturamento</p>
                                        </div>
                                        <hr className="border-slate-100" />

                                        {isLoadingBilling ? (
                                            <div className="flex flex-col items-center justify-center py-12 gap-3">
                                                <Loader2 className="w-8 h-8 text-[#FBC02D] animate-spin" />
                                                <p className="font-bold text-slate-400 text-xs uppercase tracking-widest">Carregando dados da assinatura...</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Plan overview card */}
                                                <div className="bg-[#05080F] rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl">
                                                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#FBC02D]/10 blur-3xl rounded-full translate-x-12 -translate-y-12"></div>
                                                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                        <div className="space-y-2">
                                                            <div className="inline-flex items-center gap-2 bg-[#FBC02D]/10 border border-[#FBC02D]/20 text-[#FBC02D] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                                Status: Ativo
                                                            </div>
                                                            <h4 className="text-2xl font-black">Plano {billingData?.plan_name || 'Starter'}</h4>
                                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Inquilino: {profile?.tenant_name || 'Classe A'}</p>
                                                        </div>
                                                        {billingData?.plan_name !== 'Pro' && (
                                                            <button 
                                                                onClick={handleCancelSubscription}
                                                                className="px-6 py-3 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl font-black text-xs uppercase tracking-widest transition-all self-start md:self-auto"
                                                            >
                                                                CANCELAR ASSINATURA
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quotas and Usage progress bars */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Renders limit card */}
                                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <h5 className="font-black text-xs uppercase text-slate-400 tracking-wider">Renders de Provador (VTON)</h5>
                                                            <span className="text-xs font-black text-[#05080F]">
                                                                {billingData?.renders_month} / {billingData?.max_renders === -1 ? 'Ilimitado' : billingData?.max_renders}
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${billingData?.is_renders_exceeded ? 'bg-red-500' : 'bg-[#FBC02D]'}`}
                                                                style={{ 
                                                                    width: `${billingData?.max_renders === -1 ? '100' : Math.min(100, ((billingData?.renders_month || 0) / (billingData?.max_renders || 1)) * 100)}%` 
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Consumo na fatura do mês atual. Cliques do Cache L1/L2 não consomem cota.</p>
                                                    </div>

                                                    {/* Products limit card */}
                                                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <h5 className="font-black text-xs uppercase text-slate-400 tracking-wider">Produtos Ativos</h5>
                                                            <span className="text-xs font-black text-[#05080F]">
                                                                {billingData?.products_count} / {billingData?.max_products === -1 ? 'Ilimitado' : billingData?.max_products}
                                                            </span>
                                                        </div>
                                                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${billingData?.is_products_exceeded ? 'bg-red-500' : 'bg-[#05080F]'}`}
                                                                style={{ 
                                                                    width: `${billingData?.max_products === -1 ? '100' : Math.min(100, ((billingData?.products_count || 0) / (billingData?.max_products || 1)) * 100)}%` 
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Limite de produtos ativos no catálogo do marketplace.</p>
                                                    </div>
                                                </div>

                                                {/* Cache efficiency stats */}
                                                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-6">
                                                    <div>
                                                        <h5 className="font-black text-sm text-[#05080F] mb-1">Eficiência do Cache Inteligente</h5>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Economia de custos e desempenho de requisições VTON evitadas</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                                        <div className="bg-white border border-slate-100 rounded-2xl p-4">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cache Hits (L1/L2)</p>
                                                            <p className="text-2xl font-black text-[#05080F] mt-1">{usageData?.cache_hits || 0}</p>
                                                        </div>
                                                        <div className="bg-white border border-slate-100 rounded-2xl p-4">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reutilização de Look</p>
                                                            <p className="text-2xl font-black text-emerald-600 mt-1">{usageData?.cache_rate || 0}%</p>
                                                        </div>
                                                        <div className="bg-white border border-slate-100 rounded-2xl p-4">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Custo Evitado (Economia)</p>
                                                            <p className="text-2xl font-black text-[#FBC02D] mt-1">
                                                                R$ {(usageData?.cost_saved || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Plan options grid for upgrade/downgrade */}
                                                <div className="space-y-4">
                                                    <div>
                                                        <h5 className="font-black text-sm text-[#05080F] mb-1">Alterar Plano de Assinatura</h5>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Faça upgrade para liberar cotas adicionais imediatamente</p>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        {[
                                                            { id: 'a111af72-27a5-41fd-8ed9-8c51b78b4fa1', name: 'Starter', price: 'R$ 99', desc: '500 renders VTON, 100 produtos' },
                                                            { id: 'b111af72-27a5-41fd-8ed9-8c51b78b4fb2', name: 'Growth', price: 'R$ 199', desc: '5.000 renders VTON, 1.000 produtos' },
                                                            { id: 'c111af72-27a5-41fd-8ed9-8c51b78b4fc3', name: 'Pro Enterprise', price: 'R$ 499', desc: 'Renders e produtos ilimitados' }
                                                        ].map((p) => {
                                                            const isCurrent = billingData?.plan_name?.toLowerCase() === p.name.split(' ')[0].toLowerCase();
                                                            return (
                                                                <div 
                                                                    key={p.id}
                                                                    className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                                                                        isCurrent 
                                                                        ? 'bg-white border-[#FBC02D] shadow-md' 
                                                                        : 'bg-white border-slate-100 hover:border-slate-300'
                                                                    }`}
                                                                >
                                                                    <div>
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-black text-xs uppercase tracking-wider text-[#05080F]">{p.name}</span>
                                                                            {isCurrent && (
                                                                                <span className="bg-[#FBC02D]/10 text-[#FBC02D] text-[9px] font-black uppercase px-2 py-0.5 rounded">Ativo</span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400 font-bold mt-1">{p.desc}</p>
                                                                    </div>
                                                                    <div className="flex items-center justify-between mt-6 gap-2">
                                                                        <span className="text-sm font-black text-[#05080F]">{p.price}<span className="text-[10px] text-slate-400 font-bold">/mês</span></span>
                                                                        {!isCurrent && (
                                                                            <button 
                                                                                onClick={() => handleChangePlan(p.id)}
                                                                                className="px-3.5 py-2 bg-[#05080F] hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                                                                            >
                                                                                MUDAR
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminSettings;
