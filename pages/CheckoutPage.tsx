
import React, { useState } from 'react';
import {
    ShieldCheck,
    ShoppingCart,
    CreditCard,
    Truck,
    Lock,
    CheckCircle2,
    AlertCircle,
    FileText,
    ArrowRight,
    ChevronLeft,
    Loader2,
    Sparkles
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../components/CartContext';
import { useAuth } from '../components/AuthContext';
import { ORGANIZATION_ID } from '../lib/config';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import Cookies from 'js-cookie';
import { trackEvent } from '../lib/analytics';

const CheckoutPage: React.FC = () => {
    const navigate = useNavigate();
    const { cart, cartTotal, addToCart, removeFromCart, updateQuantity, clearCart, sessionId } = useCart();
    const { user, profile } = useAuth();
    const tenantId = profile?.tenant_id || ORGANIZATION_ID;
    const [acceptedConsorcio, setAcceptedConsorcio] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'credit' | 'pix'>('credit');
    const [isLoading, setIsLoading] = useState(false);
    const [pixData, setPixData] = useState<any>(null);
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        phone: '',
        cpf: '',
        address: '',
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: ''
    });

    const [shippingOptions, setShippingOptions] = useState<any[]>([]);
    const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
    const [selectedShipping, setSelectedShipping] = useState<any>(null);
    const [isEditingProfile, setIsEditingProfile] = useState(true);

    // VTON preview images
    const [vtonImages, setVtonImages] = useState<{[key: string]: string}>({});

    React.useEffect(() => {
        if (user && cart.length > 0) {
            const fetchVtonSessions = async () => {
                try {
                    const variantIds = cart.map(item => item.variant_id).filter(Boolean);
                    if (variantIds.length === 0) return;

                    const { data, error } = await supabase
                        .from('ai_tryon_sessions')
                        .select('variant_id, ai_generated_assets(generated_url)')
                        .eq('user_id', user.id)
                        .eq('status', 'completed')
                        .in('variant_id', variantIds);

                    if (data && data.length > 0) {
                        const imagesMap: {[key: string]: string} = {};
                        data.forEach((session: any) => {
                            const url = session.ai_generated_assets?.generated_url;
                            if (url && session.variant_id) {
                                imagesMap[session.variant_id] = url;
                            }
                        });
                        setVtonImages(imagesMap);
                    }
                } catch (err) {
                    console.error('Error fetching VTON sessions for checkout:', err);
                }
            };
            fetchVtonSessions();
        }
    }, [user, cart]);

    // Hold/Reservation countdown timer
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const paymentCompletedRef = React.useRef(false);

    React.useEffect(() => {
        if (cart.length > 0) {
            trackEvent('checkout_started', {
                items_count: cart.length,
                value: cartTotal
            });
        }

        return () => {
            if (!paymentCompletedRef.current && cart.length > 0) {
                trackEvent('checkout_abandoned', {
                    items_count: cart.length,
                    value: cartTotal
                });
            }
        };
    }, []);

    React.useEffect(() => {
        const activeReservations = cart.filter(item => item.reserved_until).map(item => new Date(item.reserved_until!).getTime());
        if (activeReservations.length === 0) {
            setTimeLeft(null);
            return;
        }

        const minReservedUntil = Math.min(...activeReservations);

        const updateTimer = () => {
            const now = Date.now();
            const diff = minReservedUntil - now;

            if (diff <= 0) {
                setTimeLeft("Expirada");
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [cart]);

    // Outfit Engine upsell recommendations
    const [checkoutRecommendations, setCheckoutRecommendations] = useState<any[]>([]);
    const [isFetchingRecs, setIsFetchingRecs] = useState(false);

    React.useEffect(() => {
        if (cart.length > 0) {
            const firstItemVariantId = cart[0].variant_id;
            if (firstItemVariantId) {
                const fetchCheckoutRecs = async () => {
                    setIsFetchingRecs(true);
                    try {
                        const { data, error } = await supabase.functions.invoke(`generate-tryon/outfit/recommendations/${firstItemVariantId}`, {
                            method: 'GET'
                        });
                        if (!error && data && data.recommendations) {
                            const cartVariantIds = cart.map(item => item.variant_id);
                            const filtered = data.recommendations.filter((rec: any) => !cartVariantIds.includes(rec.variant_id));
                            setCheckoutRecommendations(filtered.slice(0, 2));
                        }
                    } catch (err) {
                        console.error('Failed to fetch checkout recommendations:', err);
                    } finally {
                        setIsFetchingRecs(false);
                    }
                };
                fetchCheckoutRecs();
            }
        } else {
            setCheckoutRecommendations([]);
        }
    }, [cart]);

    React.useEffect(() => {
        if (user) {
            const fetchProfile = async () => {
                try {
                    const { data, error } = await supabase
                        .from('user_profiles')
                        .select('full_name, email, whatsapp, cpf, cnpj, address, cep, street, number, complement, neighborhood, city, state')
                        .eq('id', user.id)
                        .single();

                    if (data) {
                        setCustomerInfo({
                            name: data.full_name || user.user_metadata?.full_name || user.user_metadata?.nome || '',
                            email: data.email || user.email || '',
                            phone: data.whatsapp || '',
                            cpf: data.cpf || data.cnpj || '',
                            address: data.address || '',
                            cep: data.cep || '',
                            street: data.street || '',
                            number: data.number || '',
                            complement: data.complement || '',
                            neighborhood: data.neighborhood || '',
                            city: data.city || '',
                            state: data.state || ''
                        });
                        // If we have at least name and email, consider it identified
                        if (data.full_name || data.email) {
                            setIsEditingProfile(false);
                        }
                    }
                } catch (error) {
                    console.error('Error auto-filling profile:', error);
                }
            };
            fetchProfile();
        }

        // Handle direct buy link
        const params = new URLSearchParams(window.location.search);
        const buyId = params.get('buy');
        const varsEncoded = params.get('vars');

        if (buyId) {
            const processDirectBuy = async () => {
                try {
                    const { data: product, error } = await supabase
                        .from('products')
                        .select('*, price:base_price')
                        .eq('id', buyId)
                        .single();
                    
                    if (error || !product) return;

                    let selectedVars = {};
                    if (varsEncoded) {
                        try {
                            // Decode from base64
                            selectedVars = JSON.parse(atob(varsEncoded));
                        } catch (e) {
                            console.error("Error parsing variations", e);
                        }
                    }

                    // Pre-fill fields needed for addToCart if they are different in DB vs CartItem
                    const images = (product.image_url || product.image || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                    const formattedProduct = {
                        ...product,
                        price: product.price ?? product.base_price ?? 0,
                        image: images[0] || 'https://placehold.co/600x600?text=Classe+A'
                    };

                    addToCart(formattedProduct, selectedVars);
                    
                    // Clear params from URL to prevent re-adding on refresh
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, '', newUrl);
                    
                    toast.success(`${product.name} adicionado para compra rápida!`, { icon: '🛒' });
                } catch (e) {
                    console.error('Error processing direct buy:', e);
                }
            };
            processDirectBuy();
        }
    }, [user]);

    const isShippingRequired = true;
    const isAddressRequired = true; // Sempre pedir endereço para fins de cadastro
    const subtotal = cartTotal;
    const shipping = selectedShipping ? parseFloat(selectedShipping.price) : 0;
    const total = subtotal + shipping;

    const calculateShipping = async () => {
        if (!isShippingRequired) {
            toast.success('Produtos digitais possuem frete isento!');
            return;
        }

        if (!customerInfo.cep || customerInfo.cep.length < 8) {
            toast.error('Informe um CEP válido para calcular o frete.');
            return;
        }

        setIsCalculatingShipping(true);
        setSelectedShipping(null);

        try {
            // Isenção de Frete Específica (MEIA)
            const freeShippingProductIds = ['0c53e1fe-6660-485f-84c1-f13a0550229a'];
            const itemsToCalculate = cart.filter(item => 
                !freeShippingProductIds.includes(item.id) && 
                !item.name.toLowerCase().includes('meia')
            );

            // Se sobrar apenas itens com frete grátis
            if (itemsToCalculate.length === 0 && cart.length > 0) {
                const freeOption = {
                    id: 'fixed-delivery',
                    name: 'Frete Grátis',
                    price: '0.00',
                    delivery_time: 15,
                    company: { 
                        name: 'Classe A Logística', 
                        picture: 'https://clnuievcdnbwqbyqhwys.supabase.co/storage/v1/object/public/logos/classea-icon.png' 
                    }
                };
                setShippingOptions([freeOption]);
                setSelectedShipping(freeOption);
                toast.success('Seu pedido possui frete grátis!');
                return;
            }

            const { data, error } = await supabase.functions.invoke('calculate-shipping', {
                body: {
                    zip: customerInfo.cep,
                    items: itemsToCalculate.map(item => ({ id: item.id, quantity: item.quantity })),
                    tenant_id: tenantId,
                    organization_id: tenantId
                }
            });

            if (error) throw error;
            setShippingOptions(data || []);
            if (data && data.length > 0) {
                toast.success('Frete calculado!');
            } else {
                toast.error('Nenhuma opção de frete encontrada para este CEP.');
            }
        } catch (error: any) {
            console.error('Shipping error:', error);
            toast.error('Erro ao calcular frete: ' + (error.message || 'Tente novamente.'));
        } finally {
            setIsCalculatingShipping(false);
        }
    };

    const handleConfirmOrder = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.cpf) {
            toast.error('Por favor, preencha seus dados básicos e o CPF.');
            return;
        }

        // Full address validation
        if (!customerInfo.cep || !customerInfo.street || !customerInfo.number || !customerInfo.neighborhood || !customerInfo.city || !customerInfo.state) {
            toast.error('Por favor, preencha o endereço completo.');
            return;
        }

        if (isShippingRequired && !selectedShipping) {
            toast.error('Por favor, selecione uma opção de frete.');
            return;
        }

        setIsLoading(true);

        try {
            const orderId = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const payload = {
                order_id: orderId,
                customer_info: {
                    name: customerInfo.name,
                    email: customerInfo.email,
                    phone: customerInfo.phone,
                    cpf: customerInfo.cpf,
                    cep: customerInfo.cep,
                    street: customerInfo.street,
                    number: customerInfo.number,
                    complement: customerInfo.complement,
                    neighborhood: customerInfo.neighborhood,
                    city: customerInfo.city,
                    state: customerInfo.state
                },
                payment_method: paymentMethod,
                shipping_cost: shipping,
                shipping_method: selectedShipping?.name || 'Não informado',
                cart_items: cart.map(item => ({
                    variant_id: item.variant_id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    selectedVariations: item.selectedVariations
                })),
                session_id: sessionId,
                tenant_id: tenantId,
                organization_id: tenantId,
                user_id: user?.id,
                origin: window.location.origin
            };

            const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('checkout-engine/checkout/start', {
                body: payload
            });

            if (paymentError) {
                console.error('Edge Function Error Details:', paymentError);
                let detailedMessage = '';
                if ((paymentError as any).context?.data) {
                    const errorData = (paymentError as any).context.data;
                    detailedMessage = errorData.error || errorData.message || (typeof errorData === 'string' ? errorData : '');
                }
                if (!detailedMessage && paymentError.message) {
                    detailedMessage = paymentError.message;
                }
                throw new Error(detailedMessage || 'Erro ao processar pagamento via Mercado Pago.');
            }

            if (paymentResult && paymentResult.error) {
                throw new Error(paymentResult.message || 'Erro ao processar pagamento.');
            }

            // Update user profile if logged in
            if (user) {
                await supabase
                    .from('user_profiles')
                    .update({
                        full_name: customerInfo.name,
                        whatsapp: customerInfo.phone,
                        cpf: customerInfo.cpf,
                        cep: customerInfo.cep,
                        street: customerInfo.street,
                        number: customerInfo.number,
                        complement: customerInfo.complement,
                        neighborhood: customerInfo.neighborhood,
                        city: customerInfo.city,
                        state: customerInfo.state,
                        address: `${customerInfo.street}, ${customerInfo.number}`
                    })
                    .eq('id', user.id);
            }

            if (paymentMethod === 'pix') {
                if (!paymentResult.ticket_url) {
                    throw new Error('Erro ao gerar link do PIX. Tente novamente.');
                }
                paymentCompletedRef.current = true;
                clearCart();
                window.location.href = paymentResult.ticket_url;
                toast.success('Redirecionando para o pagamento...');
            } else {
                if (!paymentResult.init_point) {
                    throw new Error('Link de pagamento não gerado. Verifique os dados do cartão.');
                }
                paymentCompletedRef.current = true;
                clearCart();
                window.location.href = paymentResult.init_point;
            }

        } catch (error: any) {
            console.error('Checkout error:', error);
            toast.error('Erro ao processar pedido: ' + (error.message || 'Tente novamente.'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans pb-32">
            {/* Simple Header */}
            <header className="bg-white border-b border-slate-100 py-6">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <Link to="/shop" className="flex items-center gap-2 text-slate-500 font-bold text-sm hover:text-[#0B1221] transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        VOLTAR PARA LOJA
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Checkout Seguro</p>
                            <p className="text-sm font-black text-[#0B1221]">CLASSE A PLATINUM</p>
                        </div>
                        <ShieldCheck className="w-8 h-8 text-[#FBC02D]" />
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-6xl mx-auto">

                    {/* Left: Cart & Info */}
                    <div className="lg:col-span-7 space-y-8">
                        {/* Timer Banner */}
                        {timeLeft && (
                            <div className={`p-6 rounded-[2rem] border flex items-center justify-between transition-all ${
                                timeLeft === 'Expirada' 
                                ? 'bg-red-50 border-red-200 text-red-700' 
                                : 'bg-amber-50/50 border-amber-200 text-[#0B1221]'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${timeLeft === 'Expirada' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-[#FBC02D]'}`}>
                                        <Lock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                                            {timeLeft === 'Expirada' ? 'Reserva Expirada' : 'Estoque Reservado'}
                                        </p>
                                        <p className="text-xs font-bold text-slate-500">
                                            {timeLeft === 'Expirada' 
                                                ? 'O estoque foi liberado. Finalize a compra rápido para garantir!'
                                                : 'Garantimos as peças selecionadas em estoque até o tempo expirar.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Tempo Restante</p>
                                    <p className={`text-lg font-black tracking-wider ${timeLeft === 'Expirada' ? 'text-red-600' : 'text-[#0B1221]'}`}>{timeLeft}</p>
                                </div>
                            </div>
                        )}

                        {/* Cart Summary */}
                        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black text-[#0B1221] mb-8 flex items-center gap-3">
                                <ShoppingCart className="w-6 h-6 text-[#FBC02D]" />
                                Seu Carrinho
                            </h3>
                            <div className="space-y-6">
                                {cart.length > 0 ? cart.map((item, idx) => (
                                    <div key={`${item.id}-${JSON.stringify(item.selectedVariations)}`} className="flex justify-between items-center border-b border-slate-50 pb-6 last:border-0 last:pb-0">
                                        <div className="flex gap-4">
                                            <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center text-slate-300 relative group">
                                                {item.variant_id && vtonImages[item.variant_id] ? (
                                                    <>
                                                        <img 
                                                            src={vtonImages[item.variant_id]} 
                                                            alt={`${item.name} provado`} 
                                                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" 
                                                        />
                                                        <span className="absolute bottom-1 right-1 bg-[#FBC02D] text-[#0B1221] text-[7px] font-black uppercase px-1 rounded-sm shadow">
                                                            VTON
                                                        </span>
                                                    </>
                                                ) : (item.image || (item as any).display_image || (item as any).image_url) ? (
                                                    <img 
                                                        src={(item.image || (item as any).display_image || (item as any).image_url).split(',')[0].trim()} 
                                                        alt={item.name} 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                ) : (
                                                    <ShoppingCart className="w-8 h-8" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[#0B1221] leading-tight line-clamp-1">{item.name}</h4>
                                                {item.variant_id && vtonImages[item.variant_id] && (
                                                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mt-0.5 flex items-center gap-1 animate-pulse">
                                                        <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                                        Provado virtualmente
                                                    </p>
                                                )}
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{item.category}</p>
                                                {item.selectedVariations && Object.keys(item.selectedVariations).length > 0 && (
                                                    <p className="text-[10px] font-bold text-[#FBC02D] uppercase tracking-widest mt-1">
                                                        {Object.entries(item.selectedVariations).map(([key, val]) => {
                                                            const labelMap: any = { sizes: 'Tam', colors: 'Cor', numbering: 'Num', soles: 'Solado', tips: 'Bico' };
                                                            return `${labelMap[key] || key}: ${val}`;
                                                        }).join(' • ')}
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-3 mt-3">
                                                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                                                        <button
                                                            onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1), item.selectedVariations)}
                                                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-[#0B1221] transition-colors font-bold"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-8 text-center text-xs font-black text-[#0B1221]">{item.quantity}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.id, item.quantity + 1, item.selectedVariations)}
                                                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-[#0B1221] transition-colors font-bold"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeFromCart(item.id, item.selectedVariations)}
                                                        className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-[#0B1221]">R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-10">
                                        <p className="text-slate-400 font-bold">Seu carrinho está vazio.</p>
                                        <Link to="/shop" className="text-[#FBC02D] font-black text-xs uppercase mt-4 inline-block tracking-widest">Ir para a loja</Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Customer Information */}
                        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-xl font-black text-[#0B1221] flex items-center gap-3">
                                    <Truck className="w-6 h-6 text-[#FBC02D]" />
                                    Dados de Envio
                                </h3>
                                {user && !isEditingProfile && (
                                    <button
                                        onClick={() => setIsEditingProfile(true)}
                                        className="text-[10px] font-black text-[#FBC02D] uppercase tracking-widest bg-amber-50 px-4 py-2 rounded-xl hover:bg-amber-100 transition-all"
                                    >
                                        Alterar Dados
                                    </button>
                                )}
                            </div>

                            {user && !isEditingProfile ? (
                                <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#FBC02D] border border-slate-100 shadow-sm">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Identificamos sua conta</p>
                                            <p className="text-lg font-black text-[#0B1221]">{customerInfo.name}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CPF / CNPJ</p>
                                            <p className="text-sm font-bold text-[#0B1221]">{customerInfo.cpf || 'Não informado'}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100/50">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contato</p>
                                            <p className="text-sm font-bold text-[#0B1221]">{customerInfo.phone || customerInfo.email}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-2xl border border-slate-100/50 md:col-span-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endereço de Entrega</p>
                                                    {customerInfo.street}, {customerInfo.number} {customerInfo.complement && `(${customerInfo.complement})`} <br/>
                                                    {customerInfo.neighborhood} - {customerInfo.city}/{customerInfo.state} <br/>
                                                    CEP: {customerInfo.cep}
                                        </div>
                                    </div>
                                    {!customerInfo.cep && (
                                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest">
                                            <AlertCircle className="w-4 h-4" />
                                            Complete seu CEP para calcular o frete
                                        </div>
                                    )}
                                    {isShippingRequired && customerInfo.cep && !selectedShipping && (
                                        <div className="pt-2">
                                            <button
                                                type="button"
                                                onClick={calculateShipping}
                                                disabled={isCalculatingShipping}
                                                className="w-full py-4 bg-[#0B1221] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1a2436] transition-all flex items-center justify-center gap-2"
                                            >
                                                {isCalculatingShipping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Calcular Frete para este Endereço'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-500">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Nome Completo</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                            placeholder="Seu nome"
                                            value={customerInfo.name}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">E-mail</label>
                                        <input
                                            type="email"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                            placeholder="seu@email.com"
                                            value={customerInfo.email}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Telefone / WhatsApp</label>
                                        <input
                                            type="tel"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                            placeholder="(00) 00000-0000"
                                            value={customerInfo.phone}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">CPF / CNPJ</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                            placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                            value={customerInfo.cpf}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, cpf: e.target.value })}
                                        />
                                    </div>
                                    {/* Sempre mostrar endereço, mas frete só se necessário */}
                                    {true && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">CEP</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                                        placeholder="00000-000"
                                                        value={customerInfo.cep}
                                                        onChange={(e) => setCustomerInfo({ ...customerInfo, cep: e.target.value })}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={calculateShipping}
                                                        disabled={isCalculatingShipping}
                                                        className="px-6 bg-[#0B1221] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1a2436] transition-all disabled:opacity-50"
                                                    >
                                                        {isCalculatingShipping ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CALCULAR'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-2 md:col-span-2 pt-2 border-t border-slate-50 mt-2">
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Endereço de Entrega</p>
                                            </div>
                                            <div className="space-y-2 md:col-span-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Rua / Logradouro</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                                    placeholder="Nome da rua"
                                                    value={customerInfo.street}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, street: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Número</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                                    placeholder="123"
                                                    value={customerInfo.number}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, number: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Complemento</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                                    placeholder="Apto, Bloco, etc."
                                                    value={customerInfo.complement}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, complement: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Bairro</label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                                    placeholder="Seu bairro"
                                                    value={customerInfo.neighborhood}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, neighborhood: e.target.value })}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Cidade</label>
                                                    <input
                                                        type="text"
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D]"
                                                        placeholder="Cidade"
                                                        value={customerInfo.city}
                                                        onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">UF</label>
                                                    <input
                                                        type="text"
                                                        maxLength={2}
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-sm font-bold outline-none focus:border-[#FBC02D] uppercase"
                                                        placeholder="SP"
                                                        value={customerInfo.state}
                                                        onChange={(e) => setCustomerInfo({ ...customerInfo, state: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {shippingOptions.length > 0 && (
                                <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Selecione a Entrega</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {shippingOptions.map((opt, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setSelectedShipping(opt)}
                                                className={`p-4 rounded-2xl border-2 text-left transition-all flex justify-between items-center ${selectedShipping === opt ? 'border-[#FBC02D] bg-amber-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                                            >
                                                <div>
                                                    <p className="text-xs font-black uppercase tracking-widest text-[#0B1221]">{opt.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{opt.company.name} • {opt.delivery_time} dias</p>
                                                </div>
                                                <p className="font-black text-sm text-[#0B1221]">R$ {parseFloat(opt.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Payment Selection */}
                        <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-100">
                            <h3 className="text-xl font-black text-[#0B1221] mb-8 flex items-center gap-3">
                                <CreditCard className="w-6 h-6 text-[#FBC02D]" />
                                Pagamento
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => setPaymentMethod('credit')}
                                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${paymentMethod === 'credit' ? 'border-[#FBC02D] bg-amber-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                                >
                                    <CreditCard className={`w-8 h-8 ${paymentMethod === 'credit' ? 'text-[#FBC02D]' : 'text-slate-300'}`} />
                                    <span className="text-xs font-black uppercase tracking-widest">Cartão de Crédito</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('pix')}
                                    className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${paymentMethod === 'pix' ? 'border-[#FBC02D] bg-amber-50/30' : 'border-slate-100 hover:border-slate-200'}`}
                                >
                                    <div className={`w-8 h-8 flex items-center justify-center font-black rounded-lg ${paymentMethod === 'pix' ? 'bg-[#FBC02D] text-[#0B1221]' : 'bg-slate-100 text-slate-300'}`}>PIX</div>
                                    <span className="text-xs font-black uppercase tracking-widest">Pix</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right: Summary & Rules */}
                    <div className="lg:col-span-5 space-y-8">
                        {/* Totals */}
                        <div className="bg-[#0B1221] rounded-[2.5rem] p-8 md:p-10 text-white shadow-2xl shadow-[#0B1221]/20 relative overflow-hidden">
                            <h3 className="text-xl font-black mb-8">Resumo do Pedido</h3>
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between text-slate-400 text-sm font-medium">
                                    <span>Subtotal</span>
                                    <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between text-slate-400 text-sm font-medium">
                                    <span>Entrega</span>
                                    <span>R$ {shipping.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                                    <span className="font-black">TOTAL</span>
                                    <span className="text-2xl font-black text-[#FBC02D]">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>



                            <button
                                onClick={handleConfirmOrder}
                                disabled={isLoading || (paymentMethod === 'pix' && pixData)}
                                className="w-full mt-10 py-5 bg-[#FBC02D] text-[#0B1221] rounded-2xl font-black text-sm shadow-xl shadow-[#FBC02D]/10 hover:shadow-2xl transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        PROCESSANDO...
                                    </>
                                ) : paymentMethod === 'pix' && pixData ? (
                                    'PAGAMENTO PENDENTE'
                                ) : (
                                    <>
                                        FINALIZAR PAGAMENTO
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Outfit Engine Recommendations */}
                        {checkoutRecommendations.length > 0 && (
                            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                                <h3 className="text-xs font-black text-[#0B1221] uppercase tracking-wider mb-6 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#FBC02D]" />
                                    Complete o Look (Outfit Engine)
                                </h3>
                                <div className="space-y-4">
                                    {checkoutRecommendations.map((rec: any) => (
                                        <div key={rec.variant_id} className="flex gap-4 items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100/50">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-100 shrink-0">
                                                    <img src={rec.image} alt={rec.name} className="w-full h-full object-cover" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-xs font-bold text-[#0B1221] line-clamp-1 leading-snug">{rec.name}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                        Tam: {rec.size} • Cor: {rec.color}
                                                    </p>
                                                    <p className="text-xs font-black text-[#0B1221] mt-1">
                                                        R$ {rec.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const productToCart = {
                                                        id: rec.product_id,
                                                        name: rec.name,
                                                        price: rec.price,
                                                        image: rec.image,
                                                        category: rec.type,
                                                        stock_quantity: 999
                                                    };
                                                    addToCart(productToCart, {
                                                        sizes: rec.size,
                                                        colors: rec.color,
                                                        variant_id: rec.variant_id
                                                    });
                                                }}
                                                className="px-4 py-2 bg-[#0B1221] text-white hover:bg-[#FBC02D] hover:text-[#0B1221] transition-all rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap"
                                            >
                                                + Adicionar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Security Badges */}
                        <div className="flex flex-col gap-4 px-4">
                            <div className="flex items-center gap-3 text-slate-400">
                                <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
                                    <Lock className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Pagamento Criptografado</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400">
                                <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Garantia Classe A</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckoutPage;
