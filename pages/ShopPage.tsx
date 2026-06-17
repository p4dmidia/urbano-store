import React, { useState, useEffect } from 'react';
import { Search, Filter, ChevronDown, Grid, List, Star, ShoppingCart, Link, Check, Loader2, Heart } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useCart } from '../components/CartContext';
import { useWishlist } from '../components/WishlistContext';
import { useAuth } from '../components/AuthContext';
import CategorySidebar from '../components/CategorySidebar';
import toast from 'react-hot-toast';
import { ORGANIZATION_ID } from '../lib/config';
import { trackEvent } from '../lib/analytics';

const ShopPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const { toggleWishlist, isInWishlist } = useWishlist();

    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
    const [activeCategoryId, setActiveCategoryId] = useState<number | null>(searchParams.get('category_id') ? parseInt(searchParams.get('category_id')!) : null);
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [totalPages, setTotalPages] = useState(1);
    const productsPerPage = 20;

    const { user, profile } = useAuth();
    const tenantId = profile?.tenant_id || ORGANIZATION_ID;
    const [referralCode, setReferralCode] = useState<string | null>(null);

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

    // New Filters
    const [minPrice, setMinPrice] = useState<string>(searchParams.get('min') || '');
    const [maxPrice, setMaxPrice] = useState<string>(searchParams.get('max') || '');
    const [onlyInStock, setOnlyInStock] = useState<boolean>(searchParams.get('stock') === 'true');

    useEffect(() => {
        console.log("%c Classe A App Version: 4.5.4 - Strict Tenant Isolation ", "background: #FBC02D; color: #0B1221; font-weight: bold; padding: 4px; border-radius: 4px;");
        fetchCategories();
    }, []);

    useEffect(() => {
        const q = searchParams.get('q');
        const catId = searchParams.get('category_id');
        const min = searchParams.get('min');
        const max = searchParams.get('max');
        const stock = searchParams.get('stock');
        const page = searchParams.get('page');

        if (q !== null) setSearchTerm(q);
        if (catId !== null) setActiveCategoryId(parseInt(catId));
        else setActiveCategoryId(null);
        if (min !== null) setMinPrice(min);
        if (max !== null) setMaxPrice(max);
        if (stock !== null) setOnlyInStock(stock === 'true');
        if (page !== null) setCurrentPage(parseInt(page));
        else setCurrentPage(1);

        if (q) {
            trackEvent('search_performed', { query: q });
        }
        if (catId) {
            const catName = categories.find(c => c.id === parseInt(catId))?.name || 'Categoria';
            trackEvent('category_view', { category_id: catId, category_name: catName });
        }

        fetchProducts();
    }, [searchParams, categories]);

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('product_categories')
                .select('id, name, parent_id')
                .eq('tenant_id', tenantId)
                .order('name');

            if (error) throw error;
            if (data) {
                setCategories(data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const pageNum = parseInt(searchParams.get('page') || '1');
            const from = (pageNum - 1) * productsPerPage;
            const to = from + productsPerPage - 1;

            const effectiveOrgId = tenantId;
            console.log('DEBUG: Fetching products for org:', effectiveOrgId);
            let query = supabase
                .from('products')
                .select(`
                    *,
                    price:base_price,
                    product_categories (
                        id,
                        name
                    )
                `, { count: 'exact' })
                .eq('tenant_id', effectiveOrgId);

            const catId = searchParams.get('category_id');
            if (catId) {
                const numericCatId = parseInt(catId);
                const activeCat = categories.find(c => c.id === numericCatId);

                // Helper to get all descendant IDs locally
                const getDescendantIds = (parentId: number): number[] => {
                    const children = categories.filter(c => c.parent_id === parentId);
                    let ids = children.map(c => c.id);
                    children.forEach(c => {
                        ids = [...ids, ...getDescendantIds(c.id)];
                    });
                    return ids;
                };

                // If categories are not yet loaded, use only the current ID as fallback
                const idList = categories.length > 0 
                    ? [numericCatId, ...getDescendantIds(numericCatId)]
                    : [numericCatId];

                // If it's a subcategory (has a parent), restrict search to child of that parent
                if (activeCat && activeCat.parent_id) {
                    const branchIdList = [activeCat.parent_id, ...getDescendantIds(activeCat.parent_id)];

                    // Scope: must be in parent branch AND (match current cat ID OR match keyword in title)
                    query = query.in('category_id', branchIdList)
                        .or(`category_id.eq.${activeCat.id},name.ilike.%${activeCat.name}%`);
                } else {
                    // Top-level or categories not loaded yet: show the whole branch
                    query = query.in('category_id', idList);
                }
            }

            const q = searchParams.get('q');
            if (q) {
                const terms = q.trim().split(/\s+/);
                if (terms.length > 1) {
                    const conditions = terms
                        .filter(t => t.length > 2)
                        .map(t => `name.ilike.%${t}%,description.ilike.%${t}%`)
                        .join(',');
                    if (conditions) {
                        query = query.or(conditions);
                    } else {
                        query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
                    }
                } else {
                    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
                }
            }

            if (minPrice) {
                query = query.gte('base_price', parseFloat(minPrice));
            }

            if (maxPrice) {
                query = query.lte('base_price', parseFloat(maxPrice));
            }

            if (onlyInStock) {
                query = query.gt('stock_quantity', 0);
            }

            const sort = searchParams.get('sort') || 'newest';
            if (sort === 'price_asc') {
                query = query.order('base_price', { ascending: true });
            } else if (sort === 'price_desc') {
                query = query.order('base_price', { ascending: false });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error, count } = await query
                .range(from, to);

            if (error) throw error;

            const formatted = data?.map(p => ({
                ...p,
                price: p.price ?? p.base_price ?? 0,
                category: p.product_categories?.name || 'Sem Categoria',
                display_image: (p.image_url || p.image || '').split(',')[0].trim()
            }));

            setProducts(formatted || []);
            if (count !== null) {
                setTotalPages(Math.ceil(count / productsPerPage));
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Erro ao carregar produtos.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams);
        if (searchTerm) params.set('q', searchTerm);
        else params.delete('q');
        params.delete('page');
        setSearchParams(params);
    };

    const handleCategoryChange = (catId: number | null) => {
        const params = new URLSearchParams(searchParams);
        if (catId === null) params.delete('category_id');
        else params.set('category_id', catId.toString());
        params.delete('page');
        setSearchParams(params);
        setActiveCategoryId(catId);
    };

    const applyAdvancedFilters = () => {
        const params = new URLSearchParams(searchParams);
        if (minPrice) params.set('min', minPrice); else params.delete('min');
        if (maxPrice) params.set('max', maxPrice); else params.delete('max');
        if (onlyInStock) params.set('stock', 'true'); else params.delete('stock');
        params.delete('page');
        setSearchParams(params);
    };

    const handlePageChange = (page: number) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', page.toString());
        setSearchParams(params);
        window.scrollTo(0, 0);
    };

    const handleCopyAffiliateLink = (e: React.MouseEvent, productId: any) => {
        e.stopPropagation();
        
        if (!referralCode) {
            toast.error('Código de indicação não disponível.');
            return;
        }

        const domain = window.location.origin;
        const targetPath = `/p/${productId}`;
        const link = `${domain}/ref/${referralCode}?to=${encodeURIComponent(targetPath)}`;

        navigator.clipboard.writeText(link);
        setCopiedId(productId);
        toast.success('Link de indicação direta copiado!');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleAddToCart = (e: React.MouseEvent, product: any) => {
        e.stopPropagation();

        // Check if product has variations that need selection
        const variations = product.variations || {};
        const hasRequiredVariations = Object.keys(variations).some(key => 
            Array.isArray(variations[key]) && variations[key].length > 0
        );

        if (hasRequiredVariations) {
            toast('Por favor, selecione as opções do produto (tamanho, cor, etc.)', {
                icon: '👟',
            });
            navigate(`/p/${product.id}`);
            return;
        }

        addToCart(product);
        toast.success(`${product.name} adicionado ao carrinho!`);
    };

    const getCategoryPath = (catId: number | null): string => {
        if (!catId) return '';
        const cat = categories.find(c => c.id === catId);
        if (!cat) return '';
        if (cat.parent_id) {
            const parent = categories.find(p => p.id === cat.parent_id);
            if (parent) return `${parent.name} > ${cat.name}`;
        }
        return cat.name;
    };

    const currentCategoryName = getCategoryPath(activeCategoryId);

    return (
        <div className="bg-white min-h-screen">
            <div className="bg-slate-50 border-b border-slate-100 py-8">
                <div className="container mx-auto px-4">
                    <h1 className="text-4xl font-black text-[#0B1221] mb-2">Nossa Loja</h1>
                    <div className="flex items-center gap-2">
                        <nav className="text-sm font-medium text-slate-400">
                            Home / Loja {currentCategoryName && `/ ${currentCategoryName}`}
                        </nav>
                        <span className="text-[9px] text-slate-200">v4.5.4</span>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12 max-w-[1400px]">
                <div className="flex flex-col lg:flex-row gap-8">
                    <aside className="w-full lg:w-72 space-y-6 flex-shrink-0">
                        <CategorySidebar
                            categories={categories}
                            activeCategoryId={activeCategoryId}
                            onCategorySelect={handleCategoryChange}
                        />

                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <h4 className="font-semibold text-[#0B1221]">Preço</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="number"
                                    placeholder="Mín"
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs outline-none focus:border-[#FBC02D]"
                                />
                                <input
                                    type="number"
                                    placeholder="Máx"
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs outline-none focus:border-[#FBC02D]"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input
                                type="checkbox"
                                id="stock-filter"
                                checked={onlyInStock}
                                onChange={(e) => setOnlyInStock(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-200 text-[#FBC02D] focus:ring-[#FBC02D]"
                            />
                            <label htmlFor="stock-filter" className="text-sm text-slate-600 cursor-pointer select-none">
                                Apenas em estoque
                            </label>
                        </div>

                        <button
                            onClick={applyAdvancedFilters}
                            className="w-full bg-[#0B1221] text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1a253a] transition-colors"
                        >
                            Filtrar
                        </button>
                    </aside>

                        <div className="flex-grow min-w-0 space-y-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                                <form onSubmit={handleSearch} className="relative max-w-sm w-full">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar na loja..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-slate-50 rounded-lg py-2.5 px-10 outline-none focus:ring-2 focus:ring-[#FBC02D]/50 text-sm border border-slate-100"
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                </form>

                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-slate-500 whitespace-nowrap">
                                        Página <span className="font-bold text-[#0B1221]">{currentPage}</span> de <span className="font-bold text-[#0B1221]">{totalPages}</span>
                                    </span>
                                </div>
                            </div>
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-10 h-10 text-[#FBC02D] animate-spin" />
                                    <p className="font-bold text-slate-400">Buscando produtos...</p>
                                </div>
                            ) : (
                                <div className="w-full overflow-hidden">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {products.map(product => (
                                        <div
                                            key={product.id}
                                            onClick={() => navigate(`/p/${product.id}`)}
                                            className="group bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-xl hover:shadow-[#FBC02D]/10 transition-all duration-300 cursor-pointer flex flex-col h-full"
                                        >
                                            <div className="aspect-square relative overflow-hidden bg-white flex items-center justify-center p-4">
                                                <div 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleWishlist(product);
                                                    }}
                                                    className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm rounded-full p-2 text-[#0B1221] shadow-md hover:bg-white transition-all cursor-pointer"
                                                    title={isInWishlist(product.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                                                >
                                                    <Heart className={`w-3.5 h-3.5 transition-colors ${isInWishlist(product.id) ? 'fill-rose-500 text-rose-500' : 'text-slate-400 hover:text-rose-500'}`} />
                                                </div>
                                                <img
                                                    src={product.display_image || 'https://placehold.co/400x400?text=Classe+A'}
                                                    alt={product.name}
                                                    className="max-w-full max-h-full object-contain transition-all duration-500 group-hover:scale-105"
                                                    onError={(e: any) => {
                                                        e.target.src = 'https://placehold.co/400x400?text=Classe+A';
                                                    }}
                                                />
                                                 <div className="absolute top-4 right-4 flex flex-col gap-2">
                                                    {(product.stock_quantity ?? 0) > 0 && (
                                                        <div
                                                            onClick={(e) => handleAddToCart(e, product)}
                                                            className="bg-white/90 backdrop-blur-sm rounded-full p-2 text-[#0B1221] shadow-md -translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all cursor-pointer hover:bg-white"
                                                        >
                                                            <ShoppingCart className="w-4 h-4" />
                                                        </div>
                                                    )}
                                                    <div
                                                        onClick={(e) => handleCopyAffiliateLink(e, product.id)}
                                                        className={`bg-white shadow-md rounded-full p-2 -translate-y-12 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all delay-75 cursor-pointer relative ${copiedId === product.id ? 'text-emerald-500' : 'text-[#0B1221] hover:text-[#FBC02D]'}`}
                                                    >
                                                        {copiedId === product.id ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                                {(product.stock_quantity ?? 0) <= 0 && (
                                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                                                        <span className="bg-red-500 text-white text-[10px] font-black px-4 py-2 rounded-full shadow-lg transform -rotate-12 uppercase tracking-widest">
                                                            Sem Estoque
                                                        </span>
                                                    </div>
                                                )}

                                            </div>
                                            <div className="p-6 flex flex-col flex-grow space-y-3">
                                                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{product.category}</span>
                                                <h3 className="font-bold text-[#0B1221] leading-tight group-hover:text-[#FBC02D] transition-colors line-clamp-2 min-h-[2.5rem] break-words">{product.name}</h3>
                                                <p
                                                    className="text-[11px] text-slate-500 line-clamp-2 min-h-[1.5rem] leading-snug mt-1 break-words"
                                                    dangerouslySetInnerHTML={{ __html: product.description || 'Qualidade e conforto.' }}
                                                />
                                                <div className="mt-auto pt-2">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <span className="text-lg font-black text-[#0B1221]">
                                                            R$ {(product.price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <div className="flex text-[#FBC02D]">
                                                            {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-current" />)}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => handleAddToCart(e, product)}
                                                        disabled={(product.stock_quantity ?? 0) <= 0}
                                                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                                                            (product.stock_quantity ?? 0) > 0 
                                                            ? 'bg-slate-50 border border-slate-100 text-[#0B1221] group-hover:bg-[#FBC02D] group-hover:border-[#FBC02D]' 
                                                            : 'bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        <ShoppingCart className="w-3 h-3" />
                                                        {(product.stock_quantity ?? 0) > 0 ? 'Adicionar ao Carrinho' : 'Indisponível'}
                                                    </button>

                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!isLoading && totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 pt-12 pb-8">
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronDown className="w-5 h-5 rotate-90" />
                                </button>

                                {[...Array(totalPages)].map((_, i) => {
                                    const page = i + 1;
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`w-10 h-10 rounded-lg font-bold transition-all ${currentPage === page ? 'bg-[#FBC02D] text-[#0B1221]' : 'border border-slate-200 text-slate-400 hover:border-[#FBC02D] hover:text-[#FBC02D]'}`}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}

                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    className="p-2 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50 transition-colors"
                                >
                                    <ChevronDown className="w-5 h-5 -rotate-90" />
                                </button>
                            </div>
                        )}

                        {!isLoading && products.length === 0 && (
                            <div className="text-center py-20 px-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                                    <Search className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-[#0B1221]">Nenhum produto encontrado</h3>
                                <p className="text-slate-500 mt-2">Tente ajustar seus filtros ou mude sua pesquisa.</p>
                                <button
                                    onClick={() => { navigate('/shop'); setSearchTerm(''); setActiveCategoryId(null); }}
                                    className="mt-6 text-[#FBC02D] font-bold hover:underline"
                                >
                                    Limpar todos os filtros
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

export default ShopPage;
