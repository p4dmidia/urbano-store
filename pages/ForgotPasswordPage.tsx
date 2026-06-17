
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { toast } from 'react-hot-toast';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await resetPassword(email);
            if (error) throw error;
            setSubmitted(true);
            toast.success('E-mail de recuperação enviado!');
        } catch (error: any) {
            toast.error(error.message || 'Erro ao enviar e-mail de recuperação.');
            console.error('Erro na recuperação:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center bg-slate-50 py-20 px-4">
            <div className="max-w-md w-full">
                {/* Header/Logo Area */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center mb-6">
                        <img src="/assets/logo.png" alt="Classe A" className="h-24 w-auto drop-shadow-sm" />
                    </div>
                    <h1 className="text-3xl font-black text-[#0B1221]">Recuperar Senha</h1>
                    <p className="text-slate-500 mt-2">Enviaremos um link de redefinição para o seu e-mail.</p>
                </div>

                {/* Recovery Card */}
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 p-10 border border-slate-100">
                    {!submitted ? (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">E-mail Cadastrado</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 pl-12 outline-none focus:border-[#FBC02D] focus:bg-white transition-all"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#0B1221] hover:bg-[#1a2436] text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#0B1221]/20 group disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'ENVIANDO...' : 'ENVIAR LINK DE RECUPERAÇÃO'}
                                <Send className="w-5 h-5 text-[#FBC02D] group-hover:translate-x-1 transition-transform" />
                            </button>
                        </form>
                    ) : (
                        <div className="text-center space-y-6 pt-4">
                            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-10 h-10" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-xl font-bold text-[#0B1221]">E-mail Enviado!</h3>
                                <p className="text-slate-500 text-sm leading-relaxed">
                                    Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para criar uma nova senha em instantes.
                                </p>
                            </div>
                            <button
                                onClick={() => setSubmitted(false)}
                                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#FBC02D] transition-colors"
                            >
                                Tentar outro e-mail
                            </button>
                        </div>
                    )}

                    {/* Back to Login */}
                    <div className="mt-10 pt-8 border-t border-slate-100 text-center">
                        <Link to="/login" className="inline-flex items-center gap-2 text-[#0B1221] font-black hover:text-[#FBC02D] transition-colors group">
                            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                            VOLTAR PARA O LOGIN
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
