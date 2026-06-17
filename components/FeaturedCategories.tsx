import React from 'react';
import { Link } from 'react-router-dom';

const FeaturedCategories: React.FC = () => {
  const categories = [
    {
      name: 'Feminino',
      image: '/assets/cat_female.png',
      link: '/shop?gender=female',
    },
    {
      name: 'Masculino',
      image: '/assets/cat_male.png',
      link: '/shop?gender=male',
    },
    {
      name: 'Acessórios',
      image: '/assets/cat_accessories.png',
      link: '/shop?category=acessorios',
    },
  ];

  return (
    <section id="categories" className="py-24 bg-[#FFFFFF]">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="inline-block bg-[#C5A880]/10 text-[#C5A880] text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full">
            Nossas Coleções
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
            Explore por Categoria
          </h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            Selecione a categoria desejada e confira as melhores peças selecionadas para compor seu visual urbano.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              to={cat.link}
              className="group relative h-[420px] rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 cursor-pointer block border border-slate-100"
            >
              {/* Background Image with Zoom on Hover */}
              <img
                src={cat.image}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              
              {/* Semi-transparent dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:via-black/40 transition-colors duration-500" />

              {/* Text info positioned bottom left */}
              <div className="absolute bottom-8 left-8 right-8 z-10 text-white space-y-3">
                <h3 className="text-2xl font-bold tracking-wide uppercase">
                  {cat.name}
                </h3>
                <div className="inline-flex items-center text-xs font-bold tracking-widest text-[#111111] uppercase bg-white py-3 px-5 rounded-xl group-hover:bg-[#C5A880] group-hover:text-[#111111] transition-all duration-300 shadow-lg">
                  Ver Coleção
                  <span className="inline-block ml-1.5 transition-transform duration-300 group-hover:translate-x-1">
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedCategories;
