import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Sliders, CheckCircle2, Shirt, Ruler, ShoppingBag } from 'lucide-react';

const HowItWorks: React.FC = () => {
  return (
    <section id="provador" className="py-24 bg-[#F5F5F5] border-y border-slate-100">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 items-center gap-16">
        
        {/* Left Column: Tech explanations */}
        <div className="space-y-8 max-w-xl">
          <span className="inline-flex items-center gap-2 bg-[#C5A880]/10 text-[#C5A880] text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            Tecnologia Urbano Fit
          </span>
          
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#111111] tracking-tight leading-tight">
            Experimente Antes <br />
            <span className="text-[#C5A880]">de Comprar</span>
          </h2>
          
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Descubra o tamanho ideal para você utilizando nosso sistema inteligente de recomendação de medidas e visualização de produtos.
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white text-[#C5A880] rounded-xl shadow-sm border border-slate-200/50 shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-[#111111] text-sm md:text-base">Perfil de Medidas Inteligente</h4>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">Insira sua altura, peso e idade para gerar instantaneamente seu biotipo 3D.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-3 bg-white text-[#C5A880] rounded-xl shadow-sm border border-slate-200/50 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-[#111111] text-sm md:text-base">Sugestão Automática de Tamanho</h4>
                <p className="text-slate-400 text-xs md:text-sm leading-relaxed">Nossa tecnologia cruza suas medidas físicas com a tabela de modelagem do fabricante e indica a melhor opção.</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Link 
              to="/shop" 
              className="bg-[#111111] hover:bg-slate-800 text-white font-bold py-4 px-8 rounded-xl shadow-md hover:shadow-lg transition-all text-center inline-block text-sm md:text-base border border-[#111111]"
            >
              Testar Provador
            </Link>
          </div>
        </div>

        {/* Right Column: High-Fidelity Mockup of Product Screen from Attachment */}
        <div className="relative flex justify-center">
          <div className="absolute -inset-4 bg-[#C5A880]/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Visual container representing the product details interface */}
          <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
            <div className="space-y-6">
              
              {/* Product Info Block */}
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <span className="bg-[#B91C1C] text-white text-[9px] font-black tracking-wider px-2.5 py-0.5 rounded">
                    LIQUIDA 6.6
                  </span>
                  <span className="bg-[#111111] text-white text-[9px] font-black tracking-wider px-2.5 py-0.5 rounded">
                    MAIS VENDIDO
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-[#111111]">
                  Camiseta TH Shoulder Stripe - Preta
                </h3>
              </div>

              {/* Price Block */}
              <div className="space-y-1">
                <div className="flex items-baseline gap-2.5">
                  <span className="text-2xl font-black text-[#111111]">R$ 139,99</span>
                  <span className="text-sm text-slate-400 line-through">R$ 199,99</span>
                  <span className="bg-[#B91C1C] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    -30%
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  em até 12x de <span className="font-bold text-[#111111]">R$ 12,99</span>
                </p>
              </div>

              {/* Payments & PIX info */}
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded">
                  7% OFF no pix
                </span>
                <span className="text-white bg-emerald-800 px-2.5 py-1 rounded">
                  Envio Prioritário
                </span>
              </div>

              {/* Cashback Gray Banner */}
              <div className="flex items-center gap-2 p-3 bg-[#F5F5F5] rounded-xl border border-slate-100 text-xs text-slate-600 font-bold">
                <span className="text-emerald-600 font-black">💰</span>
                <span>Ganhe R$ 13,99 de CashBack!</span>
              </div>

              {/* Size Selectors Mockup */}
              <div className="space-y-3">
                <p className="text-xs font-black text-[#111111] uppercase tracking-wider">Tamanho: P</p>
                <div className="flex gap-2">
                  <span className="flex items-center justify-center w-12 h-12 border-2 border-[#111111] rounded-xl text-sm font-black text-[#111111] cursor-pointer">
                    P
                  </span>
                  <span className="flex items-center justify-center w-12 h-12 border border-slate-200 hover:border-slate-400 rounded-xl text-sm font-bold text-slate-600 cursor-pointer">
                    M
                  </span>
                  <span className="flex items-center justify-center w-12 h-12 border border-slate-200 hover:border-slate-400 rounded-xl text-sm font-bold text-slate-600 cursor-pointer">
                    G
                  </span>
                  <span className="flex items-center justify-center w-12 h-12 border border-slate-200 hover:border-slate-400 rounded-xl text-sm font-bold text-slate-600 cursor-pointer">
                    GG
                  </span>
                </div>
              </div>

              {/* Recommendations and AI Mockup Buttons */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <span>✨</span> Recomendamos o tamanho <span className="font-extrabold text-[#7C3AED]">GG</span>
                </p>

                <div className="flex gap-3 text-xs font-bold text-slate-700">
                  <button className="flex items-center gap-2 py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                    <Shirt className="w-4 h-4 text-slate-500" />
                    Provador Virtual
                  </button>
                  <button className="flex items-center gap-2 py-2.5 px-4 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
                    <Ruler className="w-4 h-4 text-slate-500" />
                    Tabela de Medidas
                  </button>
                </div>
              </div>

              {/* Wide Black Add to Bag Button */}
              <div className="pt-2">
                <button className="w-full bg-[#111111] hover:bg-slate-800 text-white font-black py-4 px-6 rounded-xl text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2.5 shadow-md">
                  <ShoppingBag className="w-4 h-4" />
                  Adicionar à Bag
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default HowItWorks;
