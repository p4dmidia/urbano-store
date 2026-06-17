import React, { useEffect, useState, useRef } from 'react';
import ClientLayout from '../components/ClientLayout';
import { useAuth } from '../components/AuthContext';
import { supabase } from '../lib/supabase';
import { Ruler, Sparkles, Check, Save, Upload, Trash2, AlertCircle, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface BodyProfile {
    id: string;
    profile_name: string;
    is_default: boolean;
    gender: 'male' | 'female' | 'unisex';
    height_cm: number;
    weight_kg: number;
    chest_cm: number | null;
    waist_cm: number | null;
    hips_cm: number | null;
    shoulder_cm: number | null;
    age?: number | null;
    body_type?: string | null;
    fit_preference?: string | null;
    user_photo_url?: string | null;
}

const ClientBodyProfiles: React.FC = () => {
    const { profile } = useAuth();
    const [bodyProfile, setBodyProfile] = useState<BodyProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        profile_name: 'Meu Perfil Padrão',
        gender: 'female',
        height_cm: '',
        weight_kg: '',
        chest_cm: '',
        waist_cm: '',
        hips_cm: '',
        shoulder_cm: '',
        age: '',
        body_type: 'medium',
        fit_preference: 'normal',
        user_photo_url: ''
    });

    useEffect(() => {
        if (profile?.id) {
            fetchBodyProfile(profile.id);
        }
    }, [profile?.id]);

    const fetchBodyProfile = async (userId: string) => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('user_body_profiles')
                .select('*')
                .eq('user_id', userId)
                .eq('is_default', true)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setBodyProfile(data);
                setFormData({
                    profile_name: data.profile_name || 'Meu Perfil Padrão',
                    gender: data.gender || 'female',
                    height_cm: data.height_cm?.toString() || '',
                    weight_kg: data.weight_kg?.toString() || '',
                    chest_cm: data.chest_cm?.toString() || '',
                    waist_cm: data.waist_cm?.toString() || '',
                    hips_cm: data.hips_cm?.toString() || '',
                    shoulder_cm: data.shoulder_cm?.toString() || '',
                    age: data.age?.toString() || '',
                    body_type: data.body_type || 'medium',
                    fit_preference: data.fit_preference || 'normal',
                    user_photo_url: data.user_photo_url || ''
                });
            }
        } catch (err) {
            console.error('Error fetching body profile:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!profile?.id) {
            toast.error('Faça login para salvar fotos de provador.');
            return;
        }

        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `profiles/${profile.id}-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(fileName);

            setFormData(prev => ({ ...prev, user_photo_url: publicUrl }));
            toast.success('Sua foto corporal foi enviada com sucesso!');
        } catch (err: any) {
            console.error('Photo upload error:', err);
            toast.error(err.message || 'Erro ao enviar foto.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeletePhoto = () => {
        setFormData(prev => ({ ...prev, user_photo_url: '' }));
        toast.success('Foto removida. O provador usará o avatar de fallback.');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setSaving(true);
        try {
            const payload = {
                user_id: profile.id,
                profile_name: formData.profile_name,
                gender: formData.gender as 'male' | 'female' | 'unisex',
                height_cm: formData.height_cm ? parseFloat(formData.height_cm) : 170,
                weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : 70,
                chest_cm: formData.chest_cm ? parseFloat(formData.chest_cm) : null,
                waist_cm: formData.waist_cm ? parseFloat(formData.waist_cm) : null,
                hips_cm: formData.hips_cm ? parseFloat(formData.hips_cm) : null,
                shoulder_cm: formData.shoulder_cm ? parseFloat(formData.shoulder_cm) : null,
                age: formData.age ? parseInt(formData.age) : null,
                body_type: formData.body_type,
                fit_preference: formData.fit_preference,
                user_photo_url: formData.user_photo_url || null,
                is_default: true,
                updated_at: new Date().toISOString()
            };

            if (bodyProfile?.id) {
                // Update
                const { error } = await supabase
                    .from('user_body_profiles')
                    .update(payload)
                    .eq('id', bodyProfile.id);

                if (error) throw error;
                toast.success('Seu Corpo Virtual foi atualizado com sucesso!');
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('user_body_profiles')
                    .insert([payload])
                    .select()
                    .single();

                if (error) throw error;
                setBodyProfile(data);
                toast.success('Seu Corpo Virtual foi criado com sucesso!');
            }
        } catch (err: any) {
            console.error('Error saving profile:', err);
            toast.error(err.message || 'Erro ao salvar medidas.');
        } finally {
            setSaving(false);
        }
    };

    const getAvatarPreviewUrl = () => {
        if (formData.user_photo_url) return formData.user_photo_url;
        
        if (formData.gender === 'male') {
            if (formData.body_type === 'muscular') {
                return '/assets/vton_model_male_athletic.png';
            }
            return '/assets/vton_model_male_slim.png';
        } else {
            if (formData.body_type === 'plus_size') {
                return '/assets/vton_model_female_curvy.png';
            }
            return '/assets/vton_model_female_slim.png';
        }
    };

    const getAvatarName = () => {
        if (formData.user_photo_url) return 'Sua Foto Real';
        
        if (formData.gender === 'male') {
            if (formData.body_type === 'muscular') {
                return 'Masculino Atlético (Lucas)';
            }
            return 'Masculino Slim (Gabriel)';
        } else {
            if (formData.body_type === 'plus_size') {
                return 'Feminino Curvilíneo (Camila)';
            }
            return 'Feminino Slim (Sarah)';
        }
    };

    return (
        <ClientLayout>
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#FBC02D]">Classe A Intelligence</span>
                    <h2 className="text-3xl font-black text-[#0B1221] mt-1">Meu Corpo Virtual</h2>
                    <p className="text-slate-500 text-sm mt-1">Configure suas medidas corporais e foto de provador para obter simulações de IA ultra-precisas.</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#FBC02D]"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Form Column */}
                        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                            <form onSubmit={handleSubmit} className="space-y-8">
                                
                                {/* Section 1: Perfil Básico */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-[#0B1221] border-b border-slate-50 pb-2">1. Dados Básicos</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gênero</label>
                                            <select
                                                name="gender"
                                                value={formData.gender}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                            >
                                                <option value="female">Feminino</option>
                                                <option value="male">Masculino</option>
                                                <option value="unisex">Unissex / Neutro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Perfil</label>
                                            <input
                                                type="text"
                                                name="profile_name"
                                                value={formData.profile_name}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Ex: Meu Perfil"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Idade (Opcional)</label>
                                            <input
                                                type="number"
                                                name="age"
                                                value={formData.age}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Ex: 25"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Altura (cm)</label>
                                            <input
                                                type="number" step="0.1" name="height_cm"
                                                value={formData.height_cm}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Ex: 175"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Peso (kg)</label>
                                            <input
                                                type="number" step="0.1" name="weight_kg"
                                                value={formData.weight_kg}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Ex: 70"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Biotipo e Preferência */}
                                <div className="space-y-4 pt-2">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-[#0B1221] border-b border-slate-50 pb-2">2. Biotipo e Caimento</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo Físico</label>
                                            <select
                                                name="body_type"
                                                value={formData.body_type}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                            >
                                                <option value="slim">Magro (Slim)</option>
                                                <option value="medium">Médio / Atlético (Regular)</option>
                                                <option value="muscular">Musculoso (Athletic)</option>
                                                <option value="plus_size">Plus Size / Curvilíneo (Curvy)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Preferência de Ajuste</label>
                                            <select
                                                name="fit_preference"
                                                value={formData.fit_preference}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-4 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                            >
                                                <option value="tight">Justo ao Corpo</option>
                                                <option value="normal">Caimento Padrão</option>
                                                <option value="loose">Folgado / Oversized</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 3: Circunferências Corporais */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-[#0B1221]">3. Circunferências (Opcional)</h3>
                                        <div className="group relative cursor-pointer text-slate-400 hover:text-[#0B1221]">
                                            <HelpCircle className="w-4 h-4" />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-[#0B1221] text-white text-[10px] p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10 leading-relaxed">
                                                Circunferências físicas ajudam a IA a calcular o caimento ideal nas articulações e busto.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Busto/Tórax (cm)</label>
                                            <input
                                                type="number" step="0.1" name="chest_cm"
                                                value={formData.chest_cm}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Busto"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cintura (cm)</label>
                                            <input
                                                type="number" step="0.1" name="waist_cm"
                                                value={formData.waist_cm}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Cintura"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quadril (cm)</label>
                                            <input
                                                type="number" step="0.1" name="hips_cm"
                                                value={formData.hips_cm}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Quadril"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ombros (cm)</label>
                                            <input
                                                type="number" step="0.1" name="shoulder_cm"
                                                value={formData.shoulder_cm}
                                                onChange={handleInputChange}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 px-3 font-bold text-[#0B1221] outline-none focus:border-[#FBC02D] transition-all text-sm"
                                                placeholder="Ombro"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="w-full bg-[#0B1221] hover:bg-[#1a2436] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#0B1221]/10 disabled:opacity-50"
                                >
                                    {saving ? 'SALVANDO MEDIDAS...' : 'SALVAR MEDIDAS DO CORPO'}
                                    <Save className="w-4 h-4 text-[#FBC02D]" />
                                </button>
                            </form>
                        </div>

                        {/* Interactive Preview & Photo Column */}
                        <div className="space-y-6">
                            
                            {/* Visual Avatar Card */}
                            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm flex flex-col items-center text-center">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Manequim Ativo VTON</h4>
                                
                                <div className="w-full max-w-[200px] aspect-[3/4] bg-slate-50 border border-slate-100 rounded-[2rem] overflow-hidden relative shadow-sm mb-4">
                                    <img 
                                        src={getAvatarPreviewUrl()} 
                                        alt="Manequim provador" 
                                        className="w-full h-full object-cover"
                                        onError={(e: any) => {
                                            e.target.src = 'https://placehold.co/400x500?text=Carregando...';
                                        }}
                                    />
                                    {isUploading && (
                                        <div className="absolute inset-0 bg-white/85 flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FBC02D]"></div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1 mb-6">
                                    <p className="font-black text-sm text-[#0B1221]">{getAvatarName()}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                        {formData.user_photo_url ? 'Foto Enviada' : 'Avatar Inteligente'}
                                    </p>
                                </div>

                                {/* Custom Photo Action Buttons */}
                                <div className="w-full space-y-3">
                                    <label className="w-full bg-[#FBC02D] hover:bg-[#f9b100] text-[#0B1221] py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md">
                                        <Upload className="w-4 h-4" />
                                        {formData.user_photo_url ? 'Substituir Foto' : 'Usar Minha Foto Real'}
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={handlePhotoUpload} 
                                            disabled={isUploading} 
                                            ref={fileInputRef}
                                        />
                                    </label>
                                    
                                    {formData.user_photo_url && (
                                        <button
                                            type="button"
                                            onClick={handleDeletePhoto}
                                            className="w-full border-2 border-red-100 text-red-500 hover:bg-red-50 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Remover Foto
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Informational Help Box */}
                            <div className="bg-[#0B1221] text-white p-8 rounded-[2rem] space-y-4 shadow-xl shadow-[#0B1221]/15">
                                <div className="w-10 h-10 rounded-xl bg-[#FBC02D]/10 text-[#FBC02D] flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-[#FBC02D]" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-wider">Como funciona no provador?</h3>
                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                    Seus dados corporais são associados de forma segura à sua conta. Quando você clica em "Provador Virtual" nas páginas de produtos:
                                </p>
                                <ul className="text-[11px] text-slate-300 space-y-2.5">
                                    <li className="flex items-start gap-2">
                                        <Check className="w-3.5 h-3.5 text-[#FBC02D] shrink-0 mt-0.5" /> 
                                        <span>A IA lê suas medidas para recomendar o tamanho adequado.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-3.5 h-3.5 text-[#FBC02D] shrink-0 mt-0.5" /> 
                                        <span>Se você tiver uma foto cadastrada, a IA aplica a roupa diretamente nela.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <Check className="w-3.5 h-3.5 text-[#FBC02D] shrink-0 mt-0.5" /> 
                                        <span>Caso contrário, o manequim 3D correspondente ao seu gênero e tipo físico é utilizado.</span>
                                    </li>
                                </ul>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </ClientLayout>
    );
};

export default ClientBodyProfiles;
