import React from 'react';
import { Star, Quote } from 'lucide-react';

const Testimonials: React.FC = () => {
  const testimonials = [
    {
      name: 'Mariana Costa',
      role: 'Cliente de São Paulo',
      text: 'O recomendador de tamanhos da Urbano Store é maravilhoso! Fiquei com receio de comprar um blazer tamanho P, mas o assistente sugeriu M pelas minhas medidas de ombro. Ficou absolutamente perfeito.',
      rating: 5,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mariana',
    },
    {
      name: 'Thiago Martins',
      role: 'Cliente de Belo Horizonte',
      text: 'Comprei calças chino masculinas e a sugestão de tamanho foi cirúrgica. A entrega chegou super rápido em 3 dias. Recomendo muito a loja.',
      rating: 5,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Thiago',
    },
    {
      name: 'Beatriz Almeida',
      role: 'Cliente de Curitiba',
      text: 'Qualidade incrível das roupas e um suporte de primeira. O provador virtual me ajudou a ver como as cores combinavam no tom de pele do modelo. Excelente experiência.',
      rating: 5,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Beatriz',
    },
  ];

  return (
    <section className="py-24 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
          <span className="inline-block bg-[#C5A880]/10 text-[#C5A880] text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full">
            Depoimentos Reais
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
            Quem compra recomenda
          </h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Veja a experiência de alguns de nossos clientes que renovaram seu guarda-roupa na Urbano Store.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="relative p-8 bg-[#F5F5F5] border border-slate-100 hover:border-[#C5A880]/30 hover:bg-white rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
            >
              <div className="absolute top-6 right-6 text-slate-200">
                <Quote className="w-8 h-8" />
              </div>

              <div className="space-y-4">
                {/* Stars */}
                <div className="flex gap-1">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#C5A880] text-[#C5A880]" />
                  ))}
                </div>

                {/* Testimonial text */}
                <p className="text-slate-600 text-sm md:text-base leading-relaxed italic">
                  "{t.text}"
                </p>
              </div>

              {/* Author info */}
              <div className="flex items-center gap-4 pt-8 mt-auto border-t border-slate-200/50">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-12 h-12 rounded-xl bg-slate-100 object-cover border border-slate-200"
                />
                <div>
                  <h4 className="font-bold text-[#111111] text-sm md:text-base">{t.name}</h4>
                  <p className="text-slate-400 text-xs font-semibold">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
