import React, { useState, useEffect } from 'react';
import { Loader2, ShoppingBag, CreditCard, Gift, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ORGANIZATION_ID } from '../lib/config';
import { supabase } from '../lib/supabase';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';
import toast from 'react-hot-toast';

const FeaturedProducts: React.FC = () => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    setIsLoading(true);
    try {
      console.log('DEBUG: Fetching featured for org:', ORGANIZATION_ID);

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_categories (name)
        `)
        .eq('tenant_id', ORGANIZATION_ID)
        .limit(4)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('DEBUG: Featured data count:', data?.length);
      const formatted = data?.map(p => ({
        ...p,
        category: p.product_categories?.name || 'Mais Vendido'
      }));

      setProducts(formatted || []);
    } catch (error) {
      console.error('Error fetching featured products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    addToCart(product);
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
          <span className="inline-block bg-[#C5A880]/10 text-[#C5A880] text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full">
            Destaques da Coleção
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#111111] tracking-tight">
            Mais Vendidos
          </h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed">
            As peças mais procuradas da nossa vitrine urbana que combinam perfeitamente com você.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 text-[#C5A880] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {products.map((product) => {
              const basePrice = (product.base_price || product.price || 0) * 1;
              const originalPrice = basePrice * 1.4; // 30% discount simulated
              const installment = basePrice / 12;
              const cashback = basePrice * 0.1;

              return (
                <div
                  key={product.id}
                  onClick={() => navigate(`/p/${product.id}`)}
                  className="group flex flex-col h-full bg-[#FFFFFF] border border-slate-100/80 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 cursor-pointer relative"
                >
                  {/* Product Image Panel */}
                  <div className="relative aspect-[3/4] overflow-hidden bg-[#F5F5F5]">
                    <img
                      src={(product.image_url || product.image || '').split(',')[0]?.trim() || 'https://via.placeholder.com/400x500'}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product);
                      }}
                      className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-full p-2 text-[#111111] shadow-md hover:bg-white transition-all cursor-pointer"
                      title={isInWishlist(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                    >
                      <Heart className={`w-3.5 h-3.5 transition-colors ${isInWishlist(product.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-500'}`} />
                    </div>

                    {/* Top status tags exactly like the photo */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
                      <span className="bg-[#B91C1C] text-white text-[9px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                        LIQUIDA 6.6
                      </span>
                      <span className="bg-[#111111] text-white text-[9px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                        MAIS VENDIDO
                      </span>
                    </div>

                    <span className="absolute top-4 right-4 bg-[#B91C1C] text-white text-[10px] font-black px-2 py-1 rounded">
                      OFERTAS RELÂMPAGO
                    </span>
                  </div>

                  {/* Product Details Panel */}
                  <div className="p-6 flex flex-col flex-grow space-y-4">
                    <div className="space-y-1.5 flex-grow">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{product.category}</p>
                      <h3 className="font-bold text-[#111111] text-base line-clamp-2 leading-snug group-hover:text-[#C5A880] transition-colors">
                        {product.name}
                      </h3>
                    </div>

                    {/* Price calculations based on the photo */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[#111111] font-black text-xl">
                          R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-slate-400 text-xs line-through">
                          R$ {originalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="bg-[#B91C1C]/10 text-[#B91C1C] text-[10px] font-bold px-1.5 py-0.5 rounded">
                          -30%
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium">
                        em até 12x de <span className="font-bold text-[#111111]">R$ {installment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </p>

                      {/* Payment and priority badges */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                          7% OFF no pix
                        </span>
                        <span className="inline-flex items-center text-[9px] font-bold text-white bg-emerald-800 px-2 py-0.5 rounded-md">
                          Envio Prioritário
                        </span>
                      </div>

                      {/* CashBack Gray Banner */}
                      <div className="flex items-center gap-2 p-2.5 bg-[#F5F5F5] rounded-xl border border-slate-100 text-[10px] text-slate-600 font-bold">
                        <Gift className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Ganhe R$ {cashback.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de CashBack!</span>
                      </div>

                      {/* Wide Black Button: ADICIONAR AO CARRINHO */}
                      <div className="pt-2">
                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          disabled={(product.stock_quantity ?? 0) <= 0}
                          className={`w-full font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                            (product.stock_quantity ?? 0) > 0 
                            ? 'bg-[#111111] hover:bg-slate-800 text-white' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <ShoppingBag className="w-4 h-4 shrink-0" />
                          {(product.stock_quantity ?? 0) > 0 ? 'Adicionar ao Carrinho' : 'Esgotado'}
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedProducts;
