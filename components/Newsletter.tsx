import React, { useState } from 'react';
import { Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      toast.success('Inscrição realizada! Fique de olho no seu e-mail.');
      setEmail('');
    }
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto bg-[#F5F5F5] border border-slate-100 p-8 md:p-12 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden group shadow-sm">
          
          {/* Decorative background shape */}
          <div className="absolute -top-12 -left-12 w-36 h-36 bg-[#C5A880]/5 rounded-full blur-2xl group-hover:bg-[#C5A880]/10 transition-colors duration-500" />
          
          <div className="space-y-3 relative z-10 text-center md:text-left max-w-md">
            <h3 className="text-xl md:text-2xl font-extrabold text-[#111111] tracking-tight">
              Receba Novidades e Promoções
            </h3>
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
              Assine nossa newsletter e ganhe 10% de desconto na sua primeira compra, além de acesso exclusivo a lançamentos.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full md:w-auto flex flex-col sm:flex-row gap-3 relative z-10 shrink-0">
            <div className="relative">
              <input
                type="email"
                required
                placeholder="Seu melhor e-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full sm:w-64 bg-white border border-slate-200 focus:border-[#C5A880]/50 rounded-xl py-3.5 pl-11 pr-4 text-xs outline-none transition-all text-slate-800"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            
            <button
              type="submit"
              className="bg-[#111111] hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm border border-[#111111]"
            >
              Cadastrar
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
          
        </div>
      </div>
    </section>
  );
};

export default Newsletter;
