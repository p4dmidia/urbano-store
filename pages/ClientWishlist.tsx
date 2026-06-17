import React, { useState } from 'react';
import ClientLayout from '../components/ClientLayout';
import { Heart, ShoppingCart, Trash2, Loader2, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useWishlist } from '../components/WishlistContext';
import { useCart } from '../components/CartContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const ClientWishlist: React.FC = () => {
    const { wishlist, removeFromWishlist } = useWishlist();
    const { addToCart } = useCart();
    const navigate = useNavigate();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleAddToCartClick = async (e: React.MouseEvent, item: any) => {
        e.stopPropagation();
        setLoadingId(item.id);
        try {
            // Fetch variants to see if color/size choice is required
            const { data: dbVariants } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', item.id)
                .eq('is_active', true);

            if (dbVariants && dbVariants.length > 0) {
                // Redirect to product details to select variations
                toast('Selecione o tamanho e cor na página do produto.', {
                    icon: '👟',
                });
                navigate(`/p/${item.id}`);
            } else {
                // Add direct to cart
                const cartProduct = {
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    image: item.image,
                    category: item.category,
                    stock_quantity: item.stock_quantity ?? 999
                };
                await addToCart(cartProduct);
            }
        } catch (err) {
            console.error('Error adding to cart from wishlist:', err);
            navigate(`/p/${item.id}`);
        } finally {
            setLoadingId(null);
        }
    };

    return (
        <ClientLayout>
            <div className="space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#C5A880]">Meus Favoritos</span>
                        <h2 className="text-3xl font-black text-[#111111] mt-1">Lista de Desejos</h2>
                        <p className="text-slate-500 text-sm mt-1">Veja e gerencie os produtos que você favoritou.</p>
                    </div>
                    {wishlist.length > 0 && (
                        <Link
                            to="/shop"
                            className="inline-flex items-center gap-2 text-xs font-bold text-[#C5A880] hover:text-[#111111] uppercase tracking-wider transition-colors"
                        >
                            Continuar Comprando
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>

                {wishlist.length === 0 ? (
                    /* Empty State */
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-16 text-center shadow-sm space-y-6">
                        <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                            <Heart className="w-8 h-8 fill-rose-500 text-rose-500" />
                        </div>
                        <div className="space-y-2 max-w-sm mx-auto">
                            <h4 className="text-base font-bold text-[#111111]">Sua lista está vazia</h4>
                            <p className="text-slate-400 text-xs leading-relaxed">
                                Navegue pela loja e adicione produtos aos favoritos clicando no ícone de coração nas fotos dos itens.
                            </p>
                        </div>
                        <Link
                            to="/shop"
                            className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#C5A880] text-white hover:text-[#111111] font-black py-4 px-6 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md animate-bounce"
                        >
                            Explorar Produtos
                            <ShoppingCart className="w-4 h-4" />
                        </Link>
                    </div>
                ) : (
                    /* Products Grid */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {wishlist.map(item => (
                            <div
                                key={item.id}
                                onClick={() => navigate(`/p/${item.id}`)}
                                className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-[#FBC02D]/10 transition-all duration-300 cursor-pointer flex flex-col h-full relative"
                            >
                                {/* Remove button floating */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFromWishlist(item.id);
                                    }}
                                    className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm hover:bg-rose-50 rounded-full p-2 text-slate-400 hover:text-rose-500 shadow-sm transition-all"
                                    title="Remover dos favoritos"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                {/* Product Image */}
                                <div className="aspect-square bg-white flex items-center justify-center p-6">
                                    <img
                                        src={item.image || 'https://placehold.co/400x400?text=Classe+A'}
                                        alt={item.name}
                                        className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                        onError={(e: any) => {
                                            e.target.src = 'https://placehold.co/400x400?text=Classe+A';
                                        }}
                                    />
                                </div>

                                {/* Details info */}
                                <div className="p-6 flex flex-col flex-grow space-y-3">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{item.category}</span>
                                    <h3 className="font-bold text-[#0B1221] leading-tight group-hover:text-[#C5A880] transition-colors line-clamp-2 min-h-[2.5rem] break-words">
                                        {item.name}
                                    </h3>
                                    {item.description && (
                                        <p
                                            className="text-[11px] text-slate-400 line-clamp-2 min-h-[1.5rem] leading-snug break-words"
                                            dangerouslySetInnerHTML={{ __html: item.description }}
                                        />
                                    )}

                                    <div className="mt-auto pt-4 flex flex-col gap-3">
                                        <span className="text-lg font-black text-[#0B1221] block">
                                            R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>

                                        <button
                                            onClick={(e) => handleAddToCartClick(e, item)}
                                            disabled={loadingId === item.id}
                                            className="w-full bg-[#111111] hover:bg-[#C5A880] text-white hover:text-[#111111] py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            {loadingId === item.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ShoppingCart className="w-4 h-4" />
                                            )}
                                            Adicionar ao Carrinho
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ClientLayout>
    );
};

export default ClientWishlist;
