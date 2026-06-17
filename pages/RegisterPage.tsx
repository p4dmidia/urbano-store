import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    Send,
    User,
    Lock,
    Mail,
    Phone,
    FileText,
    Eye,
    EyeOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ORGANIZATION_ID } from '../lib/config';

const RegisterPage: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        nome: '',
        sobrenome: '',
        login: '',
        email: '',
        senha: '',
        confirmarSenha: '',
        whatsapp: '',
        cpf: '',
        aceiteTermos: false
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (formData.senha !== formData.confirmarSenha) {
            setError('As senhas não coincidem.');
            return;
        }
        if (!formData.aceiteTermos) {
            setError('Você precisa aceitar os termos de uso para prosseguir.');
            return;
        }
        if (!formData.cpf) {
            setError('Por favor, informe o seu CPF.');
            return;
        }

        setLoading(true);
        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.senha,
                options: {
                    data: {
                        nome: formData.nome,
                        sobrenome: formData.sobrenome,
                        login: formData.login || formData.email.split('@')[0],
                        organization_id: ORGANIZATION_ID,
                        tenant_id: ORGANIZATION_ID,
                        role: 'client',
                        cpf: formData.cpf,
                        whatsapp: formData.whatsapp
                    }
                }
            });

            if (signUpError) throw signUpError;

            if (data?.user) {
                toast.success('Cadastro realizado com sucesso! Bem-vindo.', {
                    duration: 5000,
                    style: {
                        background: '#0B1221',
                        color: '#fff',
                        fontWeight: 'bold',
                        borderRadius: '1rem',
                        border: '1px solid rgba(251, 192, 45, 0.2)'
                    },
                    iconTheme: {
                        primary: '#FBC02D',
                        secondary: '#0B1221',
                    },
                });

                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao realizar cadastro.');
            toast.error(err.message || 'Erro ao realizar cadastro.');
            console.error('Erro no cadastro:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white min-h-screen font-sans">
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-[#0B1221] py-16 lg:py-24">
                <div className="absolute top-0 right-0 w-1/2 h-full bg-[#FBC02D]/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <span className="inline-block bg-[#FBC02D]/20 text-[#FBC02D] text-[10px] font-black tracking-[0.2em] uppercase px-4 py-2 rounded-full mb-6">
                        Fashion Mall IA
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-tight">
                        Crie sua conta e tenha uma  <br />
                        <span className="text-[#FBC02D]">experiência de compra inteligente</span>
                    </h1>
                </div>
            </section>

            {/* Registration Form Section */}
            <section className="py-20 -mt-16 relative z-20 pb-32">
                <div className="container mx-auto px-4">
                    <div className="max-w-xl mx-auto">
                        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 p-8 lg:p-12 space-y-8">
                            <div>
                                <h3 className="text-2xl font-black text-[#0B1221] mb-2">Seus Dados</h3>
                                <p className="text-slate-400 text-sm font-medium">Preencha os campos abaixo para criar sua conta de e-commerce.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Nome</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                            <input
                                                type="text" name="nome" required
                                                value={formData.nome} onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                                placeholder="Ex: João"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Sobrenome</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                            <input
                                                type="text" name="sobrenome" required
                                                value={formData.sobrenome} onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                                placeholder="Silva"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">E-mail</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="email" name="email" required
                                            value={formData.email} onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="exemplo@email.com"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">WhatsApp / Celular</label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="text" name="whatsapp" required
                                            value={formData.whatsapp} onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="(00) 00000-0000"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">CPF</label>
                                    <div className="relative">
                                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                        <input
                                            type="text" name="cpf" required
                                            value={formData.cpf} onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                            placeholder="000.000.000-00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Senha</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                            <input
                                                type={showPassword ? "text" : "password"} name="senha" required
                                                value={formData.senha} onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                                placeholder="********"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#FBC02D]"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Confirmar Senha</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FBC02D]" />
                                            <input
                                                type={showPassword ? "text" : "password"} name="confirmarSenha" required
                                                value={formData.confirmarSenha} onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] transition-all"
                                                placeholder="********"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 cursor-pointer group select-none pt-2"
                                    onClick={() => setFormData(p => ({ ...p, aceiteTermos: !p.aceiteTermos }))}>
                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${formData.aceiteTermos ? 'bg-[#FBC02D] border-[#FBC02D]' : 'bg-white border-slate-200 group-hover:border-slate-300'}`}>
                                        {formData.aceiteTermos && <CheckCircle2 size={16} className="text-[#0B1221]" />}
                                    </div>
                                    <span className="text-[10px] font-black text-[#0B1221] uppercase tracking-widest">
                                        Li e aceito os termos de uso do e-commerce
                                    </span>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-center">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className={`w-full py-5 bg-[#0B1221] text-white rounded-2xl font-black text-sm shadow-2xl shadow-[#0B1221]/20 hover:bg-[#1a2436] transition-all flex items-center justify-center gap-3 uppercase tracking-widest ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {loading ? 'PROCESSANDO...' : 'CRIAR MINHA CONTA AGORA'}
                                    <Send className="w-5 h-5 text-[#FBC02D]" />
                                </button>
                            </form>
                        </div>
                        <p className="mt-8 text-center text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                            Fashion Mall IA © 2026 - Todos os direitos reservados
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default RegisterPage;
