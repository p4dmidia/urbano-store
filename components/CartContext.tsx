import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { ORGANIZATION_ID } from '../lib/config';
import { trackEvent } from '../lib/analytics';


export interface CartItem {
    id: number;
    name: string;
    price: number;
    image: string;
    category: string;
    quantity: number;
    stock_quantity: number;
    selectedVariations?: { [key: string]: string };
    variant_id?: string;
    reserved_until?: string;
}


interface CartContextType {
    cart: CartItem[];
    addToCart: (product: any, selectedVariations?: { [key: string]: string }) => void | Promise<void>;
    removeFromCart: (productId: number, selectedVariations?: { [key: string]: string }) => void;
    updateQuantity: (productId: number, quantity: number, selectedVariations?: { [key: string]: string }) => void | Promise<void>;
    clearCart: () => void;
    cartCount: number;
    cartTotal: number;
    sessionId: string;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [sessionId] = useState<string>(() => {
        let sid = localStorage.getItem('cart_session_id');
        if (!sid) {
            sid = 'cart_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
            localStorage.setItem('cart_session_id', sid);
        }
        return sid;
    });

    const [cart, setCart] = useState<CartItem[]>(() => {
        const savedCart = localStorage.getItem('cart');
        return savedCart ? JSON.parse(savedCart) : [];
    });

    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = async (product: any, selectedVariations?: { [key: string]: string }) => {
        let finalVariations = selectedVariations ? { ...selectedVariations } : {};
        let variantId = finalVariations.variant_id;
        let stockAvailable = product.stock_quantity ?? 999;

        // If no variant_id was provided, fetch the active variants from the DB
        if (!variantId) {
            try {
                const { data: dbVariants } = await supabase
                    .from('product_variants')
                    .select('id, size, color, stock_quantity')
                    .eq('product_id', product.id)
                    .eq('is_active', true);

                if (dbVariants && dbVariants.length > 0) {
                    const targetVariant = dbVariants.find(v => (v.stock_quantity ?? 0) > 0) || dbVariants[0];
                    variantId = targetVariant.id;
                    finalVariations.sizes = targetVariant.size;
                    finalVariations.colors = targetVariant.color;
                    finalVariations.variant_id = targetVariant.id;
                    stockAvailable = targetVariant.stock_quantity ?? 0;
                }
            } catch (err) {
                console.error('Failed to fetch fallback variant:', err);
            }
        }

        if (!variantId) {
            toast.error('Este produto não possui variações físicas disponíveis e não pode ser comprado.');
            return;
        }

        const requestedQuantity = product.quantity || 1;

        // --- RESERVA DE ESTOQUE BACKEND ---
        try {
            const { data: resData, error: resError } = await supabase.functions.invoke('checkout-engine/cart/add', {
                body: {
                    variant_id: variantId,
                    quantity: requestedQuantity,
                    session_id: sessionId,
                    organization_id: ORGANIZATION_ID
                }
            });

            if (resError || !resData || !resData.success) {
                const errMsg = resData?.message || resError?.message || 'Estoque indisponível ou reservado por outro cliente.';
                toast.error(errMsg);
                return;
            }

            const reservedUntil = resData.reserved_until;
            const price = product.price ?? product.base_price ?? 0;
            const normalizedProduct = {
                ...product,
                price
            };

            setCart(prev => {
                const existing = prev.find(item => 
                    item.id === normalizedProduct.id && 
                    JSON.stringify(item.selectedVariations) === JSON.stringify(finalVariations)
                );
                
                if (existing) {
                    return prev.map(item =>
                        (item.id === normalizedProduct.id && JSON.stringify(item.selectedVariations) === JSON.stringify(finalVariations))
                            ? { ...item, quantity: existing.quantity + requestedQuantity, reserved_until: reservedUntil } 
                            : item
                    );
                }

                return [...prev, { 
                    ...normalizedProduct, 
                    quantity: requestedQuantity, 
                    stock_quantity: stockAvailable, 
                    selectedVariations: finalVariations, 
                    variant_id: variantId,
                    reserved_until: reservedUntil
                }];
            });

            trackEvent('add_to_cart', {
                product_id: product.id,
                variant_id: variantId,
                quantity: requestedQuantity,
                price: price
            });

            toast.success('Item reservado no carrinho por 15 minutos!');
        } catch (err) {
            console.error('Reserve stock error:', err);
            toast.error('Erro ao conectar ao motor de reservas.');
        }
    };


    const removeFromCart = (productId: number, selectedVariations?: { [key: string]: string }) => {
        const itemToRemove = cart.find(item => 
            item.id === productId && JSON.stringify(item.selectedVariations) === JSON.stringify(selectedVariations)
        );

        if (itemToRemove && itemToRemove.variant_id) {
            supabase.functions.invoke('checkout-engine/cart/remove', {
                body: {
                    variant_id: itemToRemove.variant_id,
                    session_id: sessionId
                }
            }).catch(err => console.error('Failed to release reservation:', err));

            trackEvent('remove_from_cart', {
                product_id: itemToRemove.id,
                variant_id: itemToRemove.variant_id,
                quantity: itemToRemove.quantity
            });
        }

        setCart(prev => prev.filter(item => 
            !(item.id === productId && JSON.stringify(item.selectedVariations) === JSON.stringify(selectedVariations))
        ));
    };

    const updateQuantity = async (productId: number, quantity: number, selectedVariations?: { [key: string]: string }) => {
        if (quantity < 1) return;
        
        const item = cart.find(i => i.id === productId && JSON.stringify(i.selectedVariations) === JSON.stringify(selectedVariations));
        if (!item || !item.variant_id) return;

        try {
            // Ajustar a reserva de estoque para a nova quantidade
            const { data: resData, error: resError } = await supabase.functions.invoke('checkout-engine/cart/add', {
                body: {
                    variant_id: item.variant_id,
                    quantity: quantity,
                    session_id: sessionId,
                    organization_id: ORGANIZATION_ID
                }
            });

            if (resError || !resData || !resData.success) {
                const errMsg = resData?.message || resError?.message || 'Estoque insuficiente para esta quantidade.';
                toast.error(errMsg);
                return;
            }

            setCart(prev => prev.map(i => {
                if (i.id === productId && JSON.stringify(i.selectedVariations) === JSON.stringify(selectedVariations)) {
                    return { ...i, quantity, reserved_until: resData.reserved_until };
                }
                return i;
            }));
            toast.success('Reserva de estoque atualizada!');
        } catch (err) {
            console.error('Update reservation error:', err);
            toast.error('Erro ao atualizar quantidade no servidor.');
        }
    };


    const clearCart = () => setCart([]);

    const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, cartTotal, sessionId }}>
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
};
