import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight, Check } from 'lucide-react';

interface SlideItem {
  title: string;
  subtitle: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  secondaryText?: string;
  secondaryLink?: string;
  indicators: string[];
}

const Hero: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: SlideItem[] = [
    {
      title: 'Moda para todos os estilos.',
      subtitle: 'Descubra peças incríveis para renovar seu guarda-roupa com praticidade, conforto e tecnologia.',
      image: '/assets/hero_slide_1.png',
      ctaText: 'Comprar Agora',
      ctaLink: '/shop',
      secondaryText: 'Conhecer Categorias',
      secondaryLink: '#categories',
      indicators: ['Compra Segura', 'Entrega para Todo Brasil', 'Troca Facilitada'],
    },
    {
      title: 'Corta-Vento Streetwear',
      subtitle: 'Resistente à água, corta-vento e com modelagem moderna. O caimento ideal com a tecnologia Urbano Fit.',
      image: '/assets/hero_slide_2.png',
      ctaText: 'Conhecer Produto',
      ctaLink: '/shop',
      indicators: ['Tecnologia Urbano Fit', 'Corta-Vento Premium', 'Impermeável'],
    },
    {
      title: 'Frete Grátis para todo o Brasil',
      subtitle: 'Aproveite frete grátis em todas as compras acima de R$350,00. Renove seu estilo hoje.',
      image: '/assets/hero_slide_3.png',
      ctaText: 'Explorar Loja',
      ctaLink: '/shop',
      indicators: ['Frete Grátis > R$350', 'Rastreio Completo', 'Envio Prioritário'],
    },
  ];

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  // Autoplay Slider every 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 15000);

    return () => clearInterval(timer);
  }, [handleNext]);

  return (
    <section className="relative w-full h-[540px] md:h-[620px] lg:h-[680px] bg-slate-900 overflow-hidden">
      
      {/* Background Slides */}
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            {/* Image layer */}
            <img
              src={slide.image}
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            {/* Dark tint overlay */}
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ))}
      </div>

      {/* Floating Card Content Container */}
      <div className="absolute inset-0 z-20 flex items-center justify-start">
        <div className="container mx-auto px-4 md:px-8">
          
          <div className="max-w-xl space-y-6 text-white transition-all duration-700">
            
            <div className="space-y-4">
              <span className="inline-block bg-[#C5A880]/15 text-[#C5A880] text-[9px] font-bold tracking-widest uppercase px-3 py-1 rounded">
                Urbano Store
              </span>
              
              <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight text-white">
                {slides[currentSlide].title.split('. ').map((part, i) => (
                  <span key={i} className={i > 0 ? 'text-[#C5A880]' : ''}>
                    {part}{i < slides[currentSlide].title.split('. ').length - 1 ? '. ' : ''}
                  </span>
                ))}
              </h1>
              
              <p className="text-slate-350 text-xs md:text-sm leading-relaxed max-w-md">
                {slides[currentSlide].subtitle}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to={slides[currentSlide].ctaLink}
                className="bg-[#C5A880] hover:bg-[#B59870] text-[#111111] font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2"
              >
                {slides[currentSlide].ctaText}
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Link>
              
              {slides[currentSlide].secondaryText && (
                <a
                  href={slides[currentSlide].secondaryLink}
                  className="border border-white/20 hover:border-white/50 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-widest transition-all bg-white/5"
                >
                  {slides[currentSlide].secondaryText}
                </a>
              )}
            </div>

            {/* Indicators inside the card */}
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-white/10 text-[10px] font-bold text-slate-300">
              {slides[currentSlide].indicators.map((ind, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#C5A880]/20 text-[#C5A880]">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                  {ind}
                </span>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* Manual Left/Right Navigation Arrows */}
      <button
        onClick={handlePrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/30 hover:bg-black/60 border border-white/5 hover:border-white/25 rounded-full text-white transition-all shadow-md shrink-0"
        aria-label="Previous Slide"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/30 hover:bg-black/60 border border-white/5 hover:border-white/25 rounded-full text-white transition-all shadow-md shrink-0"
        aria-label="Next Slide"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Slide dots indicators at the bottom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-350 ${
              index === currentSlide ? 'bg-[#C5A880] w-6' : 'bg-white/40 hover:bg-white/70'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

    </section>
  );
};

export default Hero;
