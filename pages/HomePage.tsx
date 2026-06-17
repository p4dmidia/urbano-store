import React from 'react';
import Hero from '../components/Hero';
import FeaturedCategories from '../components/FeaturedCategories';
import FeaturedProducts from '../components/FeaturedProducts';
import Benefits from '../components/Benefits';
import HowItWorks from '../components/HowItWorks';
import Testimonials from '../components/Testimonials';
import Newsletter from '../components/Newsletter';

const HomePage: React.FC = () => {
  return (
    <div className="space-y-0">
      {/* 1. Hero Section */}
      <Hero />

      {/* 2. Benefícios (Diferenciais) */}
      <Benefits />

      {/* 3. Categorias em Destaque */}
      <FeaturedCategories />

      {/* 4. Produtos em Destaque (Mais Vendidos) */}
      <FeaturedProducts />

      {/* 5. Como Funciona o Provador Inteligente */}
      <HowItWorks />

      {/* 6. Depoimentos */}
      <Testimonials />

      {/* 7. Newsletter */}
      <Newsletter />
    </div>
  );
};

export default HomePage;
