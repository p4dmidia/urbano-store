import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
    ChevronLeft,
    ShoppingCart,
    Star,
    ShieldCheck,
    Truck,
    ArrowRight,
    Check,
    Loader2,
    Package,
    Copy,
    Link2,
    Sparkles,
    User,
    AlertCircle,
    X,
    Shirt,
    Ruler,
    CreditCard,
    Heart
} from 'lucide-react';
import { ORGANIZATION_ID } from '../lib/config';
import { supabase } from '../lib/supabase';
import { useCart } from '../components/CartContext';
import { useWishlist } from '../components/WishlistContext';
import { useAuth } from '../components/AuthContext';
import toast from 'react-hot-toast';
import { TryOnModal } from '../components/TryOnModal';
import { trackEvent } from '../lib/analytics';

const ProductDetails: React.FC = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();
    const [product, setProduct] = useState<any>(null);
    const [variants, setVariants] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const { user, profile } = useAuth();
    const tenantId = profile?.tenant_id || ORGANIZATION_ID;
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [isTryOnOpen, setIsTryOnOpen] = useState(false);

    const [sizeCharts, setSizeCharts] = useState<any[]>([]);
    const [bodyProfile, setBodyProfile] = useState<any>(null);
    const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
    const [isSizeChartModalOpen, setIsSizeChartModalOpen] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
    const [isRelatedLoading, setIsRelatedLoading] = useState(true);

    const isMasculino = !!(
        product?.product_categories?.name?.toLowerCase().includes('masculin') || 
        product?.product_categories?.parent?.name?.toLowerCase().includes('masculin') ||
        product?.name?.toLowerCase().includes('masculin') ||
        product?.name?.toLowerCase().includes('masc')
    );

    const loadBodyProfile = async () => {
        try {
            let data = null;
            if (user) {
                const { data: dbData, error: dbError } = await supabase
                    .from('user_body_profiles')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_default', true)
                    .order('updated_at', { ascending: false })
                    .limit(1);
                if (!dbError && dbData && dbData.length > 0) {
                    data = dbData[0];
                }
            }
            if (!data) {
                const localProfile = localStorage.getItem('urbano_body_profile');
                if (localProfile) {
                    data = JSON.parse(localProfile);
                }
            }
            setBodyProfile(data);
        } catch (err) {
            console.error('Error loading body profile:', err);
        }
    };

    const getRecommendedSize = (profile: any, charts: any[]) => {
        if (!profile || !charts || charts.length === 0) return null;
        
        const userChest = Number(profile.chest_cm) || 0;
        const userWaist = Number(profile.waist_cm) || 0;
        const userHips = Number(profile.hips_cm) || 0;
        const userShoulder = Number(profile.shoulder_cm) || 0;

        const sizeHierarchy = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'EG', 'EGG'];
        
        const fittingSizes = charts.filter(chart => {
            const chestOk = !chart.max_chest_cm || userChest <= Number(chart.max_chest_cm);
            
            let waistOk = true;
            if (isMasculino) {
                // Para produtos masculinos, a cintura armazena a largura dos ombros
                waistOk = !chart.max_waist_cm || userShoulder <= Number(chart.max_waist_cm);
            } else {
                waistOk = !chart.max_waist_cm || userWaist <= Number(chart.max_waist_cm);
            }
            
            // Para produtos masculinos, ignoramos o quadril
            const hipsOk = isMasculino || !chart.max_hips_cm || userHips <= Number(chart.max_hips_cm);
            
            return chestOk && waistOk && hipsOk;
        });

        if (fittingSizes.length > 0) {
            fittingSizes.sort((a, b) => {
                const idxA = sizeHierarchy.indexOf(a.size_label.toUpperCase());
                const idxB = sizeHierarchy.indexOf(b.size_label.toUpperCase());
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                return Number(a.max_chest_cm || 0) - Number(b.max_chest_cm || 0);
            });
            return fittingSizes[0].size_label;
        }

        let largestSize = charts[0];
        let maxChest = 0;
        charts.forEach(chart => {
            const cMax = Number(chart.max_chest_cm || 0);
            if (cMax > maxChest) {
                maxChest = cMax;
                largestSize = chart;
            }
        });
        return largestSize ? largestSize.size_label : null;
    };

    useEffect(() => {
        if (user) {
            const fetchReferral = async () => {
                const { data } = await supabase
                    .from('affiliates')
                    .select('referral_code')
                    .eq('user_id', user.id)
                    .single();
                if (data) setReferralCode(data.referral_code);
            };
            fetchReferral();
        }
    }, [user]);

    useEffect(() => {
        fetchProduct();
    }, [id]);

    useEffect(() => {
        loadBodyProfile();
    }, [id, user]);

    useEffect(() => {
        if (bodyProfile && (sizeCharts.length > 0 || variants.length > 0)) {
            if (sizeCharts.length > 0) {
                const size = getRecommendedSize(bodyProfile, sizeCharts);
                setRecommendedSize(size);
            } else {
                const height = Number(bodyProfile.height_cm) || 170;
                const weight = Number(bodyProfile.weight_kg) || 70;
                const gender = bodyProfile.gender || 'female';
                const chest = Number(bodyProfile.chest_cm) || ((gender === 'male' || isMasculino) ? weight * 1.35 : weight * 1.2);
                
                const availableSizesList = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
                
                let targetSize = 'M';
                if (gender === 'male' || isMasculino) {
                    if (chest <= 92) targetSize = 'P';
                    else if (chest <= 96) targetSize = 'M';
                    else if (chest <= 102) targetSize = 'G';
                    else targetSize = 'GG';
                } else {
                    if (chest <= 93) targetSize = 'P';
                    else if (chest <= 97) targetSize = 'M';
                    else if (chest <= 102) targetSize = 'G';
                    else targetSize = 'GG';
                }

                const closestMatch = availableSizesList.find(s => s.toUpperCase() === targetSize) || 
                                     availableSizesList.find(s => s.toUpperCase() === 'M') ||
                                     availableSizesList[0];
                setRecommendedSize(closestMatch || null);
            }
        } else {
            setRecommendedSize(null);
        }
    }, [bodyProfile, sizeCharts, variants]);

    const fetchProduct = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    price:base_price,
                    product_categories (
                        id,
                        name,
                        parent_id,
                        parent:parent_id (
                            id,
                            name
                        )
                    )
                `)
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .single();

            if (error) throw error;

            // Fetch variants from database
            const { data: variantsData, error: variantsError } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', id)
                .eq('is_active', true);

            if (variantsError) throw variantsError;

            // Fetch size charts from database
            const { data: sizeChartsData, error: sizeChartsError } = await supabase
                .from('size_charts')
                .select('*')
                .eq('product_id', id);

            if (!sizeChartsError && sizeChartsData) {
                setSizeCharts(sizeChartsData);
            }

            // Fetch real-time available stock for each variant using the RPC
            const variantsWithStock = await Promise.all(
                (variantsData || []).map(async (v: any) => {
                    const { data: availableStock } = await supabase.rpc('get_available_stock', { p_variant_id: v.id });
                    return {
                        ...v,
                        stock_quantity: availableStock !== null ? availableStock : v.stock_quantity
                    };
                })
            );
            setVariants(variantsWithStock);

            // Format data
            let categoryLabel = 'Geral';
            if (data.product_categories) {
                if (data.product_categories.parent) {
                    categoryLabel = `${data.product_categories.parent.name} > ${data.product_categories.name}`;
                } else {
                    categoryLabel = data.product_categories.name;
                }
            }

            const images = (data.image_url || data.image || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const formatted = {
                ...data,
                price: data.price ?? data.base_price ?? 0,
                category: categoryLabel,
                image: images[0] || 'https://placehold.co/600x600?text=Classe+A',
                images: images.length > 0 ? images : ['https://placehold.co/600x600?text=Classe+A']
            };

            setProduct(formatted);
        } catch (error) {
            console.error('Error fetching product:', error);
            toast.error('Produto não encontrado.');
            navigate('/shop');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRelatedProducts = async () => {
        if (!product) return;
        setIsRelatedLoading(true);
        try {
            // 1. Fetch products of the same category, excluding the current product
            const { data: related, error } = await supabase
                .from('products')
                .select(`
                    *,
                    product_categories (name)
                `)
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .neq('id', product.id)
                .eq('category_id', product.category_id)
                .limit(4);

            if (error) throw error;

            let finalRelated = related || [];

            // 2. If we have less than 4 related products, fetch additional active products
            if (finalRelated.length < 4) {
                const limit = 4 - finalRelated.length;
                const existingIds = [product.id, ...finalRelated.map(r => r.id)];
                const idFilter = `(${existingIds.join(',')})`;
                
                const { data: fallbackProducts, error: fallbackError } = await supabase
                    .from('products')
                    .select(`
                        *,
                        product_categories (name)
                    `)
                    .eq('tenant_id', tenantId)
                    .eq('is_active', true)
                    .not('id', 'in', idFilter)
                    .limit(limit)
                    .order('created_at', { ascending: false });

                if (!fallbackError && fallbackProducts) {
                    finalRelated = [...finalRelated, ...fallbackProducts];
                }
            }

            const formatted = finalRelated.map(p => ({
                ...p,
                category: p.product_categories?.name || 'Mais Vendido'
            }));

            setRelatedProducts(formatted);
        } catch (error) {
            console.error('Error fetching related products:', error);
        } finally {
            setIsRelatedLoading(false);
        }
    };

    useEffect(() => {
        if (product?.id) {
            fetchRelatedProducts();
        }
    }, [product?.id]);

    const [selectedVariations, setSelectedVariations] = useState<{ [key: string]: string }>({});

    const resolveVariant = (
        targetSize: string,
        targetColor: string,
        priority: 'size' | 'color'
    ) => {
        if (variants.length === 0) return null;

        // 1. Tenta encontrar a variante exata com estoque disponível
        let match = variants.find(
            v => v.size === targetSize && v.color === targetColor && (v.stock_quantity ?? 0) > 0
        );

        if (match) return match;

        // 2. Se a prioridade for tamanho (mudou tamanho), mantém o tamanho e procura qualquer cor com estoque
        if (priority === 'size') {
            const siblings = variants.filter(v => v.size === targetSize && (v.stock_quantity ?? 0) > 0);
            if (siblings.length > 0) return siblings[0];

            // Fallback: primeira variante daquele tamanho mesmo sem estoque
            const fallback = variants.find(v => v.size === targetSize);
            if (fallback) return fallback;
        }

        // 3. Se a prioridade for cor (mudou cor), mantém a cor e procura qualquer tamanho com estoque
        if (priority === 'color') {
            const siblings = variants.filter(v => v.color === targetColor && (v.stock_quantity ?? 0) > 0);
            if (siblings.length > 0) return siblings[0];

            // Fallback: primeira variante daquela cor mesmo sem estoque
            const fallback = variants.find(v => v.color === targetColor);
            if (fallback) return fallback;
        }

        // 4. Fallback final: primeira variante com estoque ou a primeira geral
        return variants.find(v => (v.stock_quantity ?? 0) > 0) || variants[0];
    };

    useEffect(() => {
        if (variants.length > 0) {
            // Auto-seleciona a primeira variante com estoque disponível ao carregar
            const defaultVariant = variants.find(v => (v.stock_quantity ?? 0) > 0) || variants[0];
            if (defaultVariant) {
                setSelectedVariations({
                    sizes: defaultVariant.size || '',
                    colors: defaultVariant.color || ''
                });
            }
        }
    }, [variants]);

    const availableSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
    const availableColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
    const isFootwear = product?.category?.toLowerCase().includes('calçado') || 
                       product?.category?.toLowerCase().includes('sapato');
    const sizeLabel = isFootwear ? 'Numeração' : 'Tamanho';

    const selectedVariant = variants.find(
        v => v.size === selectedVariations.sizes && v.color === selectedVariations.colors
    );
    const displayPrice = selectedVariant 
        ? ((product?.price || 0) + (Number(selectedVariant.additional_price) || 0)) 
        : (product?.price || 0);
    const currentStock = selectedVariant ? (selectedVariant.stock_quantity ?? 0) : (product?.stock_quantity ?? 0);

    const triggerVtonPrefetch = async (variantId: string) => {
        if (!user || !variantId) return;
        try {
            const variant = variants.find(v => v.id === variantId);
            if (!variant || (variant.stock_quantity ?? 0) <= 0) return;

            const images = (product?.image_url || product?.image || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            const garmentImage = variant.variant_image_url || images[0];

            await supabase.functions.invoke('generate-tryon/prefetch', {
                body: {
                    variant_id: variantId,
                    garment_image_url: garmentImage,
                    category: product?.category?.toLowerCase() || 'top',
                    color: variant.color || '',
                    size: variant.size || ''
                }
            });
        } catch (err) {
            console.log('Prefetch VTON skipped (normal background behavior):', err);
        }
    };

    useEffect(() => {
        if (selectedVariant?.id) {
            triggerVtonPrefetch(selectedVariant.id);
        }
    }, [selectedVariant?.id, user]);

    // Analytics tracking hooks
    useEffect(() => {
        if (product?.id) {
            trackEvent('product_view', { product_id: product.id, name: product.name, price: product.price });
        }
    }, [product?.id]);

    useEffect(() => {
        if (product?.id && selectedVariations.sizes) {
            trackEvent('size_selected', { product_id: product.id, size: selectedVariations.sizes });
        }
    }, [selectedVariations.sizes, product?.id]);

    useEffect(() => {
        if (product?.id && selectedVariations.colors) {
            trackEvent('color_selected', { product_id: product.id, color: selectedVariations.colors });
        }
    }, [selectedVariations.colors, product?.id]);

    useEffect(() => {
        if (product?.id && selectedVariant?.id) {
            trackEvent('variant_selected', { 
                product_id: product.id, 
                variant_id: selectedVariant.id,
                size: selectedVariant.size,
                color: selectedVariant.color
            });
        }
    }, [selectedVariant?.id, product?.id]);

    const isSizeOptionDisabled = (size: string) => {
        const sizeVariants = variants.filter(v => v.size === size);
        return sizeVariants.every(v => (v.stock_quantity ?? 0) <= 0);
    };

    const isColorOptionDisabled = (color: string) => {
        const colorVariants = variants.filter(v => v.color === color);
        return colorVariants.every(v => (v.stock_quantity ?? 0) <= 0);
    };

    const handleAddToCart = () => {
        if (!product) return;
        
        const missing = [];
        if (availableSizes.length > 1 && !selectedVariations.sizes) {
            missing.push(sizeLabel);
        }
        if (availableColors.length > 1 && !selectedVariations.colors) {
            missing.push('Cor');
        }

        if (missing.length > 0) {
            toast.error(`Por favor, selecione: ${missing.join(', ')}`);
            return;
        }

        if (variants.length > 0 && !selectedVariant) {
            toast.error('Combinação de tamanho e cor indisponível.');
            return;
        }

        const productToCart = {
            ...product,
            price: displayPrice,
            stock_quantity: currentStock
        };

        addToCart(productToCart, { ...selectedVariations, variant_id: selectedVariant?.id });
        toast.success(`${product.name} adicionado ao carrinho!`);
    };

    const handleCopyReferralLink = () => {
        if (!referralCode || !product) return;

        const missing = [];
        if (availableSizes.length > 1 && !selectedVariations.sizes) {
            missing.push(sizeLabel);
        }
        if (availableColors.length > 1 && !selectedVariations.colors) {
            missing.push('Cor');
        }

        if (missing.length > 0) {
            toast.error("Selecione as variações antes de copiar o link!");
            return;
        }

        const domain = window.location.origin;
        // Codifica as variações em base64 para o link
        const varsParam = Object.keys(selectedVariations).length > 0 
            ? `&vars=${btoa(JSON.stringify(selectedVariations))}`
            : '';
        
        const targetPath = `/p/${product.id}`;
        const link = `${domain}/ref/${referralCode}?to=${encodeURIComponent(targetPath)}`;

        navigator.clipboard.writeText(link);
        toast.success("Link de indicação direta copiado!");
    };

    const handleTryOnVariantChange = (size: string, color: string, priority: 'size' | 'color') => {
        const resolved = resolveVariant(size, color, priority);
        if (resolved) {
            setSelectedVariations({
                sizes: resolved.size || '',
                colors: resolved.color || ''
            });
        }
    };

    const handleOpenTryOn = () => {
        // Se nenhuma variante ativa estiver selecionada, seleciona a primeira disponível com estoque
        if (variants.length > 0 && !selectedVariant) {
            const firstActive = variants.find(v => (v.stock_quantity ?? 0) > 0) || variants[0];
            if (firstActive) {
                setSelectedVariations({
                    sizes: firstActive.size || '',
                    colors: firstActive.color || ''
                });
            }
        }
        setIsTryOnOpen(true);
    };

    const renderVariationSelector = (key: string, label: string, options: string[]) => {
        if (!options || options.length === 0 || (options.length === 1 && (options[0] === 'Único' || options[0] === 'Única'))) return null;
        return (
            <div className="space-y-3 mb-6" key={key}>
                <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-widest pl-1">
                    {key === 'sizes' ? `TAMANHO: ${selectedVariations.sizes || ''}` : label.toUpperCase()}
                </p>
                <div className="flex flex-wrap gap-2">
                    {options.map(opt => {
                        const isDisabled = key === 'sizes' ? isSizeOptionDisabled(opt) : isColorOptionDisabled(opt);
                        const isSelected = selectedVariations[key] === opt;
                        return (
                            <button
                                key={opt}
                                disabled={isDisabled}
                                onClick={() => {
                                    if (key === 'sizes') {
                                        const resolved = resolveVariant(opt, selectedVariations.colors, 'size');
                                        if (resolved) {
                                            setSelectedVariations({
                                                sizes: resolved.size || '',
                                                colors: resolved.color || ''
                                            });
                                        }
                                    } else {
                                        const resolved = resolveVariant(selectedVariations.sizes, opt, 'color');
                                        if (resolved) {
                                            setSelectedVariations({
                                                sizes: resolved.size || '',
                                                colors: resolved.color || ''
                                            });
                                        }
                                    }
                                }}
                                onMouseEnter={() => {
                                    if (isDisabled || !user) return;
                                    if (key === 'sizes') {
                                        const resolved = resolveVariant(opt, selectedVariations.colors, 'size');
                                        if (resolved?.id) {
                                            triggerVtonPrefetch(resolved.id);
                                        }
                                    } else {
                                        const resolved = resolveVariant(selectedVariations.sizes, opt, 'color');
                                        if (resolved?.id) {
                                            triggerVtonPrefetch(resolved.id);
                                        }
                                    }
                                }}
                                className={`flex items-center justify-center text-xs font-semibold border transition-all rounded-xl ${
                                    key === 'sizes' ? 'w-12 h-12 text-sm' : 'px-5 py-2.5'
                                } ${
                                    isSelected 
                                    ? 'bg-white border-2 border-zinc-950 text-black font-bold shadow-sm' 
                                    : isDisabled
                                    ? 'bg-zinc-50 border-zinc-200 text-zinc-300 cursor-not-allowed opacity-50 line-through'
                                    : 'bg-white border-zinc-200 text-zinc-800 hover:border-zinc-950'
                                }`}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
                <Loader2 className="w-10 h-10 text-[#FBC02D] animate-spin" />
                <p className="font-bold text-slate-400">Carregando produto...</p>
            </div>
        );
    }

    if (!product) return null;

    return (
        <div className="bg-white min-h-screen pb-20">
            <div className="container mx-auto px-4 py-8">
                <Link to="/shop" className="inline-flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-[#0B1221] transition-colors mb-8">
                    <ChevronLeft className="w-4 h-4" />
                    VOLTAR PARA LOJA
                </Link>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
                    {/* Image Gallery */}
                    <div className="flex flex-col md:flex-row gap-4 lg:gap-6">
                        {/* Thumbnails - Sidebar on Desktop */}
                        {product.images.length > 1 && (
                            <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:max-h-[500px] lg:max-h-[600px] no-scrollbar shrink-0 order-2 md:order-1 py-1 px-1">
                                {product.images.map((img: string, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImageIndex(idx)}
                                        onMouseEnter={() => setActiveImageIndex(idx)}
                                        className={`w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 transition-all shrink-0 relative group p-0 ${
                                            activeImageIndex === idx 
                                            ? 'border-[#FBC02D] shadow-lg shadow-[#FBC02D]/10 scale-[1.02] z-10' 
                                            : 'border-slate-100 hover:border-slate-300'
                                        }`}
                                    >
                                        <img 
                                            src={img} 
                                            alt={`${product.name} thumbnail ${idx + 1}`} 
                                            className={`w-full h-full object-cover transition-opacity duration-300 ${activeImageIndex === idx ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                                            onError={(e: any) => {
                                                e.target.src = 'https://placehold.co/600x600?text=Classe+A';
                                            }}
                                        />
                                        {activeImageIndex === idx && (
                                            <div className="absolute inset-0 bg-[#FBC02D]/10 ring-1 ring-inset ring-[#FBC02D]/20"></div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Main Image Container */}
                        <div className="flex-grow aspect-square bg-[#F8FAFC] rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm group relative order-1 md:order-2">
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                                <img
                                    key={activeImageIndex}
                                    src={selectedVariant?.variant_image_url || product.images[activeImageIndex]}
                                    alt={product.name}
                                    className="max-w-full max-h-full w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-all duration-700 animate-in fade-in zoom-in-95 ease-out"
                                    onError={(e: any) => {
                                        e.target.src = 'https://placehold.co/600x600?text=Classe+A';
                                    }}
                                />
                            </div>
                            
                            {/* Navigation Arrows for Mobile (Optional, but nice) */}
                            {product.images.length > 1 && (
                                <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveImageIndex(prev => (prev === 0 ? product.images.length - 1 : prev - 1));
                                        }}
                                        className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-600 hover:text-[#FBC02D] pointer-events-auto transition-colors shadow-lg"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveImageIndex(prev => (prev === product.images.length - 1 ? 0 : prev + 1));
                                        }}
                                        className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-600 hover:text-[#FBC02D] pointer-events-auto transition-colors shadow-lg rotate-180"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Product Info */}
                    <div className="flex flex-col">
                        <div className="space-y-3 mb-6">
                            {/* Badges inline */}
                            <div className="flex items-center gap-2">
                                <span className="bg-[#E53935] text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1">
                                    Liquida 6.6
                                </span>
                                <span className="bg-black text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1">
                                    Mais Vendido
                                </span>
                            </div>

                            <h1 className="text-2xl md:text-3xl font-semibold text-zinc-950 leading-snug tracking-tight">
                                {product.name}
                            </h1>

                            <div className="flex items-center gap-4">
                                <div className="flex text-zinc-900">
                                    {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                                </div>
                                <span className="text-xs text-zinc-400 font-medium">(48 avaliações de clientes)</span>
                            </div>

                            {currentStock > 0 ? (
                                <div className="flex flex-col gap-2 pt-1">
                                    <div className="flex text-emerald-600 gap-1.5 items-center font-bold text-xs">
                                        <Check className="w-4 h-4" />
                                        Em Estoque ({currentStock})
                                    </div>
                                    {currentStock <= 3 && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-600 rounded font-black text-[9px] uppercase tracking-wider animate-pulse w-fit">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            Últimas peças! Restam apenas {currentStock} unidades
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex text-red-500 gap-1.5 items-center font-bold text-xs pt-1">
                                    <Package className="w-4 h-4" />
                                    Indisponível
                                </div>
                            )}
                        </div>
                        {/* Pricing & Payments (White Background, inline) */}
                        <div className="space-y-4 mb-6">
                            {/* Prices Row */}
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-black">
                                    R$ {(displayPrice ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="text-zinc-400 text-sm line-through">
                                    R$ {((displayPrice ?? 0) * 1.4).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <span className="bg-[#E53935] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                    -30%
                                </span>
                            </div>
                            
                            {/* Installment Info */}
                            <p className="text-xs text-zinc-500">
                                em até 12x de <span className="font-semibold text-zinc-800">R$ {((displayPrice ?? 0) / 12).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </p>

                            {/* Payment Methods */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold rounded">
                                    7% OFF no pix
                                </span>
                                <span className="inline-flex items-center px-2.5 py-1 bg-[#0f5132] text-white text-[10px] font-bold rounded">
                                    Envio Prioritário
                                </span>
                            </div>

                            {/* Cashback Banner */}
                            <div className="flex items-center gap-2 bg-zinc-100 p-3 rounded-xl max-w-sm">
                                <span className="text-sm">💰</span>
                                <p className="text-zinc-700 text-xs font-bold">
                                    Ganhe R$ {((displayPrice ?? 0) * 0.1).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de CashBack!
                                </p>
                            </div>
                        </div>

                        {/* Description */}
                        <div
                            className="text-zinc-600 text-sm leading-relaxed mb-6 prose prose-zinc max-w-none"
                            dangerouslySetInnerHTML={{ __html: product.description || 'Este produto premium oferece qualidade incomparável e durabilidade, ideal para quem busca o melhor custo-benefício e sofisticação em cada detalhe.' }}
                        />

                        {/* Dimensions & Weight */}
                        {(product.weight > 0 || product.length > 0 || product.width > 0 || product.height > 0) && (
                            <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-zinc-100 mb-6 text-zinc-500">
                                {product.weight > 0 && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Peso</span>
                                        <span className="text-xs font-bold text-zinc-800">{product.weight} kg</span>
                                    </div>
                                )}
                                {(product.length > 0 || product.width > 0 || product.height > 0) && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Dimensões</span>
                                        <span className="text-xs font-bold text-zinc-800">
                                            {product.length || 0} x {product.width || 0} x {product.height || 0} cm
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Product Variations Selection */}
                        <div className="mb-6">
                            {availableSizes.length > 0 && (
                                <div className="mb-6">
                                    {renderVariationSelector('sizes', sizeLabel, availableSizes)}
                                    {!isFootwear && (
                                        <div className="mt-4 space-y-3 font-sans">
                                            {recommendedSize && (
                                                <p className="text-sm font-semibold text-zinc-800 flex items-center gap-1.5 pl-0.5">
                                                    <span>✨</span> Recomendamos o tamanho <span className="font-bold text-violet-600">{recommendedSize}</span>
                                                </p>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 max-w-md">
                                                <button
                                                    onClick={handleOpenTryOn}
                                                    className="bg-zinc-50/65 hover:bg-zinc-100 text-zinc-850 border border-zinc-200/80 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                                                >
                                                    <Shirt className="w-4 h-4 text-zinc-650 stroke-[1.6]" />
                                                    Provador Virtual
                                                </button>
                                                <button
                                                    onClick={() => setIsSizeChartModalOpen(true)}
                                                    className="bg-zinc-50/65 hover:bg-zinc-100 text-zinc-850 border border-zinc-200/80 py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                                                >
                                                    <Ruler className="w-4 h-4 text-zinc-650 stroke-[1.6]" />
                                                    Tabela de Medidas
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {availableColors.length > 0 && renderVariationSelector('colors', 'Cor', availableColors)}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4 mb-8">
                            {/* Quantity Selector */}
                            <div className="flex items-center bg-zinc-50 border border-zinc-200 rounded-xl px-1 py-1 shrink-0">
                                <button
                                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                    className="w-8 h-8 flex items-center justify-center font-semibold text-zinc-500 hover:text-black transition-colors"
                                >
                                    -
                                </button>
                                <span className="w-8 text-center font-bold text-zinc-800 text-sm">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(q => q + 1)}
                                    disabled={quantity >= currentStock}
                                    className="w-8 h-8 flex items-center justify-center font-semibold text-zinc-500 hover:text-black transition-colors disabled:opacity-30"
                                >
                                    +
                                </button>
                            </div>

                            {/* Add to Cart Button */}
                            <button
                                onClick={handleAddToCart}
                                disabled={currentStock <= 0}
                                className={`flex-grow font-bold py-4 px-8 rounded-xl transition-all uppercase tracking-wider text-xs flex items-center justify-center gap-2.5 ${
                                    currentStock > 0 
                                    ? 'bg-black hover:bg-zinc-900 text-white shadow-sm' 
                                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                }`}
                            >
                                <ShoppingCart className="w-4.5 h-4.5" />
                                {currentStock > 0 ? 'ADICIONAR AO CARRINHO' : 'ESGOTADO'}
                            </button>

                            {/* Wishlist Toggle Button */}
                            <button
                                onClick={() => toggleWishlist(product)}
                                className={`p-4 rounded-xl border transition-all flex items-center justify-center shrink-0 ${
                                    isInWishlist(product.id) 
                                    ? 'bg-rose-50/50 text-rose-500 border-rose-200 shadow-sm' 
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-500 hover:text-rose-500 hover:bg-zinc-100/50'
                                }`}
                                title={isInWishlist(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                            >
                                <Heart className={`w-4.5 h-4.5 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                            </button>

                            {/* Quick Referral link */}
                            {user && referralCode && (
                                <button
                                    onClick={handleCopyReferralLink}
                                    className="border border-zinc-300 text-zinc-700 hover:text-black hover:border-black font-semibold py-3.5 px-4 rounded-md transition-all text-xs uppercase tracking-wider"
                                    title="Copiar link de indicação direta para checkout"
                                >
                                    Indicação
                                </button>
                            )}
                        </div>

                        {/* Features */}
                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-zinc-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-700">
                                    <Truck className="w-4 h-4 stroke-[1.5]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Entrega Rápida</p>
                                    <p className="text-xs font-bold text-zinc-850">Todo Brasil</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center text-zinc-700">
                                    <ShieldCheck className="w-4 h-4 stroke-[1.5]" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Compra Segura</p>
                                    <p className="text-xs font-bold text-zinc-850">Garantia Classe A</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Related Products Section */}
            <section className="border-t border-zinc-100 pt-16 mt-16 pb-12">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
                        <span className="inline-block bg-[#FBC02D]/10 text-[#05080F] text-[10px] font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-xl border border-[#FBC02D]/25">
                            COMPLEMENTE SEU LOOK
                        </span>
                        <h2 className="text-3xl font-extrabold text-[#111111] tracking-tight">
                            Produtos Relacionados
                        </h2>
                        <p className="text-slate-500 text-sm md:text-base leading-relaxed">
                            As peças mais procuradas da nossa vitrine urbana que combinam perfeitamente com você.
                        </p>
                    </div>

                    {isRelatedLoading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 text-[#FBC02D] animate-spin" />
                        </div>
                    ) : relatedProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                            {relatedProducts.map((p) => {
                                const basePrice = p.base_price ?? p.price ?? 0;
                                const originalPrice = basePrice * 1.4;
                                const installment = basePrice / 12;
                                const cashback = basePrice * 0.1;

                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => {
                                            navigate(`/p/${p.id}`);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="group flex flex-col h-full bg-white border border-slate-100 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 cursor-pointer relative"
                                    >
                                        {/* Image Container */}
                                        <div className="relative aspect-[3/4] overflow-hidden bg-zinc-50 flex items-center justify-center">
                                            <img
                                                src={(p.image_url || p.image || '').split(',')[0]?.trim() || 'https://placehold.co/600x600?text=Classe+A'}
                                                alt={p.name}
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                onError={(e: any) => {
                                                    e.target.src = 'https://placehold.co/600x600?text=Classe+A';
                                                }}
                                            />
                                            
                                            {/* Wishlist toggle */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleWishlist(p);
                                                }}
                                                className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-sm rounded-xl p-2.5 text-zinc-800 shadow-sm hover:bg-white transition-all"
                                                title={isInWishlist(p.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                            >
                                                <Heart className={`w-4 h-4 transition-colors ${isInWishlist(p.id) ? 'fill-rose-500 text-rose-500' : 'text-zinc-400 hover:text-rose-500'}`} />
                                            </button>

                                            {/* Top badges */}
                                            <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
                                                <span className="bg-[#E53935] text-white text-[9px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                                                    LIQUIDA 6.6
                                                </span>
                                                <span className="bg-black text-white text-[9px] font-black tracking-wider px-2 py-0.5 rounded uppercase">
                                                    MAIS VENDIDO
                                                </span>
                                            </div>
                                        </div>

                                        {/* Info Panel */}
                                        <div className="p-5 flex flex-col flex-grow justify-between space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{p.category}</p>
                                                <h3 className="font-bold text-zinc-950 text-sm line-clamp-2 leading-snug group-hover:text-zinc-700 transition-colors">
                                                    {p.name}
                                                </h3>
                                            </div>

                                            <div className="space-y-3 pt-2">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-zinc-950 font-black text-lg">
                                                        R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-zinc-400 text-xs line-through">
                                                        R$ {originalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="bg-[#E53935] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                                        -30%
                                                    </span>
                                                </div>

                                                <p className="text-xs text-zinc-500 font-medium">
                                                    em até 12x de <span className="font-bold text-[#111111]">R$ {installment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                </p>

                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="inline-flex items-center text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md">
                                                        7% OFF no pix
                                                    </span>
                                                    <span className="inline-flex items-center text-[9px] font-bold text-white bg-emerald-800 px-2 py-0.5 rounded-md">
                                                        Envio Prioritário
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 p-2.5 bg-[#F5F5F5] rounded-xl border border-slate-105 text-[10px] text-slate-600 font-bold">
                                                    <span>💰</span>
                                                    <span>Ganhe R$ {cashback.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de CashBack!</span>
                                                </div>

                                                <div className="pt-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            addToCart(p);
                                                            toast.success(`${p.name} adicionado ao carrinho!`);
                                                        }}
                                                        disabled={(p.stock_quantity ?? 0) <= 0}
                                                        className={`w-full font-bold py-3.5 px-4 rounded-xl text-xs uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-sm ${
                                                            (p.stock_quantity ?? 0) > 0 
                                                            ? 'bg-black hover:bg-zinc-900 text-white' 
                                                            : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <ShoppingCart className="w-4 h-4 shrink-0" />
                                                        {(p.stock_quantity ?? 0) > 0 ? 'Adicionar ao Carrinho' : 'Esgotado'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-zinc-400 font-bold py-10">Nenhum produto relacionado encontrado.</p>
                    )}
                </div>
            </section>

            <TryOnModal
                isOpen={isTryOnOpen}
                onClose={() => {
                    setIsTryOnOpen(false);
                    loadBodyProfile();
                }}
                product={product}
                activeVariant={selectedVariant}
                variants={variants}
                onVariantChange={handleTryOnVariantChange}
            />

            {/* Size Chart Modal */}
            {isSizeChartModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl relative animate-in zoom-in-95 duration-300 mx-4">
                        <button 
                            onClick={() => setIsSizeChartModalOpen(false)}
                            className="absolute top-6 right-6 w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-[#FBC02D]/10 rounded-xl flex items-center justify-center text-[#0B1221]">
                                <AlertCircle className="w-5 h-5 text-[#0B1221]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-[#0B1221]">Tabela de Medidas</h3>
                                <p className="text-xs text-slate-400 font-bold mt-0.5">Confira as dimensões ideais de corpo para cada tamanho.</p>
                            </div>
                        </div>
                        
                        {sizeCharts.length > 0 ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                                <table className="w-full text-xs font-bold text-slate-600 text-center">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-400">
                                        <tr>
                                            <th className="py-3 px-4 text-left">Tam.</th>
                                            <th className="py-3 px-4">{isMasculino ? 'Tórax' : 'Busto/Peito'}</th>
                                            <th className="py-3 px-4">{isMasculino ? 'Ombros' : 'Cintura'}</th>
                                            {!isMasculino && <th className="py-3 px-4">Quadril</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {sizeCharts.map((chart: any) => (
                                            <tr key={chart.id} className="hover:bg-slate-50/50">
                                                <td className="py-3.5 px-4 text-left font-black text-[#0B1221]">{chart.size_label}</td>
                                                <td className="py-3.5 px-4">
                                                    {chart.min_chest_cm && chart.max_chest_cm 
                                                        ? `${chart.min_chest_cm} - ${chart.max_chest_cm} cm`
                                                        : chart.max_chest_cm ? `Até ${chart.max_chest_cm} cm` : '-'}
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    {chart.min_waist_cm && chart.max_waist_cm 
                                                        ? `${chart.min_waist_cm} - ${chart.max_waist_cm} cm`
                                                        : chart.max_waist_cm ? `Até ${chart.max_waist_cm} cm` : '-'}
                                                </td>
                                                {!isMasculino && (
                                                    <td className="py-3.5 px-4">
                                                        {chart.min_hips_cm && chart.max_hips_cm 
                                                            ? `${chart.min_hips_cm} - ${chart.max_hips_cm} cm`
                                                            : chart.max_hips_cm ? `Até ${chart.max_hips_cm} cm` : '-'}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-500 font-bold text-center py-6">Nenhuma tabela de medidas disponível para este produto.</p>
                        )}
                        
                        <button 
                            onClick={() => setIsSizeChartModalOpen(false)}
                            className="w-full mt-6 bg-[#0B1221] hover:bg-[#1a2436] text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center"
                        >
                            Fechar Tabela
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductDetails;
