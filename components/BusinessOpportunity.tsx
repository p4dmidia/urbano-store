
import React from 'react';
import { CheckCircle2, Users, TrendingUp, Award, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

const BusinessOpportunity: React.FC = () => {
  return (
    <section className="bg-[#0B1221] py-20 text-white relative overflow-hidden">
      <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-8">
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Transforme seu estilo em <br />
            <span className="text-[#FBC02D]">um negócio de sucesso.</span>
          </h2>
          <p className="text-slate-400 text-lg">
            O Negócio Classe A permite que você se torne um parceiro e lucre com a venda de produtos de alta qualidade. Faça parte de uma rede que cresce com você.
          </p>

          <ul className="space-y-4">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#FBC02D]" />
              <span className="font-medium">Comissões atrativas em cada venda</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#FBC02D]" />
              <span className="font-medium">Suporte e treinamento completo</span>
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#FBC02D]" />
              <span className="font-medium">Produtos exclusivos de alta demanda</span>
            </li>
          </ul>

          <Link to="/register" className="inline-block bg-[#FBC02D] hover:bg-[#f9b100] text-[#0B1221] font-bold py-4 px-10 rounded-lg shadow-lg shadow-[#FBC02D]/20 transition-all text-center">
            QUERO SER UM AFILIADO
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
          <div className="bg-[#1A212E] p-8 rounded-xl border border-white/5 hover:border-[#FBC02D]/30 transition-all flex flex-col gap-4 sm:col-span-2">
            <div className="w-12 h-12 bg-[#FBC02D]/10 rounded-lg flex items-center justify-center">
              <Users className="text-[#FBC02D] w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-xl mb-1">Rede</h4>
              <p className="text-sm text-slate-400">Construa sua própria equipe de vendas.</p>
            </div>
          </div>


          <div className="bg-[#1A212E] p-8 rounded-xl border border-white/5 hover:border-[#FBC02D]/30 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 bg-[#FBC02D]/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-[#FBC02D] w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-xl mb-1">Escalabilidade</h4>
              <p className="text-sm text-slate-400">Ganhos ilimitados conforme seu esforço.</p>
            </div>
          </div>

          <div className="bg-[#1A212E] p-8 rounded-xl border border-white/5 hover:border-[#FBC02D]/30 transition-all flex flex-col gap-4">
            <div className="w-12 h-12 bg-[#FBC02D]/10 rounded-lg flex items-center justify-center">
              <FileText className="text-[#FBC02D] w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-xl mb-1">Consórcio</h4>
              <p className="text-sm text-slate-400">Venda planos de consórcio facilitados.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BusinessOpportunity;
