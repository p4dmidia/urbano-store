import React from 'react';
import { Truck, ShieldCheck, RefreshCw, UserCheck } from 'lucide-react';

const Benefits: React.FC = () => {
  const benefits = [
    {
      title: 'Entrega para Todo Brasil',
      desc: 'Envios rápidos e seguros com rastreamento completo.',
      icon: Truck,
    },
    {
      title: 'Pagamento Seguro',
      desc: 'Criptografia total através do Mercado Pago.',
      icon: ShieldCheck,
    },
    {
      title: 'Troca Facilitada',
      desc: 'Primeira troca grátis e sem burocracia em até 7 dias.',
      icon: RefreshCw,
    },
    {
      title: 'Provador Inteligente',
      desc: 'Descubra a numeração correta com nosso assistente.',
      icon: UserCheck,
    },
  ];

  return (
    <section className="py-8 bg-white border-b border-slate-100">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b, idx) => {
            const Icon = b.icon;
            return (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-[#F9F9F9] transition-all duration-300"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#C5A880]/10 text-[#C5A880] shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-[#111111]">
                    {b.title}
                  </h4>
                  <p className="text-slate-500 text-xs leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
