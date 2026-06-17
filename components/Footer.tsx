import React from 'react';
import { Mail, MapPin, Share2, Globe, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-[#020204] border-t border-slate-900 pt-20 pb-10 text-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
          <div className="space-y-6">
            <div className="flex items-center">
              <img src="/assets/logo.png" alt="Urbano Store" className="h-16 w-auto object-contain brightness-110" />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sua loja moderna de moda masculina, feminina e acessórios. Conforto, estilo e as últimas tendências em vestuário com caimento perfeito.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-[#C5A880] hover:bg-white/10 transition-colors">
                <Share2 className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-[#C5A880] hover:bg-white/10 transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-[#C5A880] hover:bg-white/10 transition-colors">
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 mb-6 uppercase text-xs tracking-widest border-l-2 border-[#C5A880] pl-3">Categorias</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="/shop?gender=female" className="hover:text-[#C5A880] transition-colors">Feminino</a></li>
              <li><a href="/shop?gender=male" className="hover:text-[#C5A880] transition-colors">Masculino</a></li>
              <li><a href="/shop?category=acessorios" className="hover:text-[#C5A880] transition-colors">Acessórios</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 mb-6 uppercase text-xs tracking-widest border-l-2 border-[#C5A880] pl-3">Institucional</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><a href="#" className="hover:text-[#C5A880] transition-colors">Sobre Nós</a></li>
              <li><a href="#" className="hover:text-[#C5A880] transition-colors">Política de Privacidade</a></li>
              <li><a href="#" className="hover:text-[#C5A880] transition-colors">Termos de Uso</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-200 mb-6 uppercase text-xs tracking-widest border-l-2 border-[#C5A880] pl-3">Atendimento</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#C5A880]" />
                suporte@urbanostore.com.br
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#C5A880] shrink-0" />
                Urbano Store S/A - Moda & Estilo
              </li>
            </ul>
            
            {/* Help Card */}
            <div className="mt-8 bg-gradient-to-br from-[#0b0b0e] to-[#020204] p-6 rounded-[2rem] border border-white/5 relative overflow-hidden group shadow-lg">
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full transition-transform group-hover:scale-150 duration-700"></div>
              
              <div className="relative z-10">
                <h5 className="text-[#C5A880] font-black text-base mb-2">Central de Ajuda</h5>
                <p className="text-slate-400 text-xs leading-relaxed mb-6">
                  Dúvidas sobre pedidos ou provador? Nossa equipe está pronta para te atender.
                </p>
                <a 
                  href="#"
                  className="block w-full bg-[#C5A880] hover:bg-[#B59870] text-[#111111] text-center py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm"
                >
                  Falar Conosco
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Bar */}
        <div className="border-t border-slate-900 py-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <p className="text-slate-500 text-xs">
            © 2026 Urbano Store. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
