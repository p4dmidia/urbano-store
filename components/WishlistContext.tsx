import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { trackEvent } from '../lib/analytics';

export interface WishlistItem {
    id: string;
    name: string;
    price: number;
    image: string;
    category: string;
    description?: string;
    stock_quantity?: number;
}

interface WishlistContextType {
    wishlist: WishlistItem[];
    addToWishlist: (product: any) => void;
    removeFromWishlist: (productId: string) => void;
    toggleWishlist: (product: any) => void;
    isInWishlist: (productId: string) => boolean;
    wishlistCount: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [wishlist, setWishlist] = useState<WishlistItem[]>(() => {
        try {
            const saved = localStorage.getItem('urbano_wishlist');
            return saved ? JSON.parse(saved) : [];
        } catch (err) {
            console.error('Failed to parse wishlist from localStorage:', err);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem('urbano_wishlist', JSON.stringify(wishlist));
        } catch (err) {
            console.error('Failed to save wishlist to localStorage:', err);
        }
    }, [wishlist]);

    const addToWishlist = (product: any) => {
        if (!product || !product.id) return;
        
        const price = product.price ?? product.base_price ?? 0;
        const image = product.display_image ?? product.image ?? (product.image_url ? product.image_url.split(',')[0].trim() : '');
        
        const item: WishlistItem = {
            id: product.id,
            name: product.name,
            price: price,
            image: image,
            category: product.category || (product.product_categories?.name) || 'Geral',
            description: product.description || '',
            stock_quantity: product.stock_quantity ?? 0
        };

        setWishlist(prev => {
            if (prev.some(i => i.id === item.id)) return prev;
            toast.success(`${product.name} adicionado aos favoritos!`);
            trackEvent('add_to_wishlist', { product_id: product.id, name: product.name });
            return [...prev, item];
        });
    };

    const removeFromWishlist = (productId: string) => {
        setWishlist(prev => {
            const item = prev.find(i => i.id === productId);
            if (item) {
                toast.success(`${item.name} removido dos favoritos.`);
                trackEvent('remove_from_wishlist', { product_id: productId });
            }
            return prev.filter(i => i.id !== productId);
        });
    };

    const toggleWishlist = (product: any) => {
        if (!product || !product.id) return;
        if (wishlist.some(i => i.id === product.id)) {
            removeFromWishlist(product.id);
        } else {
            addToWishlist(product);
        }
    };

    const isInWishlist = (productId: string) => {
        return wishlist.some(i => i.id === productId);
    };

    const wishlistCount = wishlist.length;

    return (
        <WishlistContext.Provider value={{ wishlist, addToWishlist, removeFromWishlist, toggleWishlist, isInWishlist, wishlistCount }}>
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    const context = useContext(WishlistContext);
    if (!context) throw new Error('useWishlist must be used within a WishlistProvider');
    return context;
};
