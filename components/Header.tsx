import React, { useState } from 'react';
import { Search, User, ShoppingCart, Menu, X, Heart } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ORGANIZATION_ID } from '../lib/config';
import { supabase } from '../lib/supabase';
import { useCart } from './CartContext';
import { useWishlist } from './WishlistContext';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const [categories, setCategories] = useState<{ label: string; path: string; icon?: boolean; id?: number }[]>([
    { label: 'Todos', path: '/shop' }
  ]);

  React.useEffect(() => {
    fetchMainCategories(ORGANIZATION_ID);
  }, []);

  const fetchMainCategories = async (orgId: string) => {
    try {
      const { data, error } = await supabase
          .from('product_categories')
          .select('id, name')
          .is('parent_id', null)
          .eq('tenant_id', orgId)
          .order('name');

      if (error) throw error;

      if (data) {
        const dynamicCats = data
          .filter(cat => !['Consórcio', 'ACESSÓRIOS', 'Acessórios', 'ACESSORIOS'].includes(cat.name))
          .map(cat => ({
            label: cat.name,
            path: `/shop?category_id=${cat.id}`,
            id: cat.id
          }));
        setCategories([
          { label: 'Todos', path: '/shop' },
          ...dynamicCats
        ]);
      }
    } catch (error) {
      console.error('Error fetching header categories:', error);
      setCategories([
        { label: 'Todos', path: '/shop' },
        { label: 'Calçados', path: '/shop?category_id=19' },
        { label: 'Vestuário', path: '/shop?category_id=5' },
        { label: 'Acessórios', path: '/shop?category_id=1' }
      ]);
    }
  };

  return (
    <header className="w-full bg-[#020204] text-white border-b border-slate-900 sticky top-0 z-50">
      {/* Top Bar */}
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-6">
        
        {/* Logo Image */}
        <Link to="/" className="flex items-center" onClick={() => setIsMenuOpen(false)}>
          <img src="/assets/logo.png" alt="Urbano Store" className="h-16 md:h-20 w-auto object-contain brightness-110" />
        </Link>

        {/* Navigation Menus in Uppercase */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-200">
          <Link to="/" className="hover:text-[#C5A880] transition-colors pb-1 border-b border-transparent hover:border-[#C5A880]">Início</Link>
          <Link to="/shop" className="hover:text-[#C5A880] transition-colors pb-1 border-b border-transparent hover:border-[#C5A880]">Produtos</Link>
          <Link to="/register" className="hover:text-[#C5A880] transition-colors pb-1 border-b border-transparent hover:border-[#C5A880]">Cadastre-se</Link>
        </nav>

        {/* Search Bar - styled like the screenshot */}
        <form onSubmit={handleSearch} className="flex-grow max-w-sm relative hidden lg:block">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar tendências..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-slate-400 focus:bg-white focus:text-[#111111] focus:placeholder-slate-400 rounded-xl py-2.5 pl-11 pr-4 outline-none transition-all text-sm border border-white/5 focus:border-[#C5A880]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
        </form>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <Link to="/dashboard/wishlist" className="relative p-2 text-slate-200 hover:text-[#C5A880] transition-colors" title="Meus Favoritos">
            <Heart className="w-5.5 h-5.5 md:w-6 md:h-6" />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#020204]">
                {wishlistCount}
              </span>
            )}
          </Link>

          <Link to="/checkout" className="relative p-2 text-slate-200 hover:text-[#C5A880] transition-colors">
            <ShoppingCart className="w-5.5 h-5.5 md:w-6 md:h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#C5A880] text-[#111111] text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#111111]">
                {cartCount}
              </span>
            )}
          </Link>

          <Link to="/login" className="hidden sm:flex bg-[#C5A880] hover:bg-[#B59870] transition-all rounded-lg py-2.5 px-4 items-center gap-2 text-xs font-bold text-[#111111] uppercase tracking-wider shadow-md">
            <User className="w-4 h-4 shrink-0" />
            Minha Conta
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-slate-200 hover:text-[#C5A880] transition-colors"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Categories Bar - Desktop Only */}
      <div className="border-t border-slate-900 bg-[#0b0b0e] hidden md:block">
        <div className="container mx-auto px-4 overflow-x-auto">
          <ul className="flex items-center gap-8 py-3.5 whitespace-nowrap text-xs font-bold uppercase tracking-widest">
            {categories.map((cat, idx) => {
              const currentCatId = searchParams.get('category_id');
              const isActive = (cat.label === 'Todos' && !currentCatId && window.location.pathname === '/shop') || 
                               (cat.id && currentCatId === cat.id.toString());

              return (
                <li key={idx}>
                  <Link
                    to={cat.path}
                    className={`transition-colors ${isActive ? 'text-[#C5A880] border-b-2 border-[#C5A880] pb-3.5 -mb-3.5' :
                      'text-slate-400 hover:text-[#C5A880]'
                      }`}
                  >
                    {cat.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`
        fixed inset-0 z-50 bg-[#020204] transition-transform duration-300 md:hidden
        ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-8">
            <img src="/assets/logo.png" alt="Urbano Store" className="h-16 w-auto object-contain" />
            <button onClick={() => setIsMenuOpen(false)} className="text-white p-2">
              <X className="w-8 h-8" />
            </button>
          </div>

          <form onSubmit={(e) => { handleSearch(e); setIsMenuOpen(false); }} className="relative mb-8">
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full bg-white/10 text-white rounded-xl py-4 px-11 outline-none focus:ring-2 focus:ring-[#C5A880]/50"
            />
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          </form>

          <nav className="flex flex-col gap-6 text-lg font-bold uppercase tracking-wider text-white mb-12">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className="hover:text-[#C5A880]">Início</Link>
            <Link to="/shop" onClick={() => setIsMenuOpen(false)} className="hover:text-[#C5A880]">Produtos</Link>
            <Link to="/register" onClick={() => setIsMenuOpen(false)} className="hover:text-[#C5A880]">Cadastre-se</Link>
            <Link to="/login" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 text-[#C5A880]">
              <User className="w-5 h-5" />
              Minha Conta
            </Link>
          </nav>

          <div className="mt-auto pt-8 border-t border-white/10">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Categorias</p>
            <div className="grid grid-cols-2 gap-4">
              {categories.map((cat, idx) => (
                <Link
                  key={idx}
                  to={cat.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-white/70 hover:text-[#C5A880] text-sm font-bold py-2 uppercase tracking-wide"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
