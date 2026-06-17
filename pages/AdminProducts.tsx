import React, { useState, useEffect } from 'react';
import {
    Package,
    Search,
    Filter,
    Plus,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Layers,
    BarChart,
    X,
    Upload,
    Box,
    Loader2,
    Info,
    ChevronDown,
    Sparkles,
    Wand2,
    Coins,
    Download,
    Scissors,
    FileText,
    Image as ImageIcon,
    RefreshCw
} from 'lucide-react';
import { ORGANIZATION_ID } from '../lib/config';
import { useAuth } from '../components/AuthContext';
import AdminLayout from '../components/AdminLayout';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

interface Product {
    id: string;
    name: string;
    description: string;
    category_id: number;
    price: number;
    stock_quantity: number;
    image_url?: string;
    is_active: boolean;
    created_at: string;
    product_categories?: {
        name: string;
        parent_id?: number | null;
    };
    weight?: number;
    length?: number;
    width?: number;
    height?: number;
    origin_zip?: string;
    variations?: any;
    tenant_id?: string;
}

interface Category {
    id: number;
    name: string;
    parent_id?: number | null;
    children?: Category[];
    tenant_id?: string;
}

interface SizeMeasurement {
    size_label: string;
    min_chest_cm: number;
    max_chest_cm: number;
    min_waist_cm: number;
    max_waist_cm: number;
    min_hips_cm: number;
    max_hips_cm: number;
}

interface VariantState {
    size: string;
    color: string;
    sku: string;
    additional_price: number;
    stock_quantity: number;
    variant_image_url?: string;
}

const AdminProducts: React.FC = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    // States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('Todas');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // AI Credits State
    const [creditsBalance, setCreditsBalance] = useState(1000);

    // AI Copywriter Modal States
    const [isAiTextOpen, setIsAiTextOpen] = useState(false);
    const [aiTone, setAiTone] = useState('Moderno e Despojado');
    const [aiKeywords, setAiKeywords] = useState('');
    const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);

    // AI Size Recommendations Grid
    const [sizeChart, setSizeChart] = useState<SizeMeasurement[]>([]);

    // Variant states
    const [variants, setVariants] = useState<VariantState[]>([]);
    const [titleSuggestions, setTitleSuggestions] = useState<{ strategy: string; title: string }[]>([]);

    // AI Studio States
    const [isAiStudioOpen, setIsAiStudioOpen] = useState(false);
    const [selectedStudioProduct, setSelectedStudioProduct] = useState<Product | null>(null);
    const [studioTab, setStudioTab] = useState<'photo' | 'model' | 'banner'>('photo');
    const [isGeneratingStudio, setIsGeneratingStudio] = useState(false);
    const [studioConfig, setStudioConfig] = useState({
        bgStyle: 'Estúdio Minimalista Dourado',
        modelProfile: 'Modelo Feminina - Clara (Jovem/Estilo Clean)',
        bannerTitle: 'Coleção Inverno Urbano',
        bannerSubtitle: '15% OFF com cupom FASHION15',
        bannerTheme: 'Neon Street',
        customPrompt: ''
    });
    const [generatedStudioImage, setGeneratedStudioImage] = useState<string | null>(null);
    const [isImageSavedToGallery, setIsImageSavedToGallery] = useState(false);
    const [isSavingToGallery, setIsSavingToGallery] = useState(false);

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        parent_category_id: '',
        category_id: '',
        price: '',
        stock_quantity: '',
        description: '',
        weight: '0.5',
        length: '16',
        width: '11',
        height: '2',
        origin_zip: '01104-001',
        sizes_raw: '',
        colors_raw: '',
        numbering_raw: '',
        soles_raw: '',
        tips_raw: ''
    });
    const [varErrors, setVarErrors] = useState({
        sizes_raw: '',
        colors_raw: '',
        numbering_raw: '',
        soles_raw: '',
        tips_raw: ''
    });
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<string[]>([]);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const itemsPerPage = 8;

    useEffect(() => {
        fetchInitialData();
        fetchCredits();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([fetchProducts(), fetchCategories()]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCredits = async () => {
        const tenantId = profile?.tenant_id || ORGANIZATION_ID;
        try {
            const { data, error } = await supabase
                .from('organization_ai_credits')
                .select('available_credits')
                .eq('tenant_id', tenantId)
                .single();

            if (error) {
                console.warn('DB credits fetch failed, using localStorage fallback:', error);
                
                // Fallback to localStorage
                const localVal = localStorage.getItem(`ai_credits_${tenantId}`);
                if (localVal !== null) {
                    setCreditsBalance(parseInt(localVal) || 1000);
                } else {
                    localStorage.setItem(`ai_credits_${tenantId}`, '1000');
                    setCreditsBalance(1000);
                }

                if (error.code === 'PGRST116') {
                    // Try to initialize credits if missing and not a permission error
                    try {
                        await supabase
                            .from('organization_ai_credits')
                            .insert({ tenant_id: tenantId, available_credits: 1000 });
                    } catch (e) {
                        console.error('Could not insert initial credits in DB:', e);
                    }
                }
            } else if (data) {
                setCreditsBalance(data.available_credits);
                localStorage.setItem(`ai_credits_${tenantId}`, data.available_credits.toString());
            }
        } catch (err) {
            console.error('Credits error, using localStorage fallback:', err);
            const localVal = localStorage.getItem(`ai_credits_${tenantId}`);
            setCreditsBalance(localVal !== null ? parseInt(localVal) || 1000 : 1000);
        }
    };

    const fetchProducts = async () => {
        const tenantId = profile?.tenant_id || ORGANIZATION_ID;
        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                price:base_price,
                product_categories (name, parent_id)
            `)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (error) {
            toast.error('Erro ao carregar produtos');
            console.error(error);
        } else {
            setProducts(data || []);
        }
    };

    const fetchCategories = async () => {
        const tenantId = profile?.tenant_id || ORGANIZATION_ID;
        const { data, error } = await supabase
            .from('product_categories')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('name');

        if (error) {
            toast.error('Erro ao carregar categorias');
        } else {
            const buildTree = (cats: any[]): Category[] => {
                const map = new Map<number | null, Category[]>();
                cats.forEach(cat => {
                    if (!map.has(cat.parent_id)) map.set(cat.parent_id, []);
                    map.get(cat.parent_id)!.push({ ...cat, children: [] });
                });

                const resolveChildren = (parentId: number | null): Category[] => {
                    const children = map.get(parentId) || [];
                    return children.map(child => ({
                        ...child,
                        children: resolveChildren(child.id)
                    }));
                };

                return resolveChildren(null);
            };
            setCategories(buildTree(data || []));
        }
    };

    const categoriesToSelect = (nodes: Category[], prefix = ''): { id: number, name: string }[] => {
        let list: { id: number, name: string }[] = [];
        nodes.forEach(node => {
            list.push({ id: node.id, name: prefix + node.name });
            if (node.children) {
                list = [...list, ...categoriesToSelect(node.children, prefix + node.name + ' > ')];
            }
        });
        return list;
    };

    const fetchSizeChart = async (productId: string, rawSizes?: string) => {
        try {
            const { data, error } = await supabase
                .from('size_charts')
                .select('*')
                .eq('product_id', productId);
            
            if (!error && data && data.length > 0) {
                setSizeChart(data.map(d => ({
                    size_label: d.size_label,
                    min_chest_cm: Number(d.min_chest_cm) || 0,
                    max_chest_cm: Number(d.max_chest_cm) || 0,
                    min_waist_cm: Number(d.min_waist_cm) || 0,
                    max_waist_cm: Number(d.max_waist_cm) || 0,
                    min_hips_cm: Number(d.min_hips_cm) || 0,
                    max_hips_cm: Number(d.max_hips_cm) || 0
                })));
            } else if (rawSizes) {
                syncSizeChartRows(rawSizes);
            }
        } catch (err) {
            console.error('Error fetching size chart:', err);
        }
    };

    const fetchProductVariants = async (productId: string) => {
        try {
            const { data, error } = await supabase
                .from('product_variants')
                .select('*')
                .eq('product_id', productId)
                .eq('is_active', true);
            if (!error && data) {
                setVariants(data.map(v => ({
                    id: v.id,
                    size: v.size,
                    color: v.color,
                    sku: v.sku || '',
                    additional_price: Number(v.additional_price) || 0,
                    stock_quantity: Number(v.stock_quantity) || 0,
                    variant_image_url: v.variant_image_url || ''
                })));
            } else {
                setVariants([]);
            }
        } catch (err) {
            console.error('Error fetching product variants:', err);
            setVariants([]);
        }
    };

    const handleGenerateTitleSuggestions = () => {
        const currentName = formData.name.trim();
        if (!currentName) {
            toast.error('Escreva um rascunho de nome para que a IA possa sugerir melhorias!');
            return;
        }

        const catId = formData.category_id || formData.parent_category_id;
        const catName = categoriesToSelect(categories).find(c => c.id.toString() === catId)?.name || 'Produto';
        const cleanCat = catName.split(' > ').pop() || 'Moda';

        toast.promise(
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    const baseWord = currentName.split('|')[0].split('-')[0].trim();
                    const cleanBase = baseWord.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

                    const suggestions = [
                        {
                            strategy: 'Otimizado para SEO (Buscas)',
                            title: `${cleanBase} ${cleanCat} Classe A`
                        },
                        {
                            strategy: 'Comercial & Conversão',
                            title: `${cleanBase} Premium | Urbano Fashion`
                        },
                        {
                            strategy: 'Luxo & Sofisticado',
                            title: `${cleanBase} Casual Chic`
                        }
                    ];

                    setTitleSuggestions(suggestions);
                    resolve();
                }, 1000);
            }),
            {
                loading: 'IA analisando e gerando sugestões de títulos...',
                success: 'Sugestões geradas com sucesso!',
                error: 'Erro ao gerar sugestões.'
            }
        );
    };

    const syncVariantsFromForm = (sizesVal: string, colorsVal: string, numberingVal: string) => {
        const sizes = sizesVal.split(',').map(s => s.trim()).filter(Boolean);
        const numbering = numberingVal.split(',').map(s => s.trim()).filter(Boolean);
        const activeSizes = sizes.length > 0 ? sizes : (numbering.length > 0 ? numbering : ['Único']);

        const colors = colorsVal.split(',').map(s => s.trim()).filter(Boolean);
        const activeColors = colors.length > 0 ? colors : ['Única'];

        setVariants(prev => {
            const newVariants: VariantState[] = [];
            activeSizes.forEach(size => {
                activeColors.forEach(color => {
                    const existing = prev.find(
                        v => v.size.toLowerCase() === size.toLowerCase() && 
                             v.color.toLowerCase() === color.toLowerCase()
                    );
                    newVariants.push(existing || {
                        size,
                        color,
                        sku: '',
                        additional_price: 0,
                        stock_quantity: 0
                    });
                });
            });
            return newVariants;
        });
    };

    const handleVariantChange = (index: number, field: string, value: any) => {
        setVariants(prev => {
            const updated = prev.map((v, idx) => idx === index ? { ...v, [field]: value } : v);
            if (field === 'stock_quantity') {
                const total = updated.reduce((acc, v) => acc + (v.stock_quantity || 0), 0);
                setFormData(prevForm => ({ ...prevForm, stock_quantity: total.toString() }));
            }
            return updated;
        });
    };

    const handleOpenEdit = (prod: Product) => {
        setEditingProduct(prod);
        setFormData({
            name: prod.name,
            parent_category_id: prod.product_categories?.parent_id?.toString() || prod.category_id?.toString() || '',
            category_id: prod.product_categories?.parent_id ? prod.category_id.toString() : '',
            price: prod.price.toString(),
            stock_quantity: prod.stock_quantity.toString(),
            description: prod.description || '',
            weight: (prod.weight || 0.5).toString(),
            length: (prod.length || 16).toString(),
            width: (prod.width || 11).toString(),
            height: (prod.height || 2).toString(),
            origin_zip: prod.origin_zip || '01104-001',
            sizes_raw: prod.variations?.sizes?.join(', ') || '',
            colors_raw: prod.variations?.colors?.join(', ') || '',
            numbering_raw: prod.variations?.numbering?.join(', ') || '',
            soles_raw: prod.variations?.soles?.join(', ') || '',
            tips_raw: prod.variations?.tips?.join(', ') || ''
        });
        const imgs = (prod.image_url || '').split(',').map(s => s.trim()).filter(Boolean);
        setExistingImages(imgs);
        setImagePreviews([]);
        setSelectedImages([]);
        setVarErrors({
            sizes_raw: '',
            colors_raw: '',
            numbering_raw: '',
            soles_raw: '',
            tips_raw: ''
        });
        fetchSizeChart(prod.id, prod.variations?.sizes?.join(', ') || '');
        fetchProductVariants(prod.id);
        setIsNewModalOpen(true);
    };

    const validateVariations = (field: string, value: string) => {
        if (!value) {
            setVarErrors(prev => ({ ...prev, [field]: '' }));
            return;
        }

        const invalidChars = /[;.:|\\]/;
        let error = '';
        
        if (invalidChars.test(value)) {
            error = 'Use apenas vírgulas para separar as variações';
        } else if (value.includes(' ') && !value.includes(',')) {
            const words = value.trim().split(/\s+/);
            if (words.length > 2) {
                error = 'Use vírgulas para separar (ex: P, M, G)';
            }
        }

        setVarErrors(prev => ({ ...prev, [field]: error }));

        // Sync sizes grid if size field is updated
        if (field === 'sizes_raw' && !error) {
            syncSizeChartRows(value);
        }

        if ((field === 'sizes_raw' || field === 'colors_raw' || field === 'numbering_raw') && !error) {
            syncVariantsFromForm(
                field === 'sizes_raw' ? value : formData.sizes_raw,
                field === 'colors_raw' ? value : formData.colors_raw,
                field === 'numbering_raw' ? value : formData.numbering_raw
            );
        }
    };

    function syncSizeChartRows(rawSizes: string) {
        const sizes = rawSizes.split(',').map(s => s.trim()).filter(Boolean);
        setSizeChart(prev => {
            const newChart = sizes.map(size => {
                const existing = prev.find(item => item.size_label.toLowerCase() === size.toLowerCase());
                return existing || {
                    size_label: size,
                    min_chest_cm: 0,
                    max_chest_cm: 0,
                    min_waist_cm: 0,
                    max_waist_cm: 0,
                    min_hips_cm: 0,
                    max_hips_cm: 0
                };
            });
            return newChart;
        });
    };

    // AI Autocomplete Size Recommendation Table
    const handleAutoPopulateSizeChart = () => {
        if (sizeChart.length === 0) {
            toast.error('Adicione tamanhos nas variações antes de gerar as medidas!');
            return;
        }

        const catId = formData.category_id || formData.parent_category_id;
        const catName = categoriesToSelect(categories).find(c => c.id.toString() === catId)?.name || 'Vestuário';
        const isFootwear = catName.toLowerCase().includes('calçado') || catName.toLowerCase().includes('sapato');

        if (isFootwear) {
            toast.error('O provador virtual e medidas corporais não são necessários para calçados.');
            return;
        }

        const isMasculino = catName.toLowerCase().includes('masculin') || formData.name.toLowerCase().includes('masculin');

        toast.promise(
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    const populated = sizeChart.map(item => {
                        const label = item.size_label.toUpperCase();
                        let minChest = 0;
                        let maxChest = 0;
                        let minWaist = 0;
                        let maxWaist = 0;
                        let minHips = 0;
                        let maxHips = 0;

                        if (isMasculino) {
                            if (label === 'PP' || label === '34') {
                                minChest = 84; maxChest = 88;
                                minWaist = 36; maxWaist = 37.5;
                            } else if (label === 'P' || label === '36' || label === '38') {
                                minChest = 88; maxChest = 92;
                                minWaist = 38; maxWaist = 39.5;
                            } else if (label === 'M' || label === '40' || label === '42') {
                                minChest = 92; maxChest = 96;
                                minWaist = 40; maxWaist = 41.5;
                            } else if (label === 'G' || label === '44' || label === '46') {
                                minChest = 96; maxChest = 102;
                                minWaist = 42; maxWaist = 44;
                            } else if (label === 'GG' || label === '48' || label === '50') {
                                minChest = 102; maxChest = 108;
                                minWaist = 45; maxWaist = 47;
                            } else if (label === 'XG' || label === '52') {
                                minChest = 108; maxChest = 114;
                                minWaist = 48; maxWaist = 50;
                            } else if (label === 'XXG' || label === '54') {
                                minChest = 114; maxChest = 120;
                                minWaist = 50; maxWaist = 52;
                            } else {
                                minChest = 92; maxChest = 96;
                                minWaist = 40; maxWaist = 41.5;
                            }
                        } else {
                            // Feminino
                            if (label === 'PP' || label === '34' || label === '36') {
                                minChest = 80; maxChest = 85;
                                minWaist = 70; maxWaist = 74;
                                minHips = 84; maxHips = 87;
                            } else if (label === 'P' || label === '38' || label === '40') {
                                minChest = 86; maxChest = 93;
                                minWaist = 75; maxWaist = 77;
                                minHips = 88; maxHips = 90;
                            } else if (label === 'M' || label === '42' || label === '44') {
                                minChest = 94; maxChest = 97;
                                minWaist = 78; maxWaist = 80;
                                minHips = 91; maxHips = 93;
                            } else if (label === 'G' || label === '46' || label === '48') {
                                minChest = 98; maxChest = 102;
                                minWaist = 81; maxWaist = 83;
                                minHips = 94; maxHips = 96;
                            } else if (label === 'GG' || label === '50') {
                                minChest = 103; maxChest = 107;
                                minWaist = 84; maxWaist = 86;
                                minHips = 97; maxHips = 100;
                            } else if (label === 'XG' || label === '52') {
                                minChest = 108; maxChest = 112;
                                minWaist = 87; maxWaist = 89;
                                minHips = 101; maxHips = 104;
                            } else if (label === 'XXG' || label === '54') {
                                minChest = 113; maxChest = 117;
                                minWaist = 90; maxWaist = 92;
                                minHips = 105; maxHips = 108;
                            } else {
                                minChest = 94; maxChest = 97;
                                minWaist = 78; maxWaist = 80;
                                minHips = 91; maxHips = 93;
                            }
                        }

                        return {
                            size_label: item.size_label,
                            min_chest_cm: minChest,
                            max_chest_cm: maxChest,
                            min_waist_cm: minWaist,
                            max_waist_cm: maxWaist,
                            min_hips_cm: minHips,
                            max_hips_cm: maxHips
                        };
                    });
                    setSizeChart(populated);
                    resolve();
                }, 1000);
            }),
            {
                loading: 'IA analisando categoria de moda e calculando medidas padrão de corpo...',
                success: 'Tabela de medidas corporais gerada com sucesso!',
                error: 'Erro ao estimar medidas.'
            }
        );
    };

    // AI Copywriting Text Assistant
    const handleGenerateCopyText = () => {
        if (!formData.name) {
            toast.error('Insira o nome do produto para orientar a IA.');
            return;
        }
        setIsGeneratingCopy(true);
        toast.promise(
            new Promise<void>((resolve) => {
                setTimeout(() => {
                    const cleanName = formData.name.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    const optimizedTitle = `${cleanName} Premium | Urbano Fashion`;
                    
                    const copywriting = `Desenvolvido com o estilo exclusivo e refinado da nossa marca, o item "${cleanName}" reúne o melhor do caimento moderno e conforto no dia a dia. Confeccionada com tecidos premium de alta maciez e costura reforçada para extrema durabilidade. O visual ${aiTone.toLowerCase()} traz o toque perfeito para compor visuais marcantes, seja no streetwear ou em ocasiões casuais.\n\nPrincipais Atributos:\n- Material: Algodão nobre com toque aveludado e flexibilidade natural\n- Tecnologia de Modelagem: Caimento anatômico inteligente\n- Destaque: ${aiKeywords || 'Estilo versátil'}\n- Durabilidade extrema, não desbota no ciclo de lavagens`;
                    
                    setFormData(prev => ({
                        ...prev,
                        name: optimizedTitle,
                        description: copywriting
                    }));
                    setIsGeneratingCopy(false);
                    setIsAiTextOpen(false);
                    resolve();
                }, 1200);
            }),
            {
                loading: 'IA gerando descrição e otimizações de SEO comercial...',
                success: 'Título e descrição comercial gerados com sucesso!',
                error: 'Erro ao gerar cópia.'
            }
        );
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            let finalImageUrls = [...existingImages];

            if (selectedImages.length > 0) {
                for (const file of selectedImages) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Math.random()}.${fileExt}`;
                    try {
                        const { error: uploadError, data } = await supabase.storage
                            .from('product-images')
                            .upload(`profiles/${fileName}`, file);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(data.path);

                        finalImageUrls.push(publicUrl);
                    } catch (uploadError: any) {
                        console.error('Storage Upload Error:', uploadError);
                        toast.error(`Falha no upload para o bucket 'product-images'. Usando imagem temporária para: ${file.name}`);
                        
                        // Fallback fashion image URL
                        const fallbackUrl = `https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=60`;
                        finalImageUrls.push(fallbackUrl);
                    }
                }
            }

            const imageUrl = finalImageUrls.join(',');

            const rawPrice = formData.price.toString().replace(/[R$\s.]/g, '').replace(',', '.');
            const parsedPrice = parseFloat(rawPrice);

            if (isNaN(parsedPrice)) {
                toast.error('Preço inválido');
                setIsSaving(false);
                return;
            }

            const tenantId = profile?.tenant_id || ORGANIZATION_ID;

            const productData = {
                name: formData.name,
                category_id: parseInt(formData.category_id || formData.parent_category_id) || null,
                base_price: parsedPrice,
                stock_quantity: parseInt(formData.stock_quantity) || 0,
                description: formData.description,
                image_url: imageUrl,
                is_active: true,
                weight: parseFloat(formData.weight) || 0.5,
                length: parseFloat(formData.length) || 16,
                width: parseFloat(formData.width) || 11,
                height: parseFloat(formData.height) || 2,
                origin_zip: formData.origin_zip || '01104-001',
                variations: {
                    sizes: formData.sizes_raw.split(',').map(s => s.trim()).filter(s => s),
                    colors: formData.colors_raw.split(',').map(s => s.trim()).filter(s => s),
                    numbering: formData.numbering_raw.split(',').map(s => s.trim()).filter(s => s),
                    soles: formData.soles_raw.split(',').map(s => s.trim()).filter(s => s),
                    tips: formData.tips_raw.split(',').map(s => s.trim()).filter(s => s)
                },
                tenant_id: tenantId
            };

            let savedProductId = '';

            if (editingProduct) {
                const { error } = await supabase
                    .from('products')
                    .update(productData)
                    .eq('id', editingProduct.id)
                    .eq('tenant_id', tenantId);
                if (error) throw error;
                savedProductId = editingProduct.id;
                toast.success('Produto atualizado com sucesso!');
            } else {
                const { data: newProd, error } = await supabase
                    .from('products')
                    .insert([productData])
                    .select()
                    .single();
                if (error) throw error;
                savedProductId = newProd.id;
                toast.success('Produto cadastrado com sucesso!');
            }

            // Save product variants
            try {
                // Get all existing variants in DB for this product (including inactive ones)
                const { data: dbVariants, error: fetchErr } = await supabase
                    .from('product_variants')
                    .select('id, size, color')
                    .eq('product_id', savedProductId);
                
                if (fetchErr) throw fetchErr;

                // Deactivate all variants first
                if (dbVariants && dbVariants.length > 0) {
                    await supabase
                        .from('product_variants')
                        .update({ is_active: false })
                        .eq('product_id', savedProductId);
                }

                // Upsert active variants
                for (const variant of variants) {
                    const existingInDb = dbVariants?.find(
                        dbV => dbV.size.toLowerCase() === variant.size.toLowerCase() &&
                               dbV.color.toLowerCase() === variant.color.toLowerCase()
                    );

                    const variantData = {
                        product_id: savedProductId,
                        size: variant.size,
                        color: variant.color,
                        sku: variant.sku || null,
                        additional_price: variant.additional_price || 0,
                        stock_quantity: variant.stock_quantity || 0,
                        is_active: true
                    };

                    if (existingInDb) {
                        await supabase
                            .from('product_variants')
                            .update(variantData)
                            .eq('id', existingInDb.id);
                    } else {
                        await supabase
                            .from('product_variants')
                            .insert([variantData]);
                    }
                }
            } catch (varErr) {
                console.error('Error saving product variants:', varErr);
            }

            // Save size charts
            try {
                const { error: deleteError } = await supabase.from('size_charts').delete().eq('product_id', savedProductId);
                if (deleteError) throw deleteError;

                if (sizeChart.length > 0) {
                    const chartsData = sizeChart.map(item => ({
                        product_id: savedProductId,
                        size_label: item.size_label,
                        min_chest_cm: item.min_chest_cm,
                        max_chest_cm: item.max_chest_cm,
                        min_waist_cm: item.min_waist_cm,
                        max_waist_cm: item.max_waist_cm,
                        min_hips_cm: item.min_hips_cm,
                        max_hips_cm: item.max_hips_cm,
                        category_id: parseInt(formData.category_id || formData.parent_category_id) || null
                    }));
                    const { error: chartError } = await supabase.from('size_charts').insert(chartsData);
                    if (chartError) throw chartError;
                }
            } catch (chartErr: any) {
                console.error('Error managing size charts:', chartErr);
                throw new Error(`Erro ao salvar tabela de medidas: ${chartErr.message || 'Acesso negado (RLS)'}`);
            }

            setIsNewModalOpen(false);
            resetForm();
            fetchProducts();
            fetchCategories();
        } catch (error: any) {
            toast.error(editingProduct ? `Erro ao atualizar produto: ${error.message}` : `Erro ao cadastrar produto: ${error.message}`);
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;

        const tenantId = profile?.tenant_id || ORGANIZATION_ID;
        try {
            const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            toast.success('Produto removido');
            fetchProducts();
            fetchCategories();
        } catch (error) {
            toast.error('Erro ao excluir produto');
        }
    };

    const toggleProductStatus = async (id: string, currentStatus: boolean) => {
        const tenantId = profile?.tenant_id || ORGANIZATION_ID;
        try {
            const { error } = await supabase
                .from('products')
                .update({ is_active: !currentStatus })
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            toast.success(`Produto ${!currentStatus ? 'ativado' : 'desativado'}`);
            fetchProducts();
        } catch (error) {
            toast.error('Erro ao atualizar status');
        }
    };

    // Open AI Studio Modal
    const handleOpenAiStudio = (prod: Product) => {
        setSelectedStudioProduct(prod);
        setGeneratedStudioImage(null);
        setIsImageSavedToGallery(false);
        setIsSavingToGallery(false);
        setStudioConfig({
            bgStyle: 'Estúdio Minimalista Dourado',
            modelProfile: 'Modelo Feminina - Clara (Jovem/Estilo Clean)',
            bannerTitle: 'Coleção Inverno Urbano',
            bannerSubtitle: '15% OFF com cupom FASHION15',
            bannerTheme: 'Neon Street',
            customPrompt: ''
        });
        setIsAiStudioOpen(true);
    };

    const fetchImageAsBase64 = async (url: string): Promise<{ mimeType: string, data: string }> => {
        const absoluteUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
        const response = await fetch(absoluteUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                const commaIndex = result.indexOf(',');
                const mimeType = result.substring(5, result.indexOf(';'));
                const data = result.substring(commaIndex + 1);
                resolve({ mimeType, data });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const base64ToBlob = (base64: string, mimeType = 'image/jpeg') => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    };

    const compositeTextOnImage = (
        base64Data: string,
        title: string,
        subtitle: string,
        theme: string
    ): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = `data:image/jpeg;base64,${base64Data}`;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Não foi possível inicializar o canvas de renderização.'));
                    return;
                }

                const w = img.naturalWidth || 768;
                const h = img.naturalHeight || 1024;
                canvas.width = w;
                canvas.height = h;

                // Draw main image
                ctx.drawImage(img, 0, 0, w, h);

                // Apply styling based on theme
                if (theme === 'Neon Street') {
                    // Gradiente escuro no rodapé
                    const grad = ctx.createLinearGradient(0, h * 0.7, 0, h);
                    grad.addColorStop(0, 'rgba(5, 8, 15, 0)');
                    grad.addColorStop(0.3, 'rgba(5, 8, 15, 0.75)');
                    grad.addColorStop(1, 'rgba(5, 8, 15, 0.95)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, h * 0.7, w, h * 0.3);

                    // Linha neon brilhante
                    ctx.strokeStyle = '#FF007F';
                    ctx.lineWidth = Math.max(3, w * 0.006);
                    ctx.shadowColor = '#FF007F';
                    ctx.shadowBlur = Math.max(8, w * 0.012);
                    ctx.beginPath();
                    ctx.moveTo(w * 0.08, h * 0.8);
                    ctx.lineTo(w * 0.92, h * 0.8);
                    ctx.stroke();
                    ctx.shadowBlur = 0; // reset

                    // Título (Caixa alta)
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = `900 ${Math.round(w * 0.042)}px 'Inter', sans-serif`;
                    ctx.textBaseline = 'top';
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                    ctx.shadowBlur = Math.max(2, w * 0.004);
                    ctx.fillText(title.toUpperCase(), w * 0.08, h * 0.825);

                    // Subtítulo / Cupom
                    ctx.fillStyle = '#00FFFF'; // Neon Cyan
                    ctx.font = `bold ${Math.round(w * 0.026)}px 'Inter', sans-serif`;
                    ctx.fillText(subtitle, w * 0.08, h * 0.895);
                    ctx.shadowBlur = 0;
                } else if (theme === 'Luxury Golden') {
                    // Gradiente clássico
                    const grad = ctx.createLinearGradient(0, h * 0.7, 0, h);
                    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
                    grad.addColorStop(1, 'rgba(15, 12, 5, 0.95)');
                    ctx.fillStyle = grad;
                    ctx.fillRect(0, h * 0.7, w, h * 0.3);

                    // Moldura dourada
                    ctx.strokeStyle = '#D4AF37';
                    ctx.lineWidth = Math.max(2, w * 0.004);
                    ctx.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);

                    // Título dourado centralizado
                    ctx.fillStyle = '#D4AF37';
                    ctx.font = `italic bold ${Math.round(w * 0.04)}px Georgia, Garamond, serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(title, w * 0.5, h * 0.825);

                    // Subtítulo em branco
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = `bold ${Math.round(w * 0.024)}px Georgia, Garamond, serif`;
                    ctx.fillText(subtitle, w * 0.5, h * 0.895);
                    ctx.textAlign = 'left'; // reset
                } else if (theme === 'Minimalist Clean Studio') {
                    // Box branco flutuante no rodapé
                    const boxW = w * 0.84;
                    const boxH = h * 0.15;
                    const boxX = w * 0.08;
                    const boxY = h * 0.8;

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
                    ctx.fillRect(boxX, boxY, boxW, boxH);
                    ctx.strokeStyle = '#05080F';
                    ctx.lineWidth = Math.max(2, w * 0.003);
                    ctx.strokeRect(boxX, boxY, boxW, boxH);

                    // Título preto
                    ctx.fillStyle = '#05080F';
                    ctx.font = `900 ${Math.round(w * 0.033)}px 'Inter', sans-serif`;
                    ctx.textBaseline = 'top';
                    ctx.fillText(title.toUpperCase(), boxX + w * 0.03, boxY + h * 0.025);

                    // Subtítulo cinza
                    ctx.fillStyle = '#64748B';
                    ctx.font = `bold ${Math.round(w * 0.022)}px 'Inter', sans-serif`;
                    ctx.fillText(subtitle, boxX + w * 0.03, boxY + h * 0.085);
                } else { // Outono Cores Quentes
                    // Badge terracota no rodapé direito
                    const badgeW = w * 0.58;
                    const badgeH = h * 0.16;
                    const badgeX = w * 0.36;
                    const badgeY = h * 0.78;

                    ctx.fillStyle = '#C2410C'; // orange-700
                    ctx.fillRect(badgeX, badgeY, badgeW, badgeH);

                    // Borda interna branca recuada
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = Math.max(1, w * 0.002);
                    ctx.strokeRect(badgeX + w * 0.015, badgeY + h * 0.012, badgeW - w * 0.03, badgeH - h * 0.024);

                    // Título
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = `bold ${Math.round(w * 0.032)}px Georgia, serif`;
                    ctx.textBaseline = 'top';
                    ctx.fillText(title, badgeX + w * 0.035, badgeY + h * 0.035);

                    // Subtítulo
                    ctx.fillStyle = '#FDBA74'; // orange-300
                    ctx.font = `italic ${Math.round(w * 0.02)}px Georgia, serif`;
                    ctx.fillText(subtitle, badgeX + w * 0.035, badgeY + h * 0.095);
                }

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Falha ao exportar imagem final.'));
                    },
                    'image/jpeg',
                    0.95
                );
            };
            img.onerror = () => {
                reject(new Error('Erro ao carregar imagem gerada no composite.'));
            };
        });
    };

    const handleGenerateStudioAsset = async () => {
        if (!selectedStudioProduct) return;
        
        const productImages = selectedStudioProduct.image_url ? selectedStudioProduct.image_url.split(',') : [];
        const productMainImage = productImages[0]?.trim();
        
        if (!productMainImage) {
            toast.error('O produto precisa ter pelo menos uma imagem cadastrada para servir de referência.');
            return;
        }

        if (creditsBalance < 5) {
            toast.error('Saldo de créditos IA insuficiente. Recarregue no painel.');
            return;
        }

        setIsGeneratingStudio(true);
        toast.loading('Mecanismo de IA processando imagens na nuvem...', { id: 'studio-gen' });

        try {
            const apiKey = (process.env as any).GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('Chave de API do Gemini não configurada no ambiente.');
            }

            // Convert product main image to Base64
            const productImgData = await fetchImageAsBase64(productMainImage);
            
            let promptText = '';
            const parts: any[] = [];

            if (studioTab === 'photo') {
                promptText = `Create a high-end, professional commercial studio product catalog photograph. The fashion item in the input image should be seamlessly blended and placed naturally on a background with the style: "${studioConfig.bgStyle}". ${studioConfig.customPrompt ? `Additional scene style details requested: "${studioConfig.customPrompt}".` : ''} Preserve the product itself (including colors, details, text/labels, shape) exactly as shown in the input image. Ensure high-quality studio lighting, realistic shadows, sharp focus, 8k resolution, suitable for a premium fashion catalog. Aspect ratio 3:4.`;
                parts.push({ text: promptText });
                parts.push({
                    inlineData: {
                        mimeType: productImgData.mimeType,
                        data: productImgData.data
                    }
                });
            } else if (studioTab === 'model') {
                // Map the model profiles to their asset paths
                let modelPath = '/assets/vton_model_female_slim.png';
                if (studioConfig.modelProfile.includes('Julia')) {
                    modelPath = '/assets/vton_model_female_curvy.png';
                } else if (studioConfig.modelProfile.includes('Pedro')) {
                    modelPath = '/assets/vton_model_male_slim.png';
                } else if (studioConfig.modelProfile.includes('Carlos')) {
                    modelPath = '/assets/vton_model_male_athletic.png';
                }

                // Fetch and convert model image to base64
                const modelImgData = await fetchImageAsBase64(modelPath);

                promptText = `A virtual try-on of the garment on the model. Please combine the two images: fit the garment from the second image (the product) onto the person in the first image (the model). Maintain the person's pose, facial features, body shape, and hair. The output must show the person wearing the garment naturally, photorealistic, high-end fashion catalog style, 8k. Aspect ratio 3:4.`;
                parts.push({ text: promptText });
                parts.push({
                    inlineData: {
                        mimeType: modelImgData.mimeType,
                        data: modelImgData.data
                    }
                });
                parts.push({
                    inlineData: {
                        mimeType: productImgData.mimeType,
                        data: productImgData.data
                    }
                });
            } else { // banner
                promptText = `Create a professional, eye-catching background scene for a promotional fashion banner featuring the product in the input image. The banner background style/theme must be: "${studioConfig.bannerTheme}". ${studioConfig.customPrompt ? `Additional background design details requested: "${studioConfig.customPrompt}".` : ''} The product must remain clean, recognizable, and central to the composition. Do not generate any text, logos, letters, or numbers on the image. 8k resolution, commercial design quality. Aspect ratio 3:4.`;
                parts.push({ text: promptText });
                parts.push({
                    inlineData: {
                        mimeType: productImgData.mimeType,
                        data: productImgData.data
                    }
                });
            }

            // Determine image config aspect ratio (Banners: 1:1, others 3:4)
            const configAspectRatio = studioTab === 'banner' ? '1:1' : '3:4';

            // Call the Gemini 3.1 Flash Image generation API
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{ parts }],
                    generationConfig: {
                        imageConfig: {
                            imageSize: "1k",
                            aspectRatio: configAspectRatio
                        }
                    }
                })
            });

            if (!response.ok) {
                const errTxt = await response.text();
                throw new Error(`Erro na API do Gemini: ${errTxt}`);
            }

            const resJson = await response.json();
            const base64Bytes = resJson.candidates?.[0]?.content?.parts?.find(
                (p: any) => p.inlineData
            )?.inlineData?.data;

            if (!base64Bytes) {
                throw new Error('Nenhum dado de imagem retornado pela API do Gemini.');
            }

            // Convert generated image base64 to Blob, applying Canvas compositor if it is a banner
            let fileBlob: Blob;
            if (studioTab === 'banner') {
                fileBlob = await compositeTextOnImage(
                    base64Bytes,
                    studioConfig.bannerTitle,
                    studioConfig.bannerSubtitle,
                    studioConfig.bannerTheme
                );
            } else {
                fileBlob = base64ToBlob(base64Bytes, 'image/jpeg');
            }

            // Upload the Blob to Supabase Storage
            const fileName = `studio-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(`profiles/${fileName}`, fileBlob, {
                    contentType: 'image/jpeg'
                });

            if (uploadError) throw uploadError;

            // Get Public URL of the uploaded image
            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(uploadData.path);

            const tenantId = profile?.tenant_id || ORGANIZATION_ID;

            // Deduct credits from Database (AFTER successful image creation)
            const newBalance = creditsBalance - 5;
            try {
                const { error: balanceError } = await supabase
                    .from('organization_ai_credits')
                    .update({ available_credits: newBalance })
                    .eq('tenant_id', tenantId);

                if (balanceError) throw balanceError;

                // Log Credit Transaction
                const { data: userData } = await supabase.auth.getUser();
                await supabase.from('ai_credit_transactions').insert({
                    tenant_id: tenantId,
                    user_id: userData.user?.id,
                    amount: -5,
                    transaction_type: 'usage_tryon',
                    description: `Estúdio IA: ${studioTab === 'photo' ? 'Foto Profissional' : studioTab === 'model' ? 'Modelo Virtual' : 'Banner Promocional'} - ${selectedStudioProduct.name}`
                });
            } catch (creditErr) {
                console.warn('DB credit deduction failed, falling back to localStorage:', creditErr);
            }

            // Always update local storage
            localStorage.setItem(`ai_credits_${tenantId}`, newBalance.toString());
            setCreditsBalance(newBalance);

            setGeneratedStudioImage(publicUrl);
            setIsImageSavedToGallery(false);
            toast.success('Imagem criada com sucesso no Estúdio IA!', { id: 'studio-gen' });
        } catch (err: any) {
            console.error('Error generating AI asset:', err);
            toast.error(err.message || 'Erro na geração inteligente ou saldo esgotado.', { id: 'studio-gen' });
        } finally {
            setIsGeneratingStudio(false);
        }
    };

    const handleSaveToGallery = async () => {
        if (!selectedStudioProduct || !generatedStudioImage) return;
        
        setIsSavingToGallery(true);
        const toastId = toast.loading('Salvando imagem na galeria do produto...');

        try {
            const tenantId = profile?.tenant_id || ORGANIZATION_ID;
            const productImages = selectedStudioProduct.image_url ? selectedStudioProduct.image_url.split(',') : [];
            
            // Add generated image to the front of the list
            const updatedImages = [generatedStudioImage, ...productImages].join(',');

            const { error } = await supabase
                .from('products')
                .update({ image_url: updatedImages })
                .eq('id', selectedStudioProduct.id)
                .eq('tenant_id', tenantId);

            if (error) throw error;

            setIsImageSavedToGallery(true);
            
            // Update selectedStudioProduct so the local UI reflects the changes
            setSelectedStudioProduct({
                ...selectedStudioProduct,
                image_url: updatedImages
            });
            
            fetchProducts(); // Refresh lists
            toast.success('Imagem adicionada à galeria com sucesso!', { id: toastId });
        } catch (err: any) {
            console.error('Error saving image to gallery:', err);
            toast.error('Erro ao salvar na galeria: ' + err.message, { id: toastId });
        } finally {
            setIsSavingToGallery(false);
        }
    };

    const handleDownloadImage = async () => {
        if (!generatedStudioImage) return;
        try {
            const response = await fetch(generatedStudioImage);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `estudio-ia-${selectedStudioProduct?.name.toLowerCase().replace(/\s+/g, '-') || 'imagem'}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            toast.success('Download iniciado!');
        } catch (err) {
            console.error('Error downloading image:', err);
            // Fallback: open in new tab
            window.open(generatedStudioImage, '_blank');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            parent_category_id: '',
            category_id: '',
            price: '',
            stock_quantity: '',
            description: '',
            weight: '0.5',
            length: '16',
            width: '11',
            height: '2',
            origin_zip: '01104-001',
            sizes_raw: '',
            colors_raw: '',
            numbering_raw: '',
            soles_raw: '',
            tips_raw: ''
        });
        setVarErrors({
            sizes_raw: '',
            colors_raw: '',
            numbering_raw: '',
            soles_raw: '',
            tips_raw: ''
        });
        setEditingProduct(null);
        setVariants([]);
        setSelectedImages([]);
        setImagePreviews([]);
        setExistingImages([]);
        setSizeChart([]);
        setIsImageSavedToGallery(false);
        setIsSavingToGallery(false);
        setStudioConfig(prev => ({
            ...prev,
            customPrompt: ''
        }));
    };

    const filteredProducts = products.filter(prod => {
        const matchesSearch = prod.name.toLowerCase().includes(searchTerm.toLowerCase());
        const categoryName = prod.product_categories?.name || 'Sem Categoria';
        const matchesCategory = filterCategory === 'Todas' || categoryName === filterCategory;

        let statusText = 'Ativo';
        if (!prod.is_active) statusText = 'Inativo';
        else if (prod.stock_quantity === 0) statusText = 'Sem Estoque';
        else if (prod.stock_quantity <= 10) statusText = 'Estoque Baixo';

        const matchesStatus = filterStatus === 'Todos' || statusText === filterStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const currentData = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusInfo = (prod: Product) => {
        if (!prod.is_active) return { text: 'Inativo', color: 'bg-slate-50 text-slate-600' };
        if (prod.stock_quantity === 0) return { text: 'Sem Estoque', color: 'bg-red-50 text-red-600' };
        if (prod.stock_quantity <= 10) return { text: 'Estoque Baixo', color: 'bg-amber-50 text-amber-600' };
        return { text: 'Ativo', color: 'bg-emerald-50 text-emerald-600' };
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length === 0) return;

        const totalCount = existingImages.length + selectedImages.length + files.length;
        if (totalCount > 10) {
            toast.error('Você pode cadastrar no máximo 10 imagens por produto');
            return;
        }

        const validFiles: File[] = [];
        const newPreviews: string[] = [];

        for (const file of files) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error(`A imagem ${file.name} excede o limite de 2MB`);
                continue;
            }
            validFiles.push(file);
            newPreviews.push(URL.createObjectURL(file));
        }

        setSelectedImages(prev => [...prev, ...validFiles]);
        setImagePreviews(prev => [...prev, ...newPreviews]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeExistingImage = (index: number) => {
        setExistingImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeNewImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => {
            const previewToRemove = prev[index];
            if (previewToRemove) URL.revokeObjectURL(previewToRemove);
            return prev.filter((_, i) => i !== index);
        });
    };

    const catId = formData.category_id || formData.parent_category_id;
    const catName = categoriesToSelect(categories).find(c => c.id.toString() === catId)?.name || 'Vestuário';
    const isMasculino = catName.toLowerCase().includes('masculin') || formData.name.toLowerCase().includes('masculin');

    return (
        <AdminLayout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-[#05080F]">Gestão de Produtos</h1>
                        <p className="text-slate-500 font-medium text-sm md:text-base">Controle seu catálogo de produtos, estoque e inteligência de tamanhos.</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        {/* IA Credits Badge */}
                        <div className="flex items-center gap-2 bg-[#05080F] text-white px-4 py-3 rounded-2xl border border-white/10 shadow-md shrink-0">
                            <Coins className="w-4 h-4 text-[#FBC02D] animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Saldo IA:</span>
                            <span className="text-sm font-black text-[#FBC02D]">{creditsBalance} cr.</span>
                        </div>

                        <button
                            onClick={() => navigate('/admin/categories')}
                            className="bg-white border border-slate-200 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-slate-600 hover:shadow-md transition-all whitespace-nowrap w-full sm:w-auto"
                        >
                            <Layers className="w-4 h-4 text-[#FBC02D]" />
                            Categorias
                        </button>
                        
                        <button
                            onClick={() => {
                                resetForm();
                                setFormData(prev => ({
                                    ...prev,
                                    sizes_raw: 'P, M, G, GG'
                                }));
                                setSizeChart([
                                    { size_label: 'P', min_chest_cm: 0, max_chest_cm: 0, min_waist_cm: 0, max_waist_cm: 0, min_hips_cm: 0, max_hips_cm: 0 },
                                    { size_label: 'M', min_chest_cm: 0, max_chest_cm: 0, min_waist_cm: 0, max_waist_cm: 0, min_hips_cm: 0, max_hips_cm: 0 },
                                    { size_label: 'G', min_chest_cm: 0, max_chest_cm: 0, min_waist_cm: 0, max_waist_cm: 0, min_hips_cm: 0, max_hips_cm: 0 },
                                    { size_label: 'GG', min_chest_cm: 0, max_chest_cm: 0, min_waist_cm: 0, max_waist_cm: 0, min_hips_cm: 0, max_hips_cm: 0 }
                                ]);
                                setVariants([
                                    { size: 'P', color: 'Única', sku: '', additional_price: 0, stock_quantity: 0 },
                                    { size: 'M', color: 'Única', sku: '', additional_price: 0, stock_quantity: 0 },
                                    { size: 'G', color: 'Única', sku: '', additional_price: 0, stock_quantity: 0 },
                                    { size: 'GG', color: 'Única', sku: '', additional_price: 0, stock_quantity: 0 }
                                ]);
                                setIsNewModalOpen(true);
                            }}
                            className="bg-[#05080F] text-white px-5 py-3 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-xl shadow-[#05080F]/10 hover:bg-[#1a2436] transition-all whitespace-nowrap w-full sm:w-auto"
                        >
                            <Plus className="w-4 h-4 text-[#FBC02D]" />
                            Novo Produto
                        </button>
                    </div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between relative z-20 font-sans">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pl-12 pr-4 text-sm outline-none focus:border-[#FBC02D] transition-all font-medium"
                            value={searchTerm}
                            onChange={(e) => {
                                      setSearchTerm(e.target.value);
                                      setCurrentPage(1);
                                  }}
                        />
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                            className={`flex-grow md:flex-none flex items-center justify-center gap-2 px-6 py-3 border rounded-2xl font-bold transition-all text-sm ${isFiltersOpen ? 'bg-[#FBC02D]/10 border-[#FBC02D] text-[#05080F]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Filter className="w-4 h-4 text-[#FBC02D]" />
                            Filtros {(filterStatus !== 'Todos' || filterCategory !== 'Todas') && <span className="w-2 h-2 bg-[#FBC02D] rounded-full"></span>}
                        </button>
                    </div>

                    {isFiltersOpen && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl animate-in zoom-in-95 duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Status</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D]"
                                        value={filterStatus}
                                        onChange={(e) => {
                                                  setFilterStatus(e.target.value);
                                                  setCurrentPage(1);
                                              }}
                                    >
                                        <option>Todos</option>
                                        <option>Ativo</option>
                                        <option>Estoque Baixo</option>
                                        <option>Sem Estoque</option>
                                        <option>Inativo</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Categoria</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold text-[#05080F] outline-none focus:border-[#FBC02D]"
                                        value={filterCategory}
                                        onChange={(e) => {
                                                  setFilterCategory(e.target.value);
                                                  setCurrentPage(1);
                                              }}
                                    >
                                        <option>Todas</option>
                                        {categoriesToSelect(categories).map(cat => (
                                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Limpar</label>
                                    <button
                                        onClick={() => {
                                                  setFilterStatus('Todos');
                                                  setFilterCategory('Todas');
                                                  setSearchTerm('');
                                                  setIsFiltersOpen(false);
                                              }}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl p-3 text-xs font-black uppercase tracking-widest transition-all"
                                    >
                                        Limpar Tudo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Table View */}
                <div className="space-y-4">
                    <div className="hidden lg:block bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="text-left py-6 px-8 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Produto</th>
                                        <th className="text-left py-6 px-4 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Categorização</th>
                                        <th className="text-left py-6 px-4 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Preço</th>
                                        <th className="text-left py-6 px-4 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Estoque</th>
                                        <th className="text-center py-6 px-4 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Status</th>
                                        <th className="text-right py-6 px-8 text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        [1, 2, 3, 4, 5].map(i => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="py-6 px-8"><div className="h-14 w-full bg-slate-100 rounded-2xl"></div></td>
                                                <td className="py-6 px-4"><div className="h-6 w-24 bg-slate-100 rounded-full"></div></td>
                                                <td className="py-6 px-4"><div className="h-6 w-20 bg-slate-100 rounded-lg"></div></td>
                                                <td className="py-6 px-4"><div className="h-6 w-16 bg-slate-100 rounded-lg"></div></td>
                                                <td className="py-6 px-4"><div className="h-8 w-24 bg-slate-100 rounded-full mx-auto"></div></td>
                                                <td className="py-6 px-8"><div className="h-10 w-24 bg-slate-100 rounded-xl ml-auto"></div></td>
                                            </tr>
                                        ))
                                    ) : currentData.map((prod) => {
                                        const statusInfo = getStatusInfo(prod);
                                        return (
                                            <tr key={prod.id} className="group hover:bg-slate-50/50 transition-colors">
                                                <td className="py-6 px-8">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-[#05080F] overflow-hidden shrink-0">
                                                            {prod.image_url ? (
                                                                <img src={prod.image_url.split(',')[0].trim()} alt={prod.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Package className="w-6 h-6 text-[#FBC02D]" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-black text-[#05080F] truncate">{prod.name}</p>
                                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider mt-0.5">
                                                                <BarChart className="w-3 h-3 text-[#FBC02D]" /> {prod.sales_count || 0} vendas
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-6 px-4">
                                                    <p className="text-sm font-bold text-slate-600">{prod.product_categories?.name || 'Sem Categoria'}</p>
                                                </td>
                                                <td className="py-6 px-4 font-black text-[#05080F]">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.price)}
                                                </td>
                                                <td className="py-6 px-4 font-bold text-[#05080F]">
                                                    {prod.stock_quantity} un.
                                                </td>
                                                <td className="py-6 px-4 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                                                        {statusInfo.text}
                                                    </span>
                                                </td>
                                                <td className="py-6 px-8 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Estúdio IA Button */}
                                                        <button
                                                            onClick={() => handleOpenAiStudio(prod)}
                                                            className="p-2 text-slate-300 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                                                            title="Estúdio IA (Fotos / Banners)"
                                                        >
                                                            <Sparkles className="w-5 h-5 text-purple-500" />
                                                        </button>
                                                        
                                                        <button
                                                            onClick={() => handleOpenEdit(prod)}
                                                            className="p-2 text-slate-300 hover:text-[#FBC02D] hover:bg-[#FBC02D]/10 rounded-xl transition-all"
                                                            title="Editar"
                                                        >
                                                            <Edit className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleProductStatus(prod.id, prod.is_active)}
                                                            className={`p-2 rounded-xl transition-all ${prod.is_active ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-500 hover:bg-emerald-50'}`}
                                                            title={prod.is_active ? 'Desativar' : 'Ativar'}
                                                        >
                                                            {prod.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProduct(prod.id)}
                                                            className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile View */}
                    <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                        {isLoading ? (
                            [1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm animate-pulse space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-slate-100 rounded-2xl shrink-0"></div>
                                        <div className="flex-grow space-y-2">
                                            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                            <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                                        </div>
                                    </div>
                                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                                </div>
                            ))
                        ) : currentData.length > 0 ? (
                            currentData.map((prod) => {
                                const statusInfo = getStatusInfo(prod);
                                return (
                                    <div key={prod.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-[#05080F] overflow-hidden shrink-0">
                                                {prod.image_url ? (
                                                    <img src={prod.image_url.split(',')[0].trim()} alt={prod.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Package className="w-8 h-8 text-[#FBC02D]" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-black text-[#05080F] text-lg truncate">{prod.name}</h3>
                                                <p className="text-sm font-bold text-slate-500">{prod.product_categories?.name || 'Sem Categoria'}</p>
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full text-[9px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</p>
                                                <p className="font-black text-[#05080F]">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.price)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</p>
                                                <p className="font-bold text-[#05080F]">{prod.stock_quantity} unidades</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 pt-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleOpenAiStudio(prod)}
                                                    className="p-3 bg-purple-50 text-purple-600 rounded-xl transition-all"
                                                    title="Estúdio IA"
                                                >
                                                    <Sparkles className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(prod)}
                                                    className="p-3 bg-slate-50 text-slate-400 hover:text-[#FBC02D] hover:bg-[#FBC02D]/10 rounded-xl transition-all"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => toggleProductStatus(prod.id, prod.is_active)}
                                                    className={`p-3 rounded-xl transition-all ${prod.is_active ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}
                                                >
                                                    {prod.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteProduct(prod.id)}
                                                    className="p-3 bg-red-50 text-red-400 hover:text-red-500 rounded-xl transition-all"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Vendas</p>
                                                <p className="font-black text-[#FBC02D]">{prod.sales_count || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-slate-100">
                                <Search className="w-12 h-12 opacity-20 mx-auto" />
                                <p className="font-bold text-slate-400 mt-3">Nenhum produto encontrado.</p>
                            </div>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="p-8 flex justify-center flex-wrap gap-2">
                            {[...Array(totalPages)].map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-10 h-10 md:w-auto md:px-4 md:py-2 rounded-xl text-sm font-bold transition-all ${currentPage === i + 1 ? 'bg-[#05080F] text-white shadow-lg shadow-[#05080F]/10' : 'bg-white border border-slate-100 hover:bg-slate-50 text-[#05080F]'}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create/Edit Product Modal */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 lg:p-8">
                    <div className="absolute inset-0 bg-[#05080F]/80 backdrop-blur-sm" onClick={() => setIsNewModalOpen(false)}></div>
                    <div className="bg-white w-full h-full md:h-auto md:max-h-[95vh] md:max-w-2xl md:rounded-[3.5rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col font-sans">
                        <div className="p-6 md:p-8 border-b border-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-black text-[#05080F]">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
                                <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] md:text-xs tracking-widest">{editingProduct ? 'Atualizar catálogo' : 'Adicionar ao catálogo'}</p>
                            </div>
                            <button type="button" onClick={() => setIsNewModalOpen(false)} className="p-3 md:p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all">
                                <X className="w-5 h-5 md:w-6 md:h-6" />
                            </button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-6 md:p-8 custom-scrollbar">
                            <form className="space-y-8" onSubmit={handleSaveProduct}>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2 relative">
                                            <div className="flex justify-between items-center pr-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Nome do Produto</label>
                                                <button
                                                    type="button"
                                                    onClick={handleGenerateTitleSuggestions}
                                                    className="text-[10px] font-bold text-[#C5A880] hover:text-[#111111] flex items-center gap-1 bg-[#C5A880]/15 hover:bg-[#C5A880]/30 py-1 px-2.5 rounded-full transition-all"
                                                >
                                                    <Wand2 className="w-3 h-3" />
                                                    Sugerir com IA
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-sm"
                                                placeholder="Ex: Camiseta Streetwear Preta"
                                            />
                                            {titleSuggestions.length > 0 && (
                                                <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-150 rounded-3xl p-4 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-50">
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-[#05080F]">Sugestões de Título (IA)</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setTitleSuggestions([])}
                                                            className="text-slate-450 hover:text-slate-700"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        {titleSuggestions.map((suggestion, idx) => (
                                                            <div 
                                                                key={idx}
                                                                className="flex justify-between items-center p-3 bg-slate-50 hover:bg-[#C5A880]/10 rounded-2xl border border-transparent hover:border-[#C5A880]/30 transition-all group"
                                                            >
                                                                <div className="space-y-0.5">
                                                                    <span className="inline-block text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-100 text-[#05080F]">
                                                                        {suggestion.strategy}
                                                                    </span>
                                                                    <p className="text-xs font-bold text-[#05080F] mt-1 pr-4">{suggestion.title}</p>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setFormData({ ...formData, name: suggestion.title });
                                                                        setTitleSuggestions([]);
                                                                        toast.success('Título sugerido aplicado!');
                                                                    }}
                                                                    className="shrink-0 bg-[#05080F] hover:bg-[#C5A880] text-white hover:text-[#05080F] text-[9px] font-black uppercase tracking-widest py-2 px-3 rounded-xl transition-all"
                                                                >
                                                                    Aplicar
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Categoria Principal</label>
                                            <select
                                                required
                                                value={formData.parent_category_id}
                                                onChange={(e) => setFormData({ ...formData, parent_category_id: e.target.value, category_id: '' })}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-sm cursor-pointer"
                                            >
                                                <option value="">Selecionar...</option>
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Subcategoria (Opcional)</label>
                                            <select
                                                value={formData.category_id}
                                                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-sm cursor-pointer"
                                                disabled={!formData.parent_category_id}
                                            >
                                                <option value="">Mesma da Principal</option>
                                                {categories.find(c => c.id.toString() === formData.parent_category_id)?.children?.map(cat => (
                                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Preço</label>
                                            <input
                                                type="text"
                                                required
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-sm"
                                                placeholder="R$ 0,00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center pr-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Estoque Total</label>
                                                {variants.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            document.getElementById('variants-grid-section')?.scrollIntoView({ behavior: 'smooth' });
                                                            toast('Rolei a tela até a grade de variantes para você!', { icon: '👇' });
                                                        }}
                                                        className="text-[9px] text-[#C5A880] hover:text-[#111111] font-bold lowercase normal-case hover:underline animate-pulse"
                                                    >
                                                        (Editar na grade abaixo)
                                                    </button>
                                                )}
                                            </div>
                                            {variants.length <= 1 ? (
                                                <input
                                                    type="number"
                                                    required
                                                    value={formData.stock_quantity}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setFormData({ ...formData, stock_quantity: val });
                                                        const parsedVal = parseInt(val) || 0;
                                                        setVariants(prev => {
                                                            if (prev.length > 0) {
                                                                return prev.map((v, i) => i === 0 ? { ...v, stock_quantity: parsedVal } : v);
                                                            }
                                                            return [{ size: 'Único', color: 'Única', sku: '', additional_price: 0, stock_quantity: parsedVal }];
                                                        });
                                                    }}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-sm"
                                                    placeholder="0"
                                                />
                                            ) : (
                                                <input
                                                    type="number"
                                                    required
                                                    readOnly
                                                    value={formData.stock_quantity}
                                                    className="w-full bg-slate-100 border border-slate-150 rounded-2xl py-4 px-4 font-bold text-slate-500 cursor-not-allowed text-sm outline-none"
                                                    placeholder="0"
                                                    title="Calculado automaticamente a partir das quantidades da grade abaixo"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Logistics Section */}
                                    <div className="p-4 md:p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100 space-y-6">
                                        <h3 className="text-[10px] md:text-sm font-black text-[#05080F] flex items-center gap-2 uppercase tracking-widest">
                                            <Box className="w-4 h-4 text-[#FBC02D]" />
                                            LOGÍSTICA (FRETE)
                                        </h3>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Peso (kg)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    value={formData.weight}
                                                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                                    className="w-full bg-white border border-slate-100 rounded-xl py-3 px-3 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs"
                                                    placeholder="0.5"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Comp. (cm)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={formData.length}
                                                    onChange={(e) => setFormData({ ...formData, length: e.target.value })}
                                                    className="w-full bg-white border border-slate-100 rounded-xl py-3 px-3 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs"
                                                    placeholder="16"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Larg. (cm)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={formData.width}
                                                    onChange={(e) => setFormData({ ...formData, width: e.target.value })}
                                                    className="w-full bg-white border border-slate-100 rounded-xl py-3 px-3 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs"
                                                    placeholder="11"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest pl-1">Alt. (cm)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={formData.height}
                                                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                                                    className="w-full bg-white border border-slate-100 rounded-xl py-3 px-3 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs"
                                                    placeholder="2"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">CEP de Origem (Saída)</label>
                                            <select
                                                required
                                                value={formData.origin_zip}
                                                onChange={(e) => setFormData({ ...formData, origin_zip: e.target.value })}
                                                className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-sm cursor-pointer"
                                            >
                                                <option value="01104-001">01104-001 (São Paulo - Roupas Fem.)</option>
                                                <option value="82820-160">82820-160 (Curitiba - Feminino/Ternos)</option>
                                                <option value="93542-440">93542-440 (Novo Hamburgo - Sapato Masc.)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Variations Section */}
                                    <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Variações / Opções do Produto</label>
                                            <Info className="w-4 h-4 text-slate-300" />
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-tighter pl-1">Tamanhos (ex: P, M, G, GG)</label>
                                                <input
                                                    type="text"
                                                    value={formData.sizes_raw}
                                                    onChange={(e) => {
                                                              const val = e.target.value;
                                                              setFormData({ ...formData, sizes_raw: val });
                                                              validateVariations('sizes_raw', val);
                                                          }}
                                                    className={`w-full bg-white border ${varErrors.sizes_raw ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-100'} rounded-xl py-3 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs transition-all`}
                                                    placeholder="P, M, G, GG..."
                                                />
                                                {varErrors.sizes_raw && <p className="text-[10px] text-red-500 font-bold pl-1 animate-in fade-in slide-in-from-top-1">{varErrors.sizes_raw}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-tighter pl-1">Cores (ex: Preto, Branco, Azul)</label>
                                                <input
                                                    type="text"
                                                    value={formData.colors_raw}
                                                    onChange={(e) => {
                                                              const val = e.target.value;
                                                              setFormData({ ...formData, colors_raw: val });
                                                              validateVariations('colors_raw', val);
                                                          }}
                                                    className={`w-full bg-white border ${varErrors.colors_raw ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-100'} rounded-xl py-3 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs transition-all`}
                                                    placeholder="Separados por vírgula..."
                                                />
                                                {varErrors.colors_raw && <p className="text-[10px] text-red-500 font-bold pl-1 animate-in fade-in slide-in-from-top-1">{varErrors.colors_raw}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-tighter pl-1">Numeração (Calçados)</label>
                                                <input
                                                    type="text"
                                                    value={formData.numbering_raw}
                                                    onChange={(e) => {
                                                              const val = e.target.value;
                                                              setFormData({ ...formData, numbering_raw: val });
                                                              validateVariations('numbering_raw', val);
                                                          }}
                                                    className={`w-full bg-white border ${varErrors.numbering_raw ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-100'} rounded-xl py-3 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs transition-all`}
                                                    placeholder="Ex: 38, 39, 40..."
                                                />
                                                {varErrors.numbering_raw && <p className="text-[10px] text-red-500 font-bold pl-1 animate-in fade-in slide-in-from-top-1">{varErrors.numbering_raw}</p>}
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-[9px] font-black uppercase text-slate-500 tracking-tighter pl-1">Tipos de Solado</label>
                                                <input
                                                    type="text"
                                                    value={formData.soles_raw}
                                                    onChange={(e) => {
                                                              const val = e.target.value;
                                                              setFormData({ ...formData, soles_raw: val });
                                                              validateVariations('soles_raw', val);
                                                          }}
                                                    className={`w-full bg-white border ${varErrors.soles_raw ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-100'} rounded-xl py-3 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] text-xs transition-all`}
                                                    placeholder="Ex: Borracha, Emborrachado..."
                                                />
                                                {varErrors.soles_raw && <p className="text-[10px] text-red-500 font-bold pl-1 animate-in fade-in slide-in-from-top-1">{varErrors.soles_raw}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Grade de Variações e Estoque */}
                                    {variants.length > 0 && (
                                        <div id="variants-grid-section" className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-sans">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Grade de Estoque e Preços por Variante</label>
                                                <p className="text-[9px] font-bold text-slate-400">Defina o estoque e preço adicional de cada combinação de tamanho/cor.</p>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                <table className="w-full text-xs font-bold text-slate-600 text-center min-w-[500px]">
                                                    <thead className="bg-slate-50 border-b border-slate-100">
                                                        <tr>
                                                            <th className="py-2.5 px-2 text-left pl-4">Combinação</th>
                                                            <th className="py-2.5 px-2">SKU</th>
                                                            <th className="py-2.5 px-2">Preço Adicional (R$)</th>
                                                            <th className="py-2.5 px-2">Qtd. em Estoque</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {variants.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="py-3 px-2 text-left pl-4 font-black text-[#05080F]">
                                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] uppercase font-bold mr-1">{item.size}</span>
                                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] uppercase font-bold">{item.color}</span>
                                                                </td>
                                                                <td className="py-3 px-2">
                                                                    <input
                                                                        type="text"
                                                                        value={item.sku}
                                                                        onChange={(e) => handleVariantChange(idx, 'sku', e.target.value)}
                                                                        placeholder="SKU-123"
                                                                        className="w-28 bg-slate-50 border border-slate-100 rounded px-2 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-2">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={item.additional_price}
                                                                        onChange={(e) => handleVariantChange(idx, 'additional_price', parseFloat(e.target.value) || 0)}
                                                                        placeholder="0.00"
                                                                        className="w-24 bg-slate-50 border border-slate-100 rounded px-2 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                    />
                                                                </td>
                                                                <td className="py-3 px-2">
                                                                    <input
                                                                        type="number"
                                                                        value={item.stock_quantity}
                                                                        onChange={(e) => handleVariantChange(idx, 'stock_quantity', parseInt(e.target.value) || 0)}
                                                                        placeholder="0"
                                                                        className="w-20 bg-slate-50 border border-slate-100 rounded px-2 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Size recommendation chart grid (Provador Virtual IA) */}
                                    {sizeChart.length > 0 && (
                                        <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 font-sans">
                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Medidas do Provador Inteligente IA</label>
                                                    <p className="text-[9px] font-bold text-slate-400">Dimensões físicas recomendadas por tamanho (cm)</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={handleAutoPopulateSizeChart}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl font-black text-[10px] uppercase transition-all shrink-0"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5" /> Estimar por IA
                                                </button>
                                            </div>

                                            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
                                                <table className="w-full text-xs font-bold text-slate-600 text-center min-w-[400px]">
                                                    <thead className="bg-slate-50 border-b border-slate-100">
                                                        <tr>
                                                            <th className="py-2.5 px-2 text-left pl-4">Tam.</th>
                                                            <th className="py-2.5 px-2">{isMasculino ? 'Tórax (Mín - Máx)' : 'Busto/Peito (Mín - Máx)'}</th>
                                                            <th className="py-2.5 px-2">{isMasculino ? 'Ombros (Mín - Máx)' : 'Cintura (Mín - Máx)'}</th>
                                                            {!isMasculino && <th className="py-2.5 px-2">Quadril (Mín - Máx)</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {sizeChart.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                                <td className="py-3 px-2 text-left pl-4 font-black text-[#05080F]">{item.size_label}</td>
                                                                <td className="py-3 px-2">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={item.min_chest_cm || ''}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                setSizeChart(prev => prev.map((c, i) => i === idx ? { ...c, min_chest_cm: val } : c));
                                                                            }}
                                                                            className="w-12 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                        />
                                                                        <span>-</span>
                                                                        <input
                                                                            type="number"
                                                                            value={item.max_chest_cm || ''}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                setSizeChart(prev => prev.map((c, i) => i === idx ? { ...c, max_chest_cm: val } : c));
                                                                            }}
                                                                            className="w-12 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-2">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={item.min_waist_cm || ''}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                setSizeChart(prev => prev.map((c, i) => i === idx ? { ...c, min_waist_cm: val } : c));
                                                                            }}
                                                                            className="w-12 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                        />
                                                                        <span>-</span>
                                                                        <input
                                                                            type="number"
                                                                            value={item.max_waist_cm || ''}
                                                                            onChange={(e) => {
                                                                                const val = Number(e.target.value);
                                                                                setSizeChart(prev => prev.map((c, i) => i === idx ? { ...c, max_waist_cm: val } : c));
                                                                            }}
                                                                            className="w-12 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                {!isMasculino && (
                                                                    <td className="py-3 px-2">
                                                                        <div className="flex items-center justify-center gap-1">
                                                                            <input
                                                                                type="number"
                                                                                value={item.min_hips_cm || ''}
                                                                                onChange={(e) => {
                                                                                    const val = Number(e.target.value);
                                                                                    setSizeChart(prev => prev.map((c, i) => i === idx ? { ...c, min_hips_cm: val } : c));
                                                                                }}
                                                                                className="w-12 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                            />
                                                                            <span>-</span>
                                                                            <input
                                                                                type="number"
                                                                                value={item.max_hips_cm || ''}
                                                                                onChange={(e) => {
                                                                                    const val = Number(e.target.value);
                                                                                    setSizeChart(prev => prev.map((c, i) => i === idx ? { ...c, max_hips_cm: val } : c));
                                                                                }}
                                                                                className="w-12 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 text-center outline-none focus:border-[#FBC02D]"
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Description with AI Text Assistant */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center px-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Descrição Comercial</label>
                                            <button
                                                type="button"
                                                onClick={() => setIsAiTextOpen(true)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#05080F] text-white hover:bg-slate-800 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all"
                                            >
                                                <Sparkles className="w-3 h-3 text-[#FBC02D] animate-pulse" /> Gerar Descrição por IA
                                            </button>
                                        </div>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#05080F] outline-none focus:border-[#FBC02D] min-h-[140px] text-sm"
                                            placeholder="Descreva detalhes da peça de roupa, caimento, tecido..."
                                        />
                                    </div>

                                    {/* Image Gallery */}
                                    <div className="space-y-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
                                        <div className="flex items-center justify-between px-2">
                                            <div className="flex flex-col">
                                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Galeria de Imagens</label>
                                                <p className="text-[9px] font-bold text-slate-400 opacity-70">Máximo de 10 fotos • Até 2MB cada</p>
                                            </div>
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${existingImages.length + selectedImages.length >= 10 ? 'bg-red-50 text-red-500' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                                {existingImages.length + selectedImages.length}/10
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                            {existingImages.map((url, idx) => (
                                                <div key={`existing-${idx}`} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100">
                                                    <img src={url} alt="Produto" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeExistingImage(idx)}
                                                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-md transform hover:scale-110 active:scale-95"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-[#05080F]/40 backdrop-blur-[2px] rounded-md text-[7px] font-black text-white uppercase tracking-widest">Salva</div>
                                                </div>
                                            ))}

                                            {imagePreviews.map((blob, idx) => (
                                                <div key={`new-${idx}`} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-[#FBC02D]/40 bg-[#FBC02D]/5 shadow-sm">
                                                    <img src={blob} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeNewImage(idx)}
                                                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 shadow-md transform hover:scale-110 active:scale-95"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-[#FBC02D] rounded-md text-[7px] font-black text-[#05080F] uppercase tracking-widest">Nova</div>
                                                </div>
                                            ))}

                                            {existingImages.length + selectedImages.length < 10 && (
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="aspect-square border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-[#FBC02D] hover:bg-white hover:shadow-xl hover:shadow-[#FBC02D]/5 transition-all group bg-slate-50/50"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-slate-100 group-hover:border-[#FBC02D]/30 transition-colors">
                                                        <Upload className="w-4 h-4 text-slate-400 group-hover:text-[#FBC02D] transition-colors" />
                                                    </div>
                                                    <span className="text-[8px] font-black text-slate-400 group-hover:text-[#05080F] uppercase tracking-widest">Adicionar</span>
                                                </button>
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" multiple />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSaving || Object.values(varErrors).some(err => err !== '')}
                                        className="w-full py-5 bg-[#05080F] text-white rounded-2xl font-black text-sm shadow-xl hover:bg-[#1a2436] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingProduct ? 'SALVAR ALTERAÇÕES' : 'CADASTRAR PRODUTO'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Copywriting Modal */}
            {isAiTextOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#05080F]/90 backdrop-blur-sm" onClick={() => setIsAiTextOpen(false)}></div>
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl relative z-10 p-6 md:p-8 animate-in zoom-in-95 duration-200 font-sans">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-[#05080F] flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                                Redator Inteligente IA
                            </h3>
                            <button onClick={() => setIsAiTextOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tom de Voz da Cópia</label>
                                <select
                                    value={aiTone}
                                    onChange={(e) => setAiTone(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D] cursor-pointer"
                                >
                                    <option>Moderno e Despojado</option>
                                    <option>Elegante e Sofisticado</option>
                                    <option>Minimalista e Técnico</option>
                                    <option>Comercial com Foco em Vendas</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Destaques da Roupa (Palavras-chave)</label>
                                <input
                                    type="text"
                                    value={aiKeywords}
                                    onChange={(e) => setAiKeywords(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D]"
                                    placeholder="Ex: Moletom flanelado, Estampa costas, Algodão premium..."
                                />
                            </div>
                            <button
                                onClick={handleGenerateCopyText}
                                disabled={isGeneratingCopy}
                                className="w-full py-4 mt-2 bg-[#05080F] text-[#FBC02D] hover:bg-slate-800 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {isGeneratingCopy ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'GERAR DESCRIÇÃO COMERCIAL'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Studio Modal */}
            {isAiStudioOpen && selectedStudioProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#05080F]/90 backdrop-blur-sm" onClick={() => setIsAiStudioOpen(false)}></div>
                    <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] font-sans">
                        <div className="p-6 border-b border-slate-50 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-xl md:text-2xl font-black text-[#05080F] flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                                    Estúdio IA da Loja
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Criar ativos promocionais e fotos profissionais de moda</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 bg-[#05080F] text-[#FBC02D] px-3 py-1.5 rounded-xl border border-white/10 text-xs font-black">
                                    <Coins className="w-3.5 h-3.5" />
                                    {creditsBalance} cr.
                                </div>
                                <button onClick={() => setIsAiStudioOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-all">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-50 shrink-0 bg-slate-50/50 p-2 gap-2">
                            {(['photo', 'model', 'banner'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => {
                                        setStudioTab(tab);
                                        setGeneratedStudioImage(null);
                                    }}
                                    className={`flex-grow text-center py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                        studioTab === tab
                                            ? 'bg-[#05080F] text-[#FBC02D]'
                                            : 'text-slate-500 hover:text-[#05080F] hover:bg-white'
                                    }`}
                                >
                                    {tab === 'photo' ? 'Foto Estúdio' : tab === 'model' ? 'Modelo Virtual' : 'Banner Promo'}
                                </button>
                            ))}
                        </div>

                        <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 custom-scrollbar">
                            {/* Generation Config Left */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-[#05080F]">
                                        {selectedStudioProduct.image_url ? (
                                            <img src={selectedStudioProduct.image_url.split(',')[0].trim()} alt="Produto" className="w-full h-full object-cover" />
                                        ) : (
                                            <Package className="w-5 h-5 text-slate-300" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-[#05080F] truncate">{selectedStudioProduct.name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedStudioProduct.price)}</p>
                                    </div>
                                </div>

                                {studioTab === 'photo' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Estilo de Cenário de Estúdio</label>
                                            <select
                                                value={studioConfig.bgStyle}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, bgStyle: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D] cursor-pointer"
                                            >
                                                <option>Estúdio Minimalista Dourado</option>
                                                <option>Cenário de Rua Urbana (Graffiti)</option>
                                                <option>Vitrine de Shopping de Luxo</option>
                                                <option>Fundo Foco Desfoque (Sunset Light)</option>
                                                <option>Praia Tropical Ensolarada</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Instruções Extras de Cenário (Opcional)</label>
                                            <textarea
                                                value={studioConfig.customPrompt}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, customPrompt: e.target.value })}
                                                placeholder="Ex: Mesa de madeira rústica, flores brancas ao fundo, iluminação suave..."
                                                rows={2}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D] resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {studioTab === 'model' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Perfil do Modelo IA</label>
                                            <select
                                                value={studioConfig.modelProfile}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, modelProfile: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D] cursor-pointer"
                                            >
                                                <option>Modelo Feminina - Clara (Jovem/Estilo Clean)</option>
                                                <option>Modelo Feminina - Julia (Curvy/Estilo Urbano)</option>
                                                <option>Modelo Masculino - Pedro (Jovem/Estilo Streetwear)</option>
                                                <option>Modelo Masculino - Carlos (Adulto/Estilo Executivo)</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {studioTab === 'banner' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Texto de Oferta Principal</label>
                                            <input
                                                type="text"
                                                value={studioConfig.bannerTitle}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, bannerTitle: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Subtexto / Cupom</label>
                                            <input
                                                type="text"
                                                value={studioConfig.bannerSubtitle}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, bannerSubtitle: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tema do Banner</label>
                                            <select
                                                value={studioConfig.bannerTheme}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, bannerTheme: e.target.value })}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D] cursor-pointer"
                                            >
                                                <option>Neon Street</option>
                                                <option>Luxury Golden</option>
                                                <option>Minimalist Clean Studio</option>
                                                <option>Outono Cores Quentes</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Instruções Extras de Cenário (Opcional)</label>
                                            <textarea
                                                value={studioConfig.customPrompt}
                                                onChange={(e) => setStudioConfig({ ...studioConfig, customPrompt: e.target.value })}
                                                placeholder="Ex: Fundo de liquidação, tons pastéis, balões dourados..."
                                                rows={2}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs font-bold text-[#05080F] outline-none focus:border-[#FBC02D] resize-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex items-start gap-3 animate-in fade-in duration-300">
                                    <Coins className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-black text-[#05080F]">Custo de Transação: 5 Créditos</p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">Cada geração debitará 5 créditos do seu saldo. Você poderá baixar o resultado ou salvá-lo na galeria do produto.</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleGenerateStudioAsset}
                                    disabled={isGeneratingStudio}
                                    className="w-full py-4.5 bg-[#05080F] text-white hover:bg-slate-800 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                                >
                                    {isGeneratingStudio ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'GERAR IMAGEM COM IA'}
                                </button>
                            </div>

                            {/* Generation Preview Right */}
                            <div className="bg-slate-50 rounded-[2rem] border border-slate-100 p-4 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden group">
                                {isGeneratingStudio ? (
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <Loader2 className="w-10 h-10 text-[#FBC02D] animate-spin" />
                                        <p className="text-xs font-black text-[#05080F] uppercase tracking-wider animate-pulse">Renderizando Ativo de IA...</p>
                                        <p className="text-[10px] text-slate-400 font-bold max-w-[200px]">Ajustando textura de tecidos, luzes de estúdio e enquadramento</p>
                                    </div>
                                ) : generatedStudioImage ? (
                                    <div className="w-full h-full flex flex-col justify-between items-center gap-4">
                                        <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-white relative flex items-center justify-center">
                                            <img src={generatedStudioImage} alt="Gerada IA" className="w-full h-full object-contain" />
                                            <div className="absolute top-3 right-3 bg-emerald-500 text-white px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                                                <CheckCircle className="w-3.5 h-3.5" /> Pronto
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 w-full">
                                            <button
                                                onClick={handleDownloadImage}
                                                className="flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm"
                                            >
                                                <Download className="w-4 h-4" /> Baixar
                                            </button>
                                            
                                            <button
                                                onClick={handleSaveToGallery}
                                                disabled={isImageSavedToGallery || isSavingToGallery}
                                                className={`flex items-center justify-center gap-2 py-3 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm ${
                                                    isImageSavedToGallery 
                                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 cursor-not-allowed'
                                                        : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/10'
                                                }`}
                                            >
                                                {isSavingToGallery ? (
                                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                                ) : isImageSavedToGallery ? (
                                                    <>Salvo ✔</>
                                                ) : (
                                                    <>Salvar</>
                                                )}
                                            </button>
                                        </div>

                                        <button
                                            onClick={handleGenerateStudioAsset}
                                            disabled={isGeneratingStudio}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-[#05080F] text-white hover:bg-slate-800 font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md"
                                        >
                                            <Sparkles className="w-4 h-4 text-[#FBC02D]" />
                                            Gerar Novamente (5 cr.)
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-slate-400 text-center">
                                        <ImageIcon className="w-12 h-12 opacity-30 animate-bounce" />
                                        <p className="text-xs font-black text-[#05080F] uppercase tracking-wider">Visualização do Ativo</p>
                                        <p className="text-[10px] font-bold max-w-[200px]">Configure os parâmetros e clique em gerar para ver o resultado do estúdio IA</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
};

export default AdminProducts;
