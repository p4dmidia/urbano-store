import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    X, Sparkles, Upload, User, 
    ShoppingCart, Loader2, ArrowLeft, 
    Check, Cpu, RefreshCw, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';
import toast from 'react-hot-toast';
import { trackEvent } from '../lib/analytics';
import { ORGANIZATION_ID } from '../lib/config';

interface TryOnModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: any;
    activeVariant: any;
    variants: any[];
    onVariantChange: (size: string, color: string, priority: 'size' | 'color') => void;
}

const DEFAULT_AVATARS = [
    { id: 'female_slim', name: 'Feminino Slim (Sarah)', url: '/assets/vton_model_female_slim.png', gender: 'female' },
    { id: 'female_curvy', name: 'Feminino Curvy (Camila)', url: '/assets/vton_model_female_curvy.png', gender: 'female' },
    { id: 'male_slim', name: 'Masculino Slim (Gabriel)', url: '/assets/vton_model_male_slim.png', gender: 'male' },
    { id: 'male_athletic', name: 'Masculino Atlético (Lucas)', url: '/assets/vton_model_male_athletic.png', gender: 'male' }
];

const SKIN_COLORS = [
    { name: 'Cinza', value: '#E2E8F0' },
    { name: 'Creme', value: '#F5EBE1' },
    { name: 'Pele Clara', value: '#E8C39E' },
    { name: 'Pele Parda', value: '#D4A373' },
    { name: 'Pele Bronzeada', value: '#A98467' },
    { name: 'Pele Negra Suave', value: '#825E4B' },
    { name: 'Pele Negra Escura', value: '#4A3728' }
];

const calculateBodyMeasurements = (height: number, weight: number, age: number, gender: 'male' | 'female') => {
    let chest = 90;
    let waist = 70;
    let hips = 95;
    let shoulder = 38;

    if (gender === 'male') {
        chest = 94 + (weight - 70) * 0.6 + (175 - height) * 0.12;
        waist = 80 + (weight - 70) * 0.75 + (175 - height) * 0.1 + (age > 30 ? (age - 30) * 0.15 : 0);
        hips = 94 + (weight - 70) * 0.5 + (175 - height) * 0.1;
        shoulder = 40.5 + (weight - 70) * 0.18;
    } else {
        // female
        chest = 96 + (weight - 70) * 0.7 + (165 - height) * 0.1;
        waist = 78 + (weight - 70) * 0.7 + (165 - height) * 0.1 + (age > 30 ? (age - 30) * 0.15 : 0);
        hips = 98 + (weight - 70) * 0.8 + (165 - height) * 0.1;
        shoulder = 38 + (weight - 70) * 0.15;
    }

    return {
        chest: Math.round(chest * 10) / 10,
        waist: Math.round(waist * 10) / 10,
        hips: Math.round(hips * 10) / 10,
        shoulder: Math.round(shoulder * 10) / 10
    };
};

const getStandardSizeChart = (sizeLabel: string, category: string = 'top', isMasculino: boolean = false) => {
    const s = sizeLabel.toUpperCase();
    const isBottom = category.toLowerCase().includes('calça') || 
                     category.toLowerCase().includes('bermuda') || 
                     category.toLowerCase().includes('short') || 
                     category.toLowerCase().includes('pants') || 
                     category.toLowerCase().includes('bottom');
                     
    if (isBottom) {
        switch (s) {
            case 'PP': case '36': return { max_chest_cm: 80, max_waist_cm: 72, max_hips_cm: 90 };
            case 'P': case '38': return { max_chest_cm: 86, max_waist_cm: 78, max_hips_cm: 96 };
            case 'M': case '40': case '42': return { max_chest_cm: 92, max_waist_cm: 84, max_hips_cm: 102 };
            case 'G': case '44': return { max_chest_cm: 98, max_waist_cm: 90, max_hips_cm: 108 };
            case 'GG': case '46': return { max_chest_cm: 104, max_waist_cm: 96, max_hips_cm: 114 };
            case 'XG': case 'EG': case '48': return { max_chest_cm: 110, max_waist_cm: 102, max_hips_cm: 120 };
            case 'XXG': case 'EGG': case '50': return { max_chest_cm: 116, max_waist_cm: 108, max_hips_cm: 126 };
            default: return { max_chest_cm: 92, max_waist_cm: 84, max_hips_cm: 102 };
        }
    } else {
        if (isMasculino) {
            switch (s) {
                case 'PP': case '34': return { max_chest_cm: 88, max_waist_cm: 37.5, max_hips_cm: 0 };
                case 'P': case '36': case '38': return { max_chest_cm: 92, max_waist_cm: 39.5, max_hips_cm: 0 };
                case 'M': case '40': case '42': return { max_chest_cm: 96, max_waist_cm: 41.5, max_hips_cm: 0 };
                case 'G': case '44': case '46': return { max_chest_cm: 102, max_waist_cm: 44.0, max_hips_cm: 0 };
                case 'GG': case '48': case '50': return { max_chest_cm: 108, max_waist_cm: 47.0, max_hips_cm: 0 };
                case 'XG': case '52': return { max_chest_cm: 114, max_waist_cm: 50.0, max_hips_cm: 0 };
                case 'XXG': case '54': return { max_chest_cm: 120, max_waist_cm: 52.0, max_hips_cm: 0 };
                default: return { max_chest_cm: 96, max_waist_cm: 41.5, max_hips_cm: 0 };
            }
        } else {
            switch (s) {
                case 'PP': case '34': case '36': return { max_chest_cm: 85, max_waist_cm: 74, max_hips_cm: 87 };
                case 'P': case '38': case '40': return { max_chest_cm: 93, max_waist_cm: 77, max_hips_cm: 90 };
                case 'M': case '42': case '44': return { max_chest_cm: 97, max_waist_cm: 80, max_hips_cm: 93 };
                case 'G': case '46': case '48': return { max_chest_cm: 102, max_waist_cm: 83, max_hips_cm: 96 };
                case 'GG': case '50': return { max_chest_cm: 107, max_waist_cm: 86, max_hips_cm: 100 };
                case 'XG': case '52': return { max_chest_cm: 112, max_waist_cm: 89, max_hips_cm: 104 };
                case 'XXG': case '54': return { max_chest_cm: 117, max_waist_cm: 92, max_hips_cm: 108 };
                default: return { max_chest_cm: 97, max_waist_cm: 80, max_hips_cm: 93 };
            }
        }
    }
};

const getResolvedChart = (sizeLabel: string, category: string, dbCharts: any[], isMasculino: boolean = false) => {
    const dbChart = dbCharts.find(c => c.size_label.toUpperCase() === sizeLabel.toUpperCase());
    const standard = getStandardSizeChart(sizeLabel, category, isMasculino);
    
    return {
        max_chest_cm: dbChart && Number(dbChart.max_chest_cm) > 0 ? Number(dbChart.max_chest_cm) : standard.max_chest_cm,
        max_waist_cm: dbChart && Number(dbChart.max_waist_cm) > 0 ? Number(dbChart.max_waist_cm) : standard.max_waist_cm,
        max_hips_cm: dbChart && Number(dbChart.max_hips_cm) > 0 ? Number(dbChart.max_hips_cm) : standard.max_hips_cm
    };
};

const getFitFeedback = (userVal: number, maxVal: number, type: 'chest' | 'waist' | 'hips' = 'chest', category: string = 'top', isMasculino: boolean = false) => {
    const isBottom = category.toLowerCase().includes('calça') || 
                     category.toLowerCase().includes('bermuda') || 
                     category.toLowerCase().includes('short') || 
                     category.toLowerCase().includes('pants') || 
                     category.toLowerCase().includes('bottom');
                     
    let effectiveMax = maxVal;
    if (!isBottom) {
        if (isMasculino && type === 'waist') {
            effectiveMax = maxVal;
        } else {
            if (type === 'waist') effectiveMax += 4;
            else if (type === 'hips') effectiveMax += 8;
        }
    }

    const diff = effectiveMax - userVal;
    let label = '';
    
    const color = diff < -4 ? '#EF4444' : // vermelho (apertado)
                  diff < 0 ? '#F97316' :  // laranja (justo)
                  diff <= 3 ? '#10B981' : // verde (levemente justo)
                  diff <= 8 ? '#059669' : // verde escuro (confortável)
                  diff <= 12 ? '#3B82F6' : // azul (folgado)
                  '#64748B';             // cinza (muito folgado)

    const ringColor = diff < -4 ? 'border-red-500/50' : 
                      diff < 0 ? 'border-orange-500/50' : 
                      diff <= 3 ? 'border-emerald-500/50' : 
                      diff <= 8 ? 'border-emerald-600/50' : 
                      diff <= 12 ? 'border-blue-500/50' : 
                      'border-slate-400/50';
    
    if (diff < -4) {
        label = `apertado (${Math.round(diff)}cm)`;
    } else if (diff < 0) {
        label = `justo (${Math.round(diff)}cm)`;
    } else if (diff <= 3) {
        label = `levemente justo (+${Math.round(diff)}cm)`;
    } else if (diff <= 8) {
        label = `confortável (+${Math.round(diff)}cm)`;
    } else if (diff <= 12) {
        label = `folgado (+${Math.round(diff)}cm)`;
    } else {
        label = `muito folgado (+${Math.round(diff)}cm)`;
    }
    
    const cleanLabel = diff < -4 ? 'apertado' : 
                       diff < 0 ? 'justo' : 
                       diff <= 3 ? 'levemente justo' : 
                       diff <= 8 ? 'confortável' : 
                       diff <= 12 ? 'folgado' : 
                       'muito folgado';
    
    return { label, cleanLabel, color, ringColor, diff };
};

const getOverallFitStatus = (chestLabel: string, waistLabel: string, category: string = 'top', isMasculino: boolean = false) => {
    const isBottom = category.toLowerCase().includes('calça') || 
                     category.toLowerCase().includes('bermuda') || 
                     category.toLowerCase().includes('short') || 
                     category.toLowerCase().includes('pants') || 
                     category.toLowerCase().includes('bottom');

    if (isBottom) {
        if (chestLabel === 'apertado' || waistLabel === 'apertado' || chestLabel === 'muito folgado' || waistLabel === 'muito folgado') {
            return { label: 'NÃO É RECOMENDADO', color: '#EF4444', icon: 'x' };
        }
        if (chestLabel === 'justo' || waistLabel === 'justo' || chestLabel === 'folgado' || waistLabel === 'folgado') {
            return { label: 'TAMBÉM SERVE', color: '#F97316', icon: 'check-yellow' };
        }
        return { label: 'RECOMENDADO', color: '#10B981', icon: 'check-green' };
    } else {
        if (chestLabel === 'apertado' || chestLabel === 'muito folgado' || waistLabel === 'apertado') {
            return { label: 'NÃO É RECOMENDADO', color: '#EF4444', icon: 'x' };
        }
        if (chestLabel === 'justo' || chestLabel === 'folgado' || waistLabel === 'justo' || waistLabel === 'folgado' || waistLabel === 'muito folgado') {
            return { label: 'TAMBÉM SERVE', color: '#F97316', icon: 'check-yellow' };
        }
        return { label: 'RECOMENDADO', color: '#10B981', icon: 'check-green' };
    }
};

const getFitIcon = (label: string) => {
    switch (label) {
        case 'apertado':
            return (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            );
        case 'justo':
        case 'levemente justo':
        case 'folgado':
            return (
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
            );
        case 'confortável':
            return (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            );
        default:
            return (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            );
    }
};

const getRecommendedSizeFromChart = (
    userChest: number,
    userWaist: number,
    userHips: number,
    sizeCharts: any[],
    category: string = 'top',
    userShoulder?: number,
    isMasculino: boolean = false,
    variants: any[] = []
) => {
    const sizeHierarchy = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG', 'EG', 'EGG'];
    
    // Evaluate sizes actually available in product variants (or sizeCharts as fallback)
    const availableSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
    const sizesToEvaluate = availableSizes.length > 0 
        ? availableSizes 
        : sizeCharts.map(c => c.size_label);

    const resolvedCharts = sizesToEvaluate.map(sizeLabel => {
        const dbChart = sizeCharts.find(c => c.size_label.toUpperCase() === sizeLabel.toUpperCase());
        const std = getStandardSizeChart(sizeLabel, category, isMasculino);
        return {
            size_label: sizeLabel,
            max_chest_cm: dbChart && Number(dbChart.max_chest_cm) > 0 ? Number(dbChart.max_chest_cm) : std.max_chest_cm,
            max_waist_cm: dbChart && Number(dbChart.max_waist_cm) > 0 ? Number(dbChart.max_waist_cm) : std.max_waist_cm,
            max_hips_cm: dbChart && Number(dbChart.max_hips_cm) > 0 ? Number(dbChart.max_hips_cm) : std.max_hips_cm
        };
    });

    // Rate all resolved charts using their fit feedbacks
    const ratedSizes = resolvedCharts.map(chart => {
        const chestFeedback = getFitFeedback(userChest, chart.max_chest_cm, 'chest', category, isMasculino);
        
        let effectiveWaist = userWaist;
        if (isMasculino) {
            effectiveWaist = userShoulder || userWaist;
        }
        const waistFeedback = getFitFeedback(effectiveWaist, chart.max_waist_cm, 'waist', category, isMasculino);
        
        const status = getOverallFitStatus(chestFeedback.cleanLabel, waistFeedback.cleanLabel, category, isMasculino);
        
        return {
            size_label: chart.size_label,
            status: status.label,
            max_chest_cm: chart.max_chest_cm
        };
    });

    // 1. Try to find the smallest 'RECOMENDADO' size
    const recommendedSizes = ratedSizes.filter(s => s.status === 'RECOMENDADO');
    if (recommendedSizes.length > 0) {
        recommendedSizes.sort((a, b) => {
            const idxA = sizeHierarchy.indexOf(a.size_label.toUpperCase());
            const idxB = sizeHierarchy.indexOf(b.size_label.toUpperCase());
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.max_chest_cm - b.max_chest_cm;
        });
        return recommendedSizes[0].size_label;
    }

    // 2. Try to find the smallest 'TAMBÉM SERVE' size
    const servingSizes = ratedSizes.filter(s => s.status === 'TAMBÉM SERVE');
    if (servingSizes.length > 0) {
        servingSizes.sort((a, b) => {
            const idxA = sizeHierarchy.indexOf(a.size_label.toUpperCase());
            const idxB = sizeHierarchy.indexOf(b.size_label.toUpperCase());
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            return a.max_chest_cm - b.max_chest_cm;
        });
        return servingSizes[0].size_label;
    }

    // 3. Fallback to largest size if nothing is recommended or serves
    if (resolvedCharts.length > 0) {
        resolvedCharts.sort((a, b) => {
            const idxA = sizeHierarchy.indexOf(a.size_label.toUpperCase());
            const idxB = sizeHierarchy.indexOf(b.size_label.toUpperCase());
            if (idxA !== -1 && idxB !== -1) return idxB - idxA; // descending
            return b.max_chest_cm - a.max_chest_cm;
        });
        return resolvedCharts[0].size_label;
    }
    
    return null;
};



const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script ${src}`));
        document.head.appendChild(script);
    });
};

export const TryOnModal: React.FC<TryOnModalProps> = ({
    isOpen,
    onClose,
    product,
    activeVariant,
    variants,
    onVariantChange
}) => {
    const { user, profile } = useAuth();
    const { addToCart } = useCart();
    const navigate = useNavigate();

    const isMasculino = !!(
        product?.product_categories?.name?.toLowerCase().includes('masculin') || 
        product?.product_categories?.parent?.name?.toLowerCase().includes('masculin') ||
        product?.name?.toLowerCase().includes('masculin') ||
        product?.name?.toLowerCase().includes('masc')
    );

    const isARCategory = (prod: any) => {
        if (!prod) return false;
        const name = (prod.product_categories?.name || prod.category || prod.name || '').toLowerCase();
        return (
            name.includes('óculos') || name.includes('oculos') ||
            name.includes('brinco') || name.includes('anel') ||
            name.includes('colar') || name.includes('pulseira') ||
            name.includes('joia') || name.includes('jóia') ||
            name.includes('semijoia') || name.includes('acessório') ||
            name.includes('acessorio')
        );
    };
    
    const isARProduct = isARCategory(product);
    
    // Recommended Size
    const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
    
    // VTON States
    const [step, setStep] = useState<'form' | 'adjust_body' | 'tryon' | 'select_avatar_photo' | 'outfit_suggestions' | 'ar_tryon'>(
        isARProduct ? 'ar_tryon' : 'form'
    );
    const [localSelectedSize, setLocalSelectedSize] = useState<string | null>(null);
    const [isManualSelection, setIsManualSelection] = useState(false);

    // AR camera state
    const [arLoading, setArLoading] = useState(false);
    const [arActive, setArActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const cameraObjRef = useRef<any>(null);

    const stopAR = () => {
        if (cameraObjRef.current) {
            try {
                cameraObjRef.current.stop();
            } catch (e) {
                console.error("Error stopping cameraObj:", e);
            }
            cameraObjRef.current = null;
        }
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {
                    console.error("Error stopping track:", e);
                }
            });
            setCameraStream(null);
        }
        setArActive(false);
    };

    const startAR = async () => {
        setArLoading(true);
        try {
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
            await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');

            if (!videoRef.current || !canvasRef.current) {
                throw new Error("Elementos de câmera ou canvas não encontrados.");
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
                audio: false
            });
            videoRef.current.srcObject = stream;
            videoRef.current.play();
            setCameraStream(stream);

            const FaceMesh = (window as any).FaceMesh;
            const Camera = (window as any).Camera;

            const faceMesh = new FaceMesh({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });

            faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            const itemImg = new Image();
            const productImages = product.images || (product.image_url ? product.image_url.split(',') : []);
            itemImg.src = activeVariant?.variant_image_url || productImages[0] || '';
            itemImg.crossOrigin = "anonymous";

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            faceMesh.onResults((results: any) => {
                if (!ctx || !canvas || !videoRef.current) return;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
                    const landmarks = results.multiFaceLandmarks[0];
                    const dist = (p1: any, p2: any) => Math.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2);

                    const name = (product.product_categories?.name || product.category || product.name || '').toLowerCase();
                    const isGlasses = name.includes('óculos') || name.includes('oculos');
                    
                    if (isGlasses) {
                        const bridge = landmarks[168];
                        const leftEye = landmarks[33];
                        const rightEye = landmarks[263];

                        if (bridge && leftEye && rightEye) {
                            const bridgeX = bridge.x * canvas.width;
                            const bridgeY = bridge.y * canvas.height;
                            const eyeDist = dist(leftEye, rightEye) * canvas.width;
                            const glassesWidth = eyeDist * 1.9;
                            const glassesHeight = glassesWidth * (itemImg.height / itemImg.width || 0.4);
                            const angle = Math.atan2(
                                (rightEye.y - leftEye.y) * canvas.height,
                                (rightEye.x - leftEye.x) * canvas.width
                            );

                            ctx.save();
                            ctx.translate(bridgeX, bridgeY);
                            ctx.rotate(-angle);
                            ctx.drawImage(itemImg, -glassesWidth / 2, -glassesHeight / 2, glassesWidth, glassesHeight);
                            ctx.restore();
                        }
                    } else {
                        // Earrings / Accessories
                        const rightEarlobe = landmarks[172];
                        const leftEarlobe = landmarks[397];
                        const leftEye = landmarks[33];
                        const rightEye = landmarks[263];

                        if (rightEarlobe && leftEarlobe && leftEye && rightEye) {
                            const eyeDist = dist(leftEye, rightEye) * canvas.width;
                            const earringWidth = eyeDist * 0.35;
                            const earringHeight = earringWidth * (itemImg.height / itemImg.width || 1.0);

                            const leftX = leftEarlobe.x * canvas.width;
                            const leftY = leftEarlobe.y * canvas.height;
                            ctx.drawImage(itemImg, leftX - earringWidth / 2, leftY, earringWidth, earringHeight);

                            const rightX = rightEarlobe.x * canvas.width;
                            const rightY = rightEarlobe.y * canvas.height;
                            ctx.drawImage(itemImg, rightX - earringWidth / 2, rightY, earringWidth, earringHeight);
                        }
                    }
                }
                ctx.restore();
            });

            const camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    await faceMesh.send({ image: videoRef.current! });
                },
                width: 640,
                height: 480
            });
            camera.start();
            cameraObjRef.current = camera;
            setArActive(true);
        } catch (err) {
            console.error("Failed to start AR:", err);
            toast.error("Não foi possível acessar a câmera para o provador virtual.");
        } finally {
            setArLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen || (step !== 'tryon' && step !== 'outfit_suggestions')) {
            setIsManualSelection(false);
        }
    }, [isOpen, step]);

    useEffect(() => {
        if (step === 'tryon' && recommendedSize && !isManualSelection && activeVariant?.size !== recommendedSize) {
            setLocalSelectedSize(recommendedSize);
            onVariantChange(recommendedSize, activeVariant?.color || '', 'size');
        }
    }, [step, recommendedSize, isManualSelection, activeVariant?.size, activeVariant?.color, onVariantChange]);

    useEffect(() => {
        if (isOpen) {
            if (step !== 'tryon' || !recommendedSize) {
                setLocalSelectedSize(activeVariant?.size || recommendedSize || 'M');
            }
        }
    }, [isOpen, activeVariant?.size, recommendedSize, step]);

    useEffect(() => {
        if (isOpen && step === 'ar_tryon' && !arActive && !arLoading) {
            startAR();
        }
        return () => {
            if (!isOpen || step !== 'ar_tryon') {
                stopAR();
            }
        };
    }, [isOpen, step]);

    useEffect(() => {
        if (isOpen && arActive && step === 'ar_tryon' && activeVariant?.id) {
            stopAR();
            startAR();
        }
    }, [activeVariant?.id]);
    const [gender, setGender] = useState<'male' | 'female'>(isMasculino ? 'male' : 'female');
    const [heightInput, setHeightInput] = useState('');
    const [weightInput, setWeightInput] = useState('');
    const [ageInput, setAgeInput] = useState('');
    const [sizeCharts, setSizeCharts] = useState<any[]>([]);

    // Adjust body measurements states
    const [chestValue, setChestValue] = useState<number>(90);
    const [waistValue, setWaistValue] = useState<number>(70);
    const [hipsValue, setHipsValue] = useState<number>(95);
    const [skinColor, setSkinColor] = useState<string>('#E2E8F0');
    const [isCalculatingFit, setIsCalculatingFit] = useState(false);
    const [viewMode, setViewMode] = useState<'mannequin' | 'photo'>('mannequin');

    const [useCustomPhoto, setUseCustomPhoto] = useState(false);
    const [selectedAvatarId, setSelectedAvatarId] = useState('female_slim');
    const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [bodyProfile, setBodyProfile] = useState<any>(null);
    
    const intervalRef = useRef<any>(null);
    
    // Generation States
    const [isGenerating, setIsGenerating] = useState(false);
    const [tryonResultUrl, setTryonResultUrl] = useState<string | null>(null);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('Inicializando motor de VTON...');

    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [isFetchingRecommendations, setIsFetchingRecommendations] = useState(false);

    // Faturamento e Limites
    const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
    const [userDailyUsage, setUserDailyUsage] = useState<number>(0);
    const [isLoadingLimits, setIsLoadingLimits] = useState(false);

    const fetchLimits = async () => {
        if (!isOpen) return;
        setIsLoadingLimits(true);
        try {
            const tenantId = product?.tenant_id || profile?.tenant_id || ORGANIZATION_ID;
            
            // 1. Buscar créditos do lojista
            const { data: creditsData, error: creditsErr } = await supabase
                .from('organization_ai_credits')
                .select('available_credits')
                .eq('tenant_id', tenantId)
                .maybeSingle();

            if (!creditsErr && creditsData) {
                setCreditsBalance(creditsData.available_credits);
            } else {
                setCreditsBalance(0);
            }

            // 2. Buscar uso diário do usuário
            if (user) {
                const startOfToday = new Date();
                startOfToday.setUTCHours(0, 0, 0, 0); // Limite diário resetado à meia-noite UTC
                
                const { count, error: countErr } = await supabase
                    .from('ai_credit_transactions')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('transaction_type', 'usage_tryon')
                    .gte('created_at', startOfToday.toISOString());

                if (!countErr && count !== null) {
                    setUserDailyUsage(count);
                } else {
                    setUserDailyUsage(0);
                }
            } else {
                setUserDailyUsage(0);
            }
        } catch (err) {
            console.error('Error fetching try-on limits:', err);
        } finally {
            setIsLoadingLimits(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchLimits();
        }
    }, [isOpen, user, tryonResultUrl]);

    // Dynamic silhouette variables based on BMI and body metrics
    const heightVal = parseFloat(heightInput.replace(',', '.')) || bodyProfile?.height_cm || 170;
    const weightVal = parseFloat(weightInput.replace(',', '.')) || bodyProfile?.weight_kg || 70;
    const bmi = heightVal > 0 ? weightVal / ((heightVal / 100) ** 2) : 0;
    const isHeavy = bmi >= 26 || (bodyProfile?.chest_cm || chestValue || 90) >= 100;
    const silhouetteSrc = isHeavy ? '/assets/mannequin_silhouette_heavy.png' : '/assets/mannequin_silhouette.png';

    // Auto-trigger generation when active variant changes, if VTON was already generated at least once
    // useEffect(() => {
    //     if (isOpen && tryonResultUrl && activeVariant?.id && !isGenerating) {
    //         handleStartTryOn();
    //     }
    // }, [activeVariant?.id]);

    useEffect(() => {
        if (isOpen && product?.id) {
            trackEvent('vton_opened', { product_id: product.id, variant_id: activeVariant?.id });
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && activeVariant?.id) {
            fetchRecommendations();
        }
    }, [isOpen, activeVariant?.id]);

    const fetchRecommendations = async () => {
        setIsFetchingRecommendations(true);
        try {
            const { data, error } = await supabase.functions.invoke(`generate-tryon/outfit/recommendations/${activeVariant.id}`, {
                method: 'GET'
            });
            if (error || !data) {
                throw new Error(error?.message || 'Falha ao carregar recomendações.');
            }
            setRecommendations(data.recommendations || []);
        } catch (err) {
            console.error('Error fetching look recommendations:', err);
        } finally {
            setIsFetchingRecommendations(false);
        }
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            stopAR();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            setIsGenerating(false);
            setGenerationProgress(0);
            stopAR();
        }
    }, [isOpen]);



    useEffect(() => {
        if (isOpen) {
            fetchBodyProfile();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && product?.id) {
            const fetchSizeCharts = async () => {
                const { data, error } = await supabase
                    .from('size_charts')
                    .select('*')
                    .eq('product_id', product.id);
                if (!error && data) {
                    setSizeCharts(data);
                }
            };
            fetchSizeCharts();
        }
    }, [isOpen, product?.id]);

    useEffect(() => {
        if (bodyProfile && (sizeCharts.length > 0 || variants.length > 0)) {
            calculateSizeRecommendation();
        }
    }, [bodyProfile, sizeCharts, variants]);

    const fetchBodyProfile = async () => {
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

            if (data) {
                setBodyProfile(data);
                setGender(data.gender === 'male' ? 'male' : 'female');
                setHeightInput(data.height_cm?.toString() || '');
                setWeightInput(data.weight_kg?.toString() || '');
                setAgeInput(data.age?.toString() || '');
                
                setChestValue(Number(data.chest_cm) || 90);
                setWaistValue(isMasculino ? (Number(data.shoulder_cm) || Number(data.waist_cm) || 40) : (Number(data.waist_cm) || 70));
                setHipsValue(Number(data.hips_cm) || 95);
                setSkinColor(data.skin_color || '#E2E8F0');
                
                if (data.user_photo_url) {
                    setCustomPhotoUrl(data.user_photo_url);
                    setUseCustomPhoto(true);
                } else {
                    setCustomPhotoUrl(null);
                    setUseCustomPhoto(false);
                }
                if (data.gender === 'male') {
                    setSelectedAvatarId('male_slim');
                } else {
                    setSelectedAvatarId('female_slim');
                }
                if (!isARProduct) {
                    setStep('tryon');
                } else {
                    setStep('ar_tryon');
                }
            } else {
                setBodyProfile(null);
                setHeightInput('');
                setWeightInput('');
                setAgeInput('');
                setChestValue(90);
                setWaistValue(70);
                setHipsValue(95);
                setSkinColor('#E2E8F0');
                setCustomPhotoUrl(null);
                setUseCustomPhoto(false);
                setTryonResultUrl(null);
                setGender(isMasculino ? 'male' : 'female');
                if (!isARProduct) {
                    setStep('form');
                } else {
                    setStep('ar_tryon');
                }
            }
        } catch (err) {
            console.error('Error loading body profile for try-on:', err);
            if (!isARProduct) {
                setStep('form');
            } else {
                setStep('ar_tryon');
            }
        }
    };

    const calculateSizeRecommendation = () => {
        if (!bodyProfile) return;
        
        if (sizeCharts.length > 0) {
            const size = getRecommendedSizeFromChart(
                bodyProfile.chest_cm,
                bodyProfile.waist_cm,
                bodyProfile.hips_cm,
                sizeCharts,
                product.category || 'top',
                bodyProfile.shoulder_cm,
                isMasculino,
                variants
            );
            setRecommendedSize(size);
        } else {
            // simple fallback
            const height = Number(bodyProfile.height_cm) || 170;
            const weight = Number(bodyProfile.weight_kg) || 70;
            const gender = bodyProfile.gender || 'female';
            const chest = Number(bodyProfile.chest_cm) || 
                ((gender === 'male' || isMasculino) 
                    ? (94 + (weight - 70) * 0.6) 
                    : (96 + (weight - 70) * 0.7));
            
            const availableSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
            
            let targetSize = 'M';
            if (gender === 'male' || isMasculino) {
                if (chest < 88) targetSize = 'PP';
                else if (chest < 92) targetSize = 'P';
                else if (chest < 96) targetSize = 'M';
                else if (chest < 102) targetSize = 'G';
                else if (chest < 108) targetSize = 'GG';
                else targetSize = 'XG';
            } else {
                if (chest < 85) targetSize = 'PP';
                else if (chest < 93) targetSize = 'P';
                else if (chest < 97) targetSize = 'M';
                else if (chest < 102) targetSize = 'G';
                else if (chest < 107) targetSize = 'GG';
                else targetSize = 'XG';
            }

            const closestMatch = availableSizes.find(s => s.toUpperCase() === targetSize) || 
                                 availableSizes.find(s => s.toUpperCase() === 'M') ||
                                 availableSizes[0];
            
            setRecommendedSize(closestMatch || null);
        }
    };

    const handleCalculateRecommendation = async () => {
        const heightRaw = heightInput.replace(',', '.');
        const weightRaw = weightInput.replace(',', '.');
        
        let height = parseFloat(heightRaw);
        if (isNaN(height)) height = 0;
        else if (height < 3) height = height * 100;

        let weight = parseFloat(weightRaw);
        if (isNaN(weight)) weight = 0;

        const age = parseInt(ageInput) || 25;

        if (!height || !weight) {
            toast.error('Por favor, preencha altura e peso corretamente.');
            return;
        }

        const measurements = calculateBodyMeasurements(height, weight, age, gender);

        // Set dynamic slider states
        setChestValue(measurements.chest);
        setWaistValue(isMasculino ? measurements.shoulder : measurements.waist);
        setHipsValue(measurements.hips);

        // Pre-fill body profile locally
        const profileData = {
            gender,
            height_cm: height,
            weight_kg: weight,
            age,
            chest_cm: measurements.chest,
            waist_cm: measurements.waist,
            hips_cm: measurements.hips,
            shoulder_cm: measurements.shoulder,
            profile_name: 'Perfil Rápido',
            is_default: true
        };
        setBodyProfile(profileData);

        setStep('adjust_body');
    };

    const handleSaveAdjustedBody = async () => {
        const heightRaw = heightInput.replace(',', '.');
        const weightRaw = weightInput.replace(',', '.');

        let height = parseFloat(heightRaw);
        if (isNaN(height) || height <= 0) height = 170;
        else if (height < 3) height = height * 100;

        let weight = parseFloat(weightRaw);
        if (isNaN(weight) || weight <= 0) weight = 70;

        const age = parseInt(ageInput) || 25;

        const measurements = calculateBodyMeasurements(height, weight, age, gender);

        const profileData = {
            gender,
            height_cm: height,
            weight_kg: weight,
            age,
            chest_cm: chestValue,
            waist_cm: isMasculino ? (bodyProfile?.waist_cm || measurements.waist) : waistValue,
            hips_cm: isMasculino ? (bodyProfile?.hips_cm || measurements.hips) : hipsValue,
            shoulder_cm: isMasculino ? waistValue : (bodyProfile?.shoulder_cm || measurements.shoulder),
            profile_name: 'Perfil Rápido',
            is_default: true
        };

        const localProfileData = {
            ...profileData,
            skin_color: skinColor
        };

        setBodyProfile(localProfileData);

        if (user) {
            try {
                const { data: existing, error: findError } = await supabase
                    .from('user_body_profiles')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('is_default', true)
                    .order('updated_at', { ascending: false })
                    .limit(1);
                
                if (findError) throw findError;

                if (existing && existing.length > 0) {
                    const { error: updateError } = await supabase
                        .from('user_body_profiles')
                        .update(profileData)
                        .eq('id', existing[0].id);
                    if (updateError) throw updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from('user_body_profiles')
                        .insert([{ ...profileData, user_id: user.id }]);
                    if (insertError) throw insertError;
                }
            } catch (err: any) {
                console.error('Error saving body profile to DB:', err);
                toast.error('Erro ao sincronizar com o banco: ' + (err.message || err));
            }
        }

        localStorage.setItem('urbano_body_profile', JSON.stringify(localProfileData));

        if (gender === 'male') {
            setSelectedAvatarId(weight > 80 ? 'male_athletic' : 'male_slim');
        } else {
            setSelectedAvatarId(weight > 65 ? 'female_curvy' : 'female_slim');
        }

        setStep('tryon');
        setIsCalculatingFit(true);
        setTimeout(() => {
            setIsCalculatingFit(false);
        }, 2000);
        toast.success('Perfil corporal configurado e salvo com sucesso!');
    };

    const isSizeOptionDisabled = (size: string) => {
        const sizeVariants = variants.filter(v => v.size === size);
        return sizeVariants.every(v => (v.stock_quantity ?? 0) <= 0);
    };

    const isColorOptionDisabled = (color: string) => {
        const colorVariants = variants.filter(v => v.color === color);
        return colorVariants.every(v => (v.stock_quantity ?? 0) <= 0);
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!user) {
            toast.error('Faça login para salvar fotos de provador.');
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `profiles/${user.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

            // Save public URL to user's default body profile
            if (bodyProfile?.id) {
                const { error: updateError } = await supabase
                    .from('user_body_profiles')
                    .update({ user_photo_url: publicUrl })
                    .eq('id', bodyProfile.id);

                if (updateError) throw updateError;
            } else {
                // If profile doesn't exist, create a default one
                const { error: insertError } = await supabase
                    .from('user_body_profiles')
                    .insert([{
                        user_id: user.id,
                        profile_name: 'Meu Perfil Padrão',
                        gender: 'female',
                        height_cm: 165,
                        weight_kg: 60,
                        user_photo_url: publicUrl,
                        is_default: true
                    }]);

                if (insertError) throw insertError;
                await fetchBodyProfile();
            }

            setCustomPhotoUrl(publicUrl);
            setUseCustomPhoto(true);
            toast.success('Sua foto foi enviada com sucesso!');
        } catch (err: any) {
            console.error('Photo upload error:', err);
            toast.error(err.message || 'Erro ao enviar foto.');
        } finally {
            setIsUploading(false);
        }
    };

    const getBase64FromRelativeUrl = async (url: string): Promise<string> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleStartTryOn = async (targetVariantIds?: string[]) => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        setIsGenerating(true);
        setTryonResultUrl(null);
        setGenerationProgress(0);
        setStatusMessage('Iniciando motor de provador IA...');
        trackEvent('vton_render_started', { product_id: product?.id, variant_id: activeVariant?.id });

        try {
            // Setup parameters
            let personImage = useCustomPhoto ? customPhotoUrl : DEFAULT_AVATARS.find(a => a.id === selectedAvatarId)?.url;
            if (personImage && personImage.startsWith('/')) {
                try {
                    personImage = await getBase64FromRelativeUrl(personImage);
                } catch (e) {
                    console.error("Failed to convert relative avatar to base64:", e);
                }
            }
            const garmentImage = activeVariant?.variant_image_url || product.images?.[0];
            
            if (!personImage || !garmentImage) {
                throw new Error('Impossível prosseguir sem imagens de entrada.');
            }

            const tenantId = product?.tenant_id || profile?.tenant_id || ORGANIZATION_ID;

            const isMulti = targetVariantIds && targetVariantIds.length > 1;
            const payload = isMulti ? {
                tenant_id: tenantId,
                variant_ids: targetVariantIds,
                user_profile: {
                    height: bodyProfile ? Number(bodyProfile.height_cm) : 170,
                    weight: bodyProfile ? Number(bodyProfile.weight_kg) : 70,
                    age: bodyProfile?.age ? Number(bodyProfile.age) : 25,
                    body_type: bodyProfile?.body_type || (bodyProfile?.gender === 'male' ? 'slim' : 'medium'),
                    fit_preference: bodyProfile?.fit_preference || 'normal',
                    photo_url: personImage
                }
            } : {
                tenant_id: tenantId,
                variant_id: activeVariant?.id,
                garment_image_url: garmentImage,
                category: product.category?.toLowerCase() || 'top',
                color: activeVariant?.color || '',
                size: activeVariant?.size || '',
                user_profile: {
                    height: bodyProfile ? Number(bodyProfile.height_cm) : 170,
                    weight: bodyProfile ? Number(bodyProfile.weight_kg) : 70,
                    age: bodyProfile?.age ? Number(bodyProfile.age) : 25,
                    body_type: bodyProfile?.body_type || (bodyProfile?.gender === 'male' ? 'slim' : 'medium'),
                    fit_preference: bodyProfile?.fit_preference || 'normal',
                    photo_url: personImage
                }
            };

            // 1. Envia requisição para a Edge Function
            const { data, error } = await supabase.functions.invoke('generate-tryon/render', {
                body: payload
            });

            if (error || !data) {
                throw new Error(error?.message || 'Erro na comunicação com o servidor de IA.');
            }

            // Caso C: Bloqueio por excesso de cota
            if (data.status === 'blocked') {
                setIsGenerating(false);
                setStatusMessage('Bloqueado: Limite atingido.');
                toast.error(data.message || 'Cota mensal de provadores IA esgotada para esta loja. Faça upgrade do plano.');
                trackEvent('vton_render_blocked', { product_id: product?.id, variant_id: activeVariant?.id, reason: data.reason });
                return;
            }

            // Caso A: Cache Hit (Sincronizado/Instantâneo)
            if (data.status === 'completed' && data.generated_url) {
                setGenerationProgress(100);
                setStatusMessage('Geração recuperada do cache instantaneamente!');
                setTryonResultUrl(data.generated_url);
                setViewMode('photo');
                toast.success('Peça aplicada (via cache)!');
                setIsGenerating(false);
                trackEvent('vton_render_completed', { product_id: product?.id, variant_id: activeVariant?.id, cache_hit: true });
                return;
            }

            // Caso B: Cache Miss (Assíncrono, inicia Polling)
            if ((data.status === 'processing' || data.status === 'pending') && data.job_id) {
                const jobId = data.job_id;
                let currentProgress = 0;

                if (data.status === 'pending') {
                    setStatusMessage(`Na fila de espera (posição ${data.queue_position || 1})...`);
                } else {
                    setStatusMessage('Solicitação na fila do provador IA...');
                }

                intervalRef.current = setInterval(async () => {
                    try {
                        const { data: pollData, error: pollError } = await supabase.functions.invoke(`generate-tryon/status/${jobId}`, {
                            method: 'GET'
                        });

                        if (pollError || !pollData) {
                            console.error('Erro de polling VTON:', pollError);
                            return;
                        }

                        if (pollData.status === 'completed' && pollData.generated_url) {
                            if (intervalRef.current) clearInterval(intervalRef.current);
                            setGenerationProgress(100);
                            setStatusMessage('Provador concluído!');
                            setTryonResultUrl(pollData.generated_url);
                            setViewMode('photo');
                            toast.success('Peça aplicada com sucesso!');
                            setIsGenerating(false);
                            trackEvent('vton_render_completed', { product_id: product?.id, variant_id: activeVariant?.id, cache_hit: false });
                        } else if (pollData.status === 'failed') {
                            if (intervalRef.current) clearInterval(intervalRef.current);
                            trackEvent('vton_render_failed', { product_id: product?.id, variant_id: activeVariant?.id, error: pollData.error });
                            throw new Error(pollData.error || 'A geração no Replicate falhou.');
                        } else if (pollData.status === 'pending') {
                            setStatusMessage(`Na fila de espera (posição ${pollData.queue_position || 1})...`);
                            setGenerationProgress(0);
                        } else {
                            // Incrementa progresso de forma realista
                            currentProgress = Math.min(currentProgress + Math.floor(Math.random() * 8) + 3, 98);
                            if (pollData.progress !== undefined) {
                                currentProgress = Math.max(currentProgress, pollData.progress);
                            }
                            setGenerationProgress(currentProgress);
                            
                            if (pollData.message) {
                                setStatusMessage(pollData.message);
                            } else {
                                if (currentProgress < 20) setStatusMessage('Processando silhueta do corpo...');
                                else if (currentProgress < 50) setStatusMessage('Aplicando caimento e dobra do tecido...');
                                else if (currentProgress < 85) setStatusMessage('Ajustando iluminação e sombras...');
                                else setStatusMessage('Finalizando texturas de alta definição...');
                            }
                        }
                    } catch (err: any) {
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        console.error('Erro durante polling:', err);
                        toast.error(err.message || 'Erro no provador.');
                        // Fallback
                        setStatusMessage('Provador concluído (modo simulação)!');
                        setTryonResultUrl(garmentImage);
                        setViewMode('photo');
                        setIsGenerating(false);
                        trackEvent('vton_render_failed', { product_id: product?.id, variant_id: activeVariant?.id, error: err.message, fallback: true });
                    }
                }, 1800);
            }
        } catch (err: any) {
            console.error('Try-on error:', err);
            toast.error(err.message || 'Erro ao iniciar o provador virtual.');
            // Fallback imediato
            setStatusMessage('Provador concluído (modo de visualização)!');
            setTryonResultUrl(activeVariant?.variant_image_url || product.images?.[0]);
            setViewMode('photo');
            setIsGenerating(false);
            trackEvent('vton_render_failed', { product_id: product?.id, variant_id: activeVariant?.id, error: err.message, fallback: true });
        }
    };

    const handleAddToBag = () => {
        if (!product || !activeVariant) return;
        
        const productToCart = {
            ...product,
            price: product.price + (Number(activeVariant.additional_price) || 0),
            stock_quantity: activeVariant.stock_quantity ?? 0
        };

        addToCart(productToCart, {
            sizes: activeVariant.size,
            colors: activeVariant.color,
            variant_id: activeVariant.id
        });
        toast.success('Peça do provador adicionada ao carrinho!');
    };

    if (!isOpen) return null;

    const currentModelPhoto = useCustomPhoto 
        ? (customPhotoUrl || 'https://placehold.co/400x500?text=Sua+Foto')
        : (DEFAULT_AVATARS.find(a => a.id === selectedAvatarId)?.url || '');

    const sizesList = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
    const colorsList = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            {/* Desktop Modal / Mobile Bottom Sheet Wrapper */}
            <div className="w-full lg:max-w-5xl h-full lg:h-[90vh] bg-white rounded-t-[2.5rem] lg:rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl transition-all duration-500 lg:mr-8 transform translate-y-0 relative">
                
                {/* Header */}
                <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FBC02D]/10 rounded-xl flex items-center justify-center text-[#0B1221]">
                            <Cpu className="w-5 h-5 text-[#0B1221]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[#0B1221] mt-0.5">Provador Virtual Inteligente</h3>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="w-10 h-10 bg-slate-50 hover:bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Layout */}
                {step === 'ar_tryon' && (
                    <div className="flex-grow flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden h-full">
                        {/* Left: Camera Feed & Canvas */}
                        <div className="w-full lg:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-r border-slate-100 lg:h-full shrink-0 relative overflow-hidden">
                            <div className="relative w-full max-w-[400px] aspect-[3/4] bg-black rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden flex items-center justify-center">
                                <video
                                    ref={videoRef}
                                    playsInline
                                    muted
                                    className="hidden"
                                    width={640}
                                    height={480}
                                />
                                <canvas
                                    ref={canvasRef}
                                    className="w-full h-full object-cover transform scale-x-[-1]"
                                    width={640}
                                    height={480}
                                />
                                {arLoading && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                        <Loader2 className="w-8 h-8 text-[#0B1221] animate-spin mb-3" />
                                        <p className="text-xs font-black text-slate-700 uppercase tracking-wider">Iniciando Câmera AR...</p>
                                        <p className="text-[10px] text-slate-400 font-bold mt-1">Carregando filtros inteligentes e rastreamento facial...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Product details and action buttons */}
                        <div className="w-full lg:w-1/2 p-8 md:p-10 flex flex-col justify-between overflow-y-auto lg:h-full">
                            <div className="space-y-6 my-auto">
                                <div className="flex items-center gap-2">
                                    <span className="bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">Custo Zero AR</span>
                                    <span className="bg-[#FBC02D]/10 text-[#0B1221] text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">Tempo Real</span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-[#0B1221] mt-1">{product.name}</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-1">Aproveite nosso espelho virtual para testar a peça. Posicione seu rosto em frente à câmera.</p>
                                </div>

                                {/* Variant Selection */}
                                <div className="space-y-4">
                                    {colorsList.length > 0 && (
                                        <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Cores disponíveis:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {colorsList.map(c => {
                                                    const isSelected = activeVariant?.color === c;
                                                    const isDisabled = isColorOptionDisabled(c);
                                                    return (
                                                        <button
                                                            key={c}
                                                            disabled={isDisabled}
                                                            onClick={() => {
                                                                onVariantChange(activeVariant?.size || '', c, 'color');
                                                            }}
                                                            className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                                                                isSelected
                                                                ? 'bg-[#0B1221] border-[#0B1221] text-white shadow-sm'
                                                                : isDisabled
                                                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50 line-through'
                                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                            }`}
                                                        >
                                                            {c}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {sizesList.length > 0 && (
                                        <div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Tamanhos:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {sizesList.map(s => {
                                                    const isSelected = activeVariant?.size === s;
                                                    const isDisabled = isSizeOptionDisabled(s);
                                                    return (
                                                        <button
                                                            key={s}
                                                            disabled={isDisabled}
                                                            onClick={() => {
                                                                onVariantChange(s, activeVariant?.color || '', 'size');
                                                            }}
                                                            className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all ${
                                                                isSelected
                                                                ? 'bg-[#0B1221] border-[#0B1221] text-white shadow-sm'
                                                                : isDisabled
                                                                ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50 line-through'
                                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                            }`}
                                                        >
                                                            {s}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Purchase & Action Buttons */}
                            <div className="space-y-4 pt-6 border-t border-slate-100">
                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all text-center"
                                    >
                                        Fechar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddToBag}
                                        disabled={!activeVariant || (activeVariant.stock_quantity ?? 0) <= 0}
                                        className="flex-grow bg-[#FBC02D] hover:bg-[#f9b100] text-[#0B1221] py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#FBC02D]/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                                    >
                                        <ShoppingCart className="w-4 h-4" />
                                        {(!activeVariant || (activeVariant.stock_quantity ?? 0) <= 0) ? 'ESGOTADO' : 'ADICIONAR À BAG'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content Layout */}
                {step === 'form' && (
                    <div className="flex-grow flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden h-full">
                        {/* Left: Product Image */}
                        <div className="w-full lg:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-r border-slate-100 lg:h-full shrink-0">
                            <div className="w-full max-w-[280px] aspect-[3/4] bg-white rounded-[2rem] border border-slate-100 shadow-md overflow-hidden p-2">
                                <img 
                                    src={product.images?.[0] || 'https://placehold.co/400x500?text=Produto'} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover rounded-2xl"
                                />
                            </div>
                        </div>

                        {/* Right: Form panel */}
                        <div className="w-full lg:w-1/2 p-8 md:p-10 flex flex-col justify-between overflow-y-auto lg:h-full">
                            <div className="space-y-6 my-auto">
                                <div>
                                    <h3 className="text-2xl font-black text-[#0B1221] mt-1">Provador Virtual</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-1">Insira seus dados para descobrir o tamanho ideal baseado na modelagem técnica da peça.</p>
                                </div>

                                <div className="space-y-5">
                                    {/* Altura, Peso, Idade */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Suas medidas básicas</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 pl-1">Altura</span>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        placeholder="Ex: 170"
                                                        value={heightInput}
                                                        onChange={(e) => setHeightInput(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 font-bold text-xs text-[#05080F] outline-none focus:border-[#FBC02D] transition-all pr-8"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">cm</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 pl-1">Peso</span>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        placeholder="Ex: 70"
                                                        value={weightInput}
                                                        onChange={(e) => setWeightInput(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 font-bold text-xs text-[#05080F] outline-none focus:border-[#FBC02D] transition-all pr-8"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">kg</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <span className="text-[9px] font-bold text-slate-400 pl-1">Idade</span>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        placeholder="Ex: 25"
                                                        value={ageInput}
                                                        onChange={(e) => setAgeInput(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 px-4 font-bold text-xs text-[#05080F] outline-none focus:border-[#FBC02D] transition-all pr-8"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">anos</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6">
                                <button
                                    type="button"
                                    onClick={handleCalculateRecommendation}
                                    className="w-full bg-[#0B1221] hover:bg-[#1a2436] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    PRÓXIMO
                                </button>
                                <div className="flex justify-center gap-1.5 pb-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#0B1221]"></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer" onClick={() => {
                                        if (bodyProfile) setStep('adjust_body');
                                    }}></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer" onClick={() => {
                                        if (bodyProfile) setStep('tryon');
                                    }}></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'adjust_body' && (
                    <div className="flex-grow flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden h-full">
                        {/* Left: Mannequin Silhouette */}
                        <div className="w-full lg:w-1/2 bg-slate-50 p-8 flex items-center justify-center border-r border-slate-100 lg:h-full shrink-0 relative overflow-hidden">
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img 
                                    src={silhouetteSrc} 
                                    alt="Silhueta do Manequim" 
                                    className="h-full w-auto object-contain pointer-events-none select-none"
                                />
                            </div>
                        </div>

                        {/* Right: Adjust sliders and buttons */}
                        <div className="w-full lg:w-1/2 p-8 md:p-10 flex flex-col justify-between overflow-y-auto lg:h-full">
                            <div className="space-y-6 my-auto">
                                <div>
                                    <h3 className="text-2xl font-black text-[#0B1221] mt-1">Ajuste o formato do corpo</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-1">Este é o formato aproximado do corpo que geramos com suas medidas. Ajuste somente se for necessário.</p>
                                </div>

                                {/* Sliders Container */}
                                <div className="space-y-6">
                                    {/* Tórax Slider */}
                                    <div className="space-y-2">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest block text-center">Tórax</span>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setChestValue(prev => Math.max(50, Math.round((prev - 1) * 10) / 10))}
                                                className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors text-slate-700 select-none"
                                            >
                                                −
                                            </button>
                                            <div className="flex-grow flex flex-col items-center">
                                                <input
                                                    type="range"
                                                    min="50"
                                                    max="150"
                                                    step="0.1"
                                                    value={chestValue}
                                                    onChange={(e) => setChestValue(Number(parseFloat(e.target.value) || 0))}
                                                    className="w-full accent-[#0B1221] h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <div className="flex items-center gap-1 mt-2 text-sm font-black text-[#0B1221]">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={chestValue === 0 ? '' : Math.round(chestValue * 10) / 10}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setChestValue(isNaN(val) ? 0 : val);
                                                        }}
                                                        className="w-20 text-center bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-[#FBC02D] rounded-lg py-1 px-2 font-black text-xs outline-none transition-all"
                                                    />
                                                    <span className="text-xs text-slate-400 font-bold">cm</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setChestValue(prev => Math.min(150, Math.round((prev + 1) * 10) / 10))}
                                                className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors text-slate-700 select-none"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {/* Cintura/Ombros Slider */}
                                    <div className="space-y-2">
                                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest block text-center">
                                            {isMasculino ? 'Ombros' : 'Cintura'}
                                        </span>
                                        <div className="flex items-center gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setWaistValue(prev => Math.max(isMasculino ? 30 : 40, Math.round((prev - 1) * 10) / 10))}
                                                className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors text-slate-700 select-none"
                                            >
                                                −
                                            </button>
                                            <div className="flex-grow flex flex-col items-center">
                                                <input
                                                    type="range"
                                                    min={isMasculino ? "30" : "40"}
                                                    max={isMasculino ? "70" : "140"}
                                                    step="0.1"
                                                    value={waistValue}
                                                    onChange={(e) => setWaistValue(Number(parseFloat(e.target.value) || 0))}
                                                    className="w-full accent-[#0B1221] h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <div className="flex items-center gap-1 mt-2 text-sm font-black text-[#0B1221]">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={waistValue === 0 ? '' : Math.round(waistValue * 10) / 10}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value);
                                                            setWaistValue(isNaN(val) ? 0 : val);
                                                        }}
                                                        className="w-20 text-center bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-[#FBC02D] rounded-lg py-1 px-2 font-black text-xs outline-none transition-all"
                                                    />
                                                    <span className="text-xs text-slate-400 font-bold">cm</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setWaistValue(prev => Math.min(isMasculino ? 70 : 140, Math.round((prev + 1) * 10) / 10))}
                                                className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors text-slate-700 select-none"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>

                                    {/* Quadril Slider */}
                                    {!isMasculino && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-black text-slate-600 uppercase tracking-widest block text-center">Quadril</span>
                                            <div className="flex items-center gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setHipsValue(prev => Math.max(50, Math.round((prev - 1) * 10) / 10))}
                                                    className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors text-slate-700 select-none"
                                                >
                                                    −
                                                </button>
                                                <div className="flex-grow flex flex-col items-center">
                                                    <input
                                                        type="range"
                                                        min="50"
                                                        max="160"
                                                        step="0.1"
                                                        value={hipsValue}
                                                        onChange={(e) => setHipsValue(Number(parseFloat(e.target.value) || 0))}
                                                        className="w-full accent-[#0B1221] h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                                    />
                                                    <div className="flex items-center gap-1 mt-2 text-sm font-black text-[#0B1221]">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            value={hipsValue === 0 ? '' : Math.round(hipsValue * 10) / 10}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setHipsValue(isNaN(val) ? 0 : val);
                                                            }}
                                                            className="w-20 text-center bg-slate-50 border border-slate-100 hover:border-slate-200 focus:border-[#FBC02D] rounded-lg py-1 px-2 font-black text-xs outline-none transition-all"
                                                        />
                                                        <span className="text-xs text-slate-400 font-bold">cm</span>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setHipsValue(prev => Math.min(160, Math.round((prev + 1) * 10) / 10))}
                                                    className="w-10 h-10 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm transition-colors text-slate-700 select-none"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Buttons */}
                            <div className="space-y-4 pt-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep('form')}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                    >
                                        VOLTAR
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSaveAdjustedBody}
                                        className="w-full bg-[#0B1221] hover:bg-[#1a2436] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md"
                                    >
                                        PRÓXIMO
                                    </button>
                                </div>
                                <div className="flex justify-center gap-1.5 pb-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer" onClick={() => setStep('form')}></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#0B1221]"></span>
                                    <span className="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer" onClick={() => {
                                        if (bodyProfile) setStep('tryon');
                                    }}></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'tryon' && (
                    isCalculatingFit ? (
                        <div className="flex-grow flex flex-col items-center justify-center bg-white p-8 text-center h-full min-h-[400px] my-auto">
                            <div className="relative w-20 h-20 mb-6">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                                <div className="absolute inset-0 rounded-full border-4 border-t-[#0B1221] animate-spin" />
                            </div>
                            <Sparkles className="w-6 h-6 text-[#FBC02D] animate-bounce mb-3" />
                            <h4 className="text-lg font-black text-[#0B1221] uppercase tracking-wider">Quase lá...</h4>
                            <p className="text-xs text-slate-400 font-bold mt-1">Calculando o caimento ideal no seu formato de corpo...</p>
                        </div>
                    ) : (() => {
                        const selectedSize = localSelectedSize || activeVariant?.size || recommendedSize || 'M';
                        const resolvedChart = getResolvedChart(selectedSize, product.category || 'top', sizeCharts, isMasculino);
                        
                        const userChest = bodyProfile?.chest_cm || chestValue || 90;
                        const userWaist = isMasculino 
                            ? (bodyProfile?.shoulder_cm || waistValue || 40)
                            : (bodyProfile?.waist_cm || waistValue || 70);
                        const userHips = bodyProfile?.hips_cm || hipsValue || 95;

                        const chestFeedback = getFitFeedback(userChest, resolvedChart.max_chest_cm, 'chest', product.category || 'top', isMasculino);
                        const waistFeedback = getFitFeedback(userWaist, resolvedChart.max_waist_cm, 'waist', product.category || 'top', isMasculino);
                        const overallStatus = getOverallFitStatus(chestFeedback.cleanLabel, waistFeedback.cleanLabel, product.category || 'top', isMasculino);

                        const chestRatio = userChest > 0 ? resolvedChart.max_chest_cm / userChest : 1;
                        const waistRatio = userWaist > 0 ? resolvedChart.max_waist_cm / userWaist : 1;
                        const chestScale = Math.min(1.25, Math.max(0.85, chestRatio));
                        const waistScale = Math.min(1.25, Math.max(0.85, waistRatio));

                        return (
                            <div className="flex-grow flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden h-full">
                                {/* Left Column: Product Image */}
                                <div className="w-full lg:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-r border-slate-100 lg:h-full shrink-0">
                                    <div className="w-full max-w-[280px] aspect-[3/4] bg-white rounded-[2rem] border border-slate-100 shadow-md overflow-hidden p-2">
                                        <img 
                                            src={product.images?.[0] || 'https://placehold.co/400x500?text=Produto'} 
                                            alt={product.name} 
                                            className="w-full h-full object-cover rounded-2xl"
                                        />
                                    </div>
                                    <div className="mt-4 text-center flex flex-col items-center">
                                        <h4 className="text-sm font-black text-[#0B1221]">{product.name}</h4>
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                                            R$ {(activeVariant ? product.price + (Number(activeVariant.additional_price) || 0) : product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                        
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!user) {
                                                    toast.error('Por favor, faça login para ver como fica em você.', {
                                                        style: {
                                                            background: '#0B1221',
                                                            color: '#fff',
                                                            fontWeight: 'bold',
                                                            borderRadius: '1rem',
                                                        }
                                                    });
                                                    setTimeout(() => {
                                                        onClose();
                                                        navigate('/login', { state: { from: `/p/${product.id}` } });
                                                    }, 1500);
                                                    return;
                                                }
                                                setStep('select_avatar_photo');
                                            }}
                                            className="mt-4 bg-[#0B1221] hover:bg-[#1a2436] text-white py-3 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                        >
                                            <Sparkles className="w-4 h-4 text-[#FBC02D]" />
                                            Veja como fica em você
                                        </button>
                                    </div>
                                </div>

                                {/* Right Column: Mannequin + Suggestion */}
                                <div className="w-full lg:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto lg:h-full">
                                    
                                    <div className="flex-grow flex flex-col lg:flex-row items-center justify-center gap-6 relative min-h-[400px]">
                                        
                                        {/* Left part of right column: Huge 3D Mannequin with suggestions button */}
                                        <div className="w-full lg:w-3/5 flex flex-col gap-3 shrink-0">
                                            <div className="h-[350px] w-full flex items-center justify-center relative overflow-hidden bg-slate-50/50 rounded-3xl border border-slate-100">
                                                {viewMode === 'photo' && tryonResultUrl && !isGenerating ? (
                                                    <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                                        <img 
                                                            src={tryonResultUrl} 
                                                            alt="Provador IA Resultado" 
                                                            className="w-full h-full object-contain rounded-2xl animate-in fade-in zoom-in-95 duration-500"
                                                        />
                                                    </div>
                                                ) : (
                                                    <>
                                                        <img 
                                                            src={silhouetteSrc} 
                                                            alt="Silhueta do Manequim" 
                                                            className="h-full w-auto object-contain pointer-events-none select-none"
                                                        />

                                                        {/* Caimento Ring Indicators */}
                                                        <div 
                                                            className="absolute top-[23%] left-[37%] right-[37%] h-5 border-t-2 border-b-2 rounded-[50%] pointer-events-none opacity-90 transition-all duration-300"
                                                            style={{ 
                                                                borderColor: chestFeedback.color, 
                                                                backgroundColor: `${chestFeedback.color}15`,
                                                                transform: `scaleX(${chestScale * (isHeavy ? 1.56 : 1.0)})`
                                                            }}
                                                        />
                                                        <div 
                                                            className="absolute left-[38%] right-[38%] h-5 border-t-2 border-b-2 rounded-[50%] pointer-events-none opacity-90 transition-all duration-300"
                                                            style={{ 
                                                                top: isMasculino ? '15%' : '41%',
                                                                borderColor: waistFeedback.color, 
                                                                backgroundColor: `${waistFeedback.color}15`,
                                                                transform: `scaleX(${waistScale * (isHeavy ? 1.56 : 1.0)})`
                                                            }}
                                                        />

                                                        {/* Chest Label */}
                                                        <div 
                                                            className="absolute flex items-center gap-2 bg-white/95 backdrop-blur-sm py-1.5 px-3 rounded-2xl border border-slate-100 shadow-md transition-all duration-300 pointer-events-none"
                                                            style={{ top: isMasculino ? '26%' : '20%', right: '16px' }}
                                                        >
                                                            <div 
                                                                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm" 
                                                                style={{ backgroundColor: chestFeedback.color }}
                                                            >
                                                                {getFitIcon(chestFeedback.cleanLabel)}
                                                            </div>
                                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                                                                {isMasculino ? `Tórax: ${chestFeedback.label}` : chestFeedback.label}
                                                            </span>
                                                        </div>

                                                        {/* Waist Label */}
                                                        <div 
                                                            className="absolute flex items-center gap-2 bg-white/95 backdrop-blur-sm py-1.5 px-3 rounded-2xl border border-slate-100 shadow-md transition-all duration-300 pointer-events-none"
                                                            style={{ top: isMasculino ? '10%' : '38%', left: '16px' }}
                                                        >
                                                            <div 
                                                                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm" 
                                                                style={{ backgroundColor: waistFeedback.color }}
                                                            >
                                                                {getFitIcon(waistFeedback.cleanLabel)}
                                                            </div>
                                                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{isMasculino ? 'Ombros: ' : ''}{waistFeedback.label}</span>
                                                        </div>
                                                    </>
                                                )}

                                                {/* viewMode toggle overlay */}
                                                {tryonResultUrl && !isGenerating && (
                                                    <div className="absolute top-3 right-3 z-10 flex gap-1 bg-white/95 backdrop-blur-sm p-1 rounded-xl shadow-md border border-slate-100">
                                                        <button
                                                            onClick={() => setViewMode('mannequin')}
                                                            className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                                                viewMode === 'mannequin'
                                                                ? 'bg-[#0B1221] text-white shadow-sm'
                                                                : 'bg-transparent text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            Manequim
                                                        </button>
                                                        <button
                                                            onClick={() => setViewMode('photo')}
                                                            className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                                                                viewMode === 'photo'
                                                                ? 'bg-[#0B1221] text-white shadow-sm'
                                                                : 'bg-transparent text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                        >
                                                            Foto IA
                                                        </button>
                                                    </div>
                                                )}

                                                {/* isGenerating progress indicator overlay */}
                                                {isGenerating && (
                                                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20">
                                                        <div className="relative w-16 h-16 mb-4">
                                                            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                                                            <div className="absolute inset-0 rounded-full border-4 border-t-[#0B1221] animate-spin" />
                                                        </div>
                                                        <Sparkles className="w-5 h-5 text-[#FBC02D] animate-bounce mb-2" />
                                                        <h5 className="text-sm font-black text-[#0B1221] uppercase tracking-wider">Provador IA Ativo</h5>
                                                        <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-[200px] leading-relaxed">{statusMessage}</p>
                                                        <div className="w-32 bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                                            <div 
                                                                className="bg-[#FBC02D] h-full transition-all duration-300" 
                                                                style={{ width: `${generationProgress}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-black text-[#0B1221] mt-1">{generationProgress}%</span>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <button
                                                type="button"
                                                onClick={() => setStep('outfit_suggestions')}
                                                className="w-full bg-slate-50 hover:bg-slate-100 text-[#0B1221] border border-slate-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                                            >
                                                <Sparkles className="w-4 h-4 text-[#FBC02D]" />
                                                Sugestões de Combinações
                                            </button>
                                        </div>

                                        {/* Right part of right column: Suggestion info */}
                                        <div className="w-full lg:w-2/5 flex flex-col gap-4">
                                            
                                            {/* Best Option Card */}
                                            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm text-center relative flex flex-col items-center justify-center">
                                                <span 
                                                    className="text-[10px] font-black uppercase tracking-widest block"
                                                    style={{ color: overallStatus.color }}
                                                >
                                                    {overallStatus.label}
                                                </span>
                                                
                                                <div className="relative inline-flex items-center justify-center my-3">
                                                    <div 
                                                        className="text-5xl font-black tracking-tight bg-slate-50 w-20 h-20 rounded-2xl border flex items-center justify-center"
                                                        style={{ 
                                                            color: '#0B1221',
                                                            borderColor: overallStatus.color
                                                        }}
                                                    >
                                                        {selectedSize}
                                                    </div>
                                                    <div 
                                                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm"
                                                        style={{ backgroundColor: overallStatus.color }}
                                                    >
                                                        {overallStatus.icon === 'x' ? (
                                                            <X className="w-3.5 h-3.5 stroke-[3]" />
                                                        ) : (
                                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                        )}
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={() => setStep('adjust_body')}
                                                    className="w-full bg-slate-50 hover:bg-slate-100 text-[#0B1221] border border-slate-200 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all mt-1"
                                                >
                                                    Editar Medidas
                                                </button>
                                            </div>

                                            {/* Sizes List */}
                                            <div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block text-center lg:text-left">Prove também os tamanhos:</span>
                                                <div className="flex flex-wrap gap-2.5 justify-center lg:justify-start">
                                                    {sizesList.map(s => {
                                                        const isSelected = selectedSize.toUpperCase() === s.toUpperCase();
                                                        const isDisabled = isSizeOptionDisabled(s);
                                                        
                                                        // Calculate recommendation status for this size option
                                                        const optChart = getResolvedChart(s, product.category || 'top', sizeCharts, isMasculino);
                                                        const optChestFeedback = getFitFeedback(userChest, optChart.max_chest_cm, 'chest', product.category || 'top', isMasculino);
                                                        const optWaistFeedback = getFitFeedback(userWaist, optChart.max_waist_cm, 'waist', product.category || 'top', isMasculino);
                                                        const optStatus = getOverallFitStatus(optChestFeedback.cleanLabel, optWaistFeedback.cleanLabel, product.category || 'top', isMasculino);
                                                        
                                                        return (
                                                            <button
                                                                key={s}
                                                                disabled={isDisabled}
                                                                onClick={() => {
                                                                    setIsManualSelection(true);
                                                                    setLocalSelectedSize(s);
                                                                    setViewMode('mannequin');
                                                                    onVariantChange(s, activeVariant?.color || '', 'size');
                                                                }}
                                                                className={`px-3 py-2 rounded-xl text-xs font-black border-2 transition-all relative ${
                                                                    isSelected
                                                                    ? 'bg-[#0B1221] border-[#0B1221] text-white shadow-md'
                                                                    : isDisabled
                                                                    ? 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed opacity-50 line-through'
                                                                    : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                                }`}
                                                            >
                                                                {s}
                                                                {!isDisabled && (
                                                                    <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white scale-75 border border-white shadow-sm ${
                                                                        optStatus.icon === 'x' 
                                                                        ? 'bg-red-500' 
                                                                        : optStatus.icon === 'check-yellow' 
                                                                        ? 'bg-amber-500' 
                                                                        : 'bg-emerald-500'
                                                                    }`}>
                                                                        {optStatus.icon === 'x' ? (
                                                                            <X className="w-2.5 h-2.5 stroke-[3]" />
                                                                        ) : (
                                                                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                        </div>
                                    </div>

                                    {/* Purchase Buttons */}
                                    <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4 shrink-0">
                                        <button
                                            onClick={onClose}
                                            className="w-full sm:w-auto font-black py-4 px-6 rounded-2xl border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-xs uppercase tracking-widest text-center"
                                        >
                                            Voltar para o Produto
                                        </button>
                                        <button
                                            onClick={handleAddToBag}
                                            disabled={!activeVariant || (activeVariant.stock_quantity ?? 0) <= 0}
                                            className="flex-grow bg-[#FBC02D] hover:bg-[#f9b100] text-[#0B1221] py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#FBC02D]/10 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                            {(!activeVariant || (activeVariant.stock_quantity ?? 0) <= 0) ? 'ESGOTADO NO PROVADOR' : 'ADICIONAR À BAG'}
                                        </button>
                                    </div>

                                    {/* Bottom dots */}
                                    <div className="flex justify-center gap-1.5 pt-4 shrink-0">
                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer" onClick={() => setStep('form')}></span>
                                        <span className="w-2.5 h-2.5 rounded-full bg-slate-200 cursor-pointer" onClick={() => setStep('adjust_body')}></span>
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#0B1221]"></span>
                                    </div>

                                </div>
                            </div>
                        );
                    })())}

                {step === 'select_avatar_photo' && (
                    <div className="flex-grow flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden h-full animate-in fade-in duration-300">
                        {/* Left: Product Image */}
                        <div className="w-full lg:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-r border-slate-100 lg:h-full shrink-0">
                            <div className="w-full max-w-[280px] aspect-[3/4] bg-white rounded-[2rem] border border-slate-100 shadow-md overflow-hidden p-2">
                                <img 
                                    src={product.images?.[0] || 'https://placehold.co/400x500?text=Produto'} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover rounded-2xl"
                                />
                            </div>
                            <div className="mt-4 text-center">
                                <h4 className="text-sm font-black text-[#0B1221]">{product.name}</h4>
                                <p className="text-xs text-slate-400 font-bold mt-0.5">
                                    R$ {(activeVariant ? product.price + (Number(activeVariant.additional_price) || 0) : product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Right: Avatar/Photo selection panel */}
                        <div className="w-full lg:w-1/2 p-8 md:p-10 flex flex-col justify-between overflow-y-auto lg:h-full">
                            <div className="space-y-6 my-auto">
                                <div>
                                    <h3 className="text-2xl font-black text-[#0B1221] mt-1">Veja Como Fica em Você</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-1">Escolha um de nossos modelos padrão ou envie sua própria foto para testar com inteligência artificial.</p>
                                </div>

                                <div className="space-y-5">
                                    {/* Avatar Selection */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">1. Escolha um Modelo</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            {DEFAULT_AVATARS.map((avatar) => {
                                                const isSelected = !useCustomPhoto && selectedAvatarId === avatar.id;
                                                return (
                                                    <button
                                                        key={avatar.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedAvatarId(avatar.id);
                                                            setUseCustomPhoto(false);
                                                        }}
                                                        className={`p-3 rounded-2xl border-2 transition-all flex items-center gap-3 text-left ${
                                                            isSelected
                                                            ? 'bg-[#0B1221]/5 border-[#0B1221] text-[#0B1221]'
                                                            : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                        }`}
                                                    >
                                                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200/50">
                                                            <img src={avatar.url} alt={avatar.name} className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <p className="text-[11px] font-black leading-tight truncate">{avatar.name}</p>
                                                            <p className="text-[9px] text-slate-400 font-bold capitalize">{avatar.gender === 'male' ? 'Masculino' : 'Feminino'}</p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Custom Photo Upload */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">2. Ou envie uma foto sua</label>
                                        
                                        {customPhotoUrl ? (
                                            <div className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
                                                useCustomPhoto
                                                ? 'bg-[#0B1221]/5 border-[#0B1221] text-[#0B1221]'
                                                : 'bg-white border-slate-100 text-slate-600'
                                            }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                                                        <img src={customPhotoUrl} alt="Sua foto" className="w-full h-full object-cover" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black">Sua Foto Enviada</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => setUseCustomPhoto(true)}
                                                            className="text-[10px] text-emerald-600 font-black uppercase tracking-wider block mt-0.5"
                                                        >
                                                            {useCustomPhoto ? 'Selecionada' : 'Selecionar'}
                                                        </button>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCustomPhotoUrl(null);
                                                        setUseCustomPhoto(false);
                                                    }}
                                                    className="text-[9px] font-black uppercase tracking-wider text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100/80 px-2.5 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handlePhotoUpload}
                                                    disabled={isUploading}
                                                    className="hidden"
                                                    id="tryon-photo-upload"
                                                />
                                                <label
                                                    htmlFor="tryon-photo-upload"
                                                    className={`w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-all ${
                                                        isUploading ? 'pointer-events-none opacity-50' : ''
                                                    }`}
                                                >
                                                    {isUploading ? (
                                                        <>
                                                            <Loader2 className="w-6 h-6 text-[#0B1221] animate-spin mb-2" />
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Enviando foto...</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="w-6 h-6 text-slate-400 mb-2" />
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Clique para enviar uma foto</p>
                                                            <p className="text-[8px] text-slate-400 font-bold mt-1 text-center">Fundo neutro, boa iluminação e de corpo inteiro/meio corpo.</p>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Buttons */}
                            <div className="space-y-4 pt-6">


                                {/* Limite diário desativado temporariamente */}
                                {false && creditsBalance !== null && creditsBalance > 0 && userDailyUsage >= 3 && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-xs font-black text-amber-800">Limite diário atingido</h4>
                                            <p className="text-[10px] text-amber-600 font-bold mt-0.5">Você já utilizou sua cota de 3 provadores gerados hoje. Seu limite será renovado amanhã.</p>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep('tryon')}
                                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isGenerating || (creditsBalance !== null && creditsBalance <= 0) || false /* userDailyUsage >= 3 desativado */}
                                        onClick={() => {
                                            handleStartTryOn();
                                            setStep('tryon');
                                        }}
                                        className="w-full bg-[#0B1221] hover:bg-[#1a2436] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4 text-[#FBC02D]" />
                                        Gerar Provador
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 'outfit_suggestions' && (
                    <div className="flex-grow flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden h-full animate-in fade-in duration-300">
                        {/* Left: Product Image */}
                        <div className="w-full lg:w-1/2 bg-slate-50 p-8 flex flex-col items-center justify-center border-r border-slate-100 lg:h-full shrink-0">
                            <div className="w-full max-w-[280px] aspect-[3/4] bg-white rounded-[2rem] border border-slate-100 shadow-md overflow-hidden p-2">
                                <img 
                                    src={product.images?.[0] || 'https://placehold.co/400x500?text=Produto'} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover rounded-2xl"
                                />
                            </div>
                            <div className="mt-4 text-center">
                                <h4 className="text-sm font-black text-[#0B1221]">{product.name}</h4>
                                <p className="text-xs text-slate-400 font-bold mt-0.5">
                                    R$ {(activeVariant ? product.price + (Number(activeVariant.additional_price) || 0) : product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        {/* Right: Suggestions panel */}
                        <div className="w-full lg:w-1/2 p-8 md:p-10 flex flex-col justify-between overflow-y-auto lg:h-full">
                            <div className="space-y-6 my-auto">
                                <div>
                                    <h3 className="text-2xl font-black text-[#0B1221] mt-1">Sugestões de Looks</h3>
                                    <p className="text-xs text-slate-400 font-bold mt-1">Complete o seu visual com estas peças selecionadas pela nossa inteligência artificial para combinar com a sua escolha.</p>
                                </div>

                                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                                    {isFetchingRecommendations ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <Loader2 className="w-8 h-8 text-[#0B1221] animate-spin mb-3" />
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Buscando combinações...</p>
                                        </div>
                                    ) : recommendations.length === 0 ? (
                                        <div className="text-center py-12 bg-slate-50 rounded-2xl p-6">
                                            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                            <p className="text-xs font-bold text-slate-500">Nenhuma recomendação disponível para esta variação no momento.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                                            {recommendations.map((rec: any) => (
                                                <div key={rec.variant_id} className="bg-slate-50 rounded-2xl border border-slate-100/70 p-3 flex flex-col justify-between hover:shadow-md transition-all">
                                                    <div>
                                                        <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white mb-2 border border-slate-200/50">
                                                            <img src={rec.image || 'https://placehold.co/300x400?text=Produto'} alt={rec.name} className="w-full h-full object-cover" />
                                                        </div>
                                                        <h5 className="text-[11px] font-black text-[#0B1221] line-clamp-1 leading-tight">{rec.name}</h5>
                                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                            Tam: {rec.size} • Cor: {rec.color}
                                                        </p>
                                                        <p className="text-xs font-black text-[#0B1221] mt-1">
                                                            R$ {rec.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </p>
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
                                                            toast.success(`${rec.name} adicionado ao carrinho!`);
                                                        }}
                                                        className="mt-3 w-full bg-[#0B1221] hover:bg-[#1a2436] text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                                    >
                                                        Adicionar à Bag
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Buttons */}
                            <div className="space-y-4 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setStep('tryon')}
                                    className="w-full bg-[#0B1221] hover:bg-[#1a2436] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md text-center"
                                >
                                    Voltar para o Provador
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
