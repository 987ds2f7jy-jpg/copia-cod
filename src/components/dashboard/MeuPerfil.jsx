import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Save, Lock, Camera, Plus, X, Globe, MapPin, ExternalLink,
  AlertCircle, Search
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import DisponibilidadeEditor from '@/components/dashboard/DisponibilidadeEditor';
import MapboxMap from '@/components/map/MapboxMap';
import { getOfficeLocation, saveOfficeLocation, deleteOfficeLocation } from '@/lib/officeLocations';

const PATIENT_TYPES = ['Criança', 'Adolescente', 'Adulto', 'Idoso'];
const MODALITIES = [
  { value: 'online', label: 'Online' },
  { value: 'presencial', label: 'Presencial' },
  { value: 'ambos', label: 'Ambos' },
];

function ReadOnlyField({ label, value }) {
  return (
    <div>
      <Label className="flex items-center gap-1 text-gray-500">
        <Lock className="w-3 h-3" /> {label}
      </Label>
      <div className="mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
        {value || '—'}
      </div>
    </div>
  );
}

export default function MeuPerfil({ professional, publicProfile }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [addressSearch, setAddressSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const { data: availabilitySlots = [] } = useQuery({
    queryKey: ['avail-slots', professional?.id],
    queryFn: () => base44.entities.AvailabilitySlot.filter({ professional_id: professional.id }),
    enabled: !!professional?.id,
  });

  const [form, setForm] = useState({
    photo_url: publicProfile?.photo_url || professional?.photo_url || '',
    bio: publicProfile?.bio || professional?.bio || '',
    instagram_url: publicProfile?.instagram_url || '',
    patient_types: publicProfile?.patient_types || [],
    tags: publicProfile?.tags || [],
    modality: publicProfile?.modality || 'online',
    office_city: publicProfile?.office_city || '',
    office_state: publicProfile?.office_state || '',
    office_address: publicProfile?.office_address || '',
    gallery_urls: publicProfile?.gallery_urls || [],
    price_standard: publicProfile?.price_standard || professional?.price_standard || '',
    price_priority: publicProfile?.price_priority || professional?.price_priority || '',
    available_days: publicProfile?.available_days || professional?.available_days || [],
    available_hours: publicProfile?.available_hours || professional?.available_hours || [],
    perfil_ativo: publicProfile?.perfil_ativo || professional?.perfil_ativo || false,
    prioritario_ativo: publicProfile?.prioritario_ativo || professional?.prioritario_ativo || false,
  });

  // Office location state
  const [officeForm, setOfficeForm] = useState({
    address_line: '', number: '', complement: '', neighborhood: '',
    city: '', state: '', postal_code: '', formatted_address: '',
    latitude: 0, longitude: 0, mapbox_place_id: '',
  });

  const { data: existingOffice } = useQuery({
    queryKey: ['office-location', publicProfile?.id],
    queryFn: () => getOfficeLocation(publicProfile.id),
    enabled: !!publicProfile?.id,
  });

  useEffect(() => {
    if (existingOffice) {
      setOfficeForm({
        address_line: existingOffice.address_line || '',
        number: existingOffice.number || '',
        complement: existingOffice.complement || '',
        neighborhood: existingOffice.neighborhood || '',
        city: existingOffice.city || '',
        state: existingOffice.state || '',
        postal_code: existingOffice.postal_code || '',
        formatted_address: existingOffice.formatted_address || '',
        latitude: existingOffice.latitude || 0,
        longitude: existingOffice.longitude || 0,
        mapbox_place_id: existingOffice.mapbox_place_id || '',
      });
    }
  }, [existingOffice]);

  const mapCenter = officeForm.latitude && officeForm.longitude
    ? [officeForm.longitude, officeForm.latitude]
    : [-46.6333, -23.5505];

  const mapMarkers = officeForm.latitude && officeForm.longitude
    ? [{ lng: officeForm.longitude, lat: officeForm.latitude, popup: `<strong>${professional?.full_name}</strong><br/>${officeForm.formatted_address || officeForm.address_line}` }]
    : [];

  const handleMarkerDrag = useCallback(({ lat, lng }) => {
    setOfficeForm(prev => ({ ...prev, latitude: lat, longitude: lng }));
  }, []);

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

  const searchAddress = useCallback(async (query) => {
    if (!query || query.length < 3 || !MAPBOX_TOKEN) return;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=BR&language=pt&access_token=${MAPBOX_TOKEN}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data.features || []);
    } catch { setSearchResults([]); }
  }, [MAPBOX_TOKEN]);

  const selectAddress = useCallback((feature) => {
    const [lng, lat] = feature.center;
    const ctx = (type) => feature.context?.find(c => c.id.startsWith(type))?.text || '';
    setOfficeForm(prev => ({
      ...prev,
      formatted_address: feature.place_name || '',
      latitude: lat,
      longitude: lng,
      mapbox_place_id: feature.id || '',
      address_line: feature.text || prev.address_line,
      number: feature.address || prev.number,
      neighborhood: ctx('neighborhood') || ctx('locality') || prev.neighborhood,
      city: ctx('place') || prev.city,
      state: ctx('region') || prev.state,
      postal_code: ctx('postcode') || prev.postal_code,
    }));
    setAddressSearch('');
    setSearchResults([]);
  }, []);

  const setOffice = (field, value) => setOfficeForm(prev => ({ ...prev, [field]: value }));

  const hasGranularAvailability = useMemo(
    () => availabilitySlots.length > 0,
    [availabilitySlots.length],
  );

  const validatePerfilAtivo = () => {
    const hasPrice = parseFloat(form.price_standard) > 0;
    const hasDays = form.available_days?.length > 0 || hasGranularAvailability;
    if (!hasPrice && !hasDays) return 'E necessario configurar valor da consulta e pelo menos um horario disponivel.';
    if (!hasPrice) return 'Defina o valor da consulta padrao antes de ativar.';
    if (!hasDays) return 'Configure sua disponibilidade antes de ativar.';
    return null;
  };

  const [perfilAtivoError, setPerfilAtivoError] = React.useState(null);

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('photo_url', file_url);
    } catch (error) {
      toast.error(error?.message || 'Erro ao enviar a foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleGalleryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingGallery(true);
    try {
      const uploads = await Promise.all(files.map((file) => base44.integrations.Core.UploadFile({ file })));
      set('gallery_urls', [...form.gallery_urls, ...uploads.map((upload) => upload.file_url)]);
    } catch (error) {
      toast.error(error?.message || 'Erro ao enviar a galeria.');
    } finally {
      setUploadingGallery(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
    setTagInput('');
  };

  const togglePatientType = (type) => {
    const curr = form.patient_types;
    set('patient_types', curr.includes(type) ? curr.filter(t => t !== type) : [...curr, type]);
  };

  const needsLocation = form.modality === 'presencial' || form.modality === 'ambos';

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate location for presencial/ambos
      if (needsLocation) {
        if (!officeForm.address_line || !officeForm.city || !officeForm.state) {
          throw new Error('Preencha rua, cidade e UF do consultório.');
        }
        if (!officeForm.latitude || !officeForm.longitude) {
          throw new Error('Selecione a localização no mapa para definir as coordenadas.');
        }
      }

      const graduationYear = professional?.graduation_year || publicProfile?.graduation_year || 0;
      const priceStd = parseFloat(form.price_standard) || 0;
      const pricePri = parseFloat(form.price_priority) || 0;

      const publicUpdates = {
        photo_url: form.photo_url,
        bio: form.bio,
        instagram_url: form.instagram_url,
        patient_types: form.patient_types,
        tags: form.tags,
        modality: form.modality,
        office_city: needsLocation ? officeForm.city : form.office_city,
        office_state: needsLocation ? officeForm.state : form.office_state,
        office_address: needsLocation ? officeForm.formatted_address || officeForm.address_line : form.office_address,
        gallery_urls: form.gallery_urls,
        price_standard: priceStd,
        price_priority: pricePri,
        available_days: form.available_days,
        available_hours: form.available_hours,
        perfil_ativo: form.perfil_ativo,
        prioritario_ativo: form.prioritario_ativo,
        education: professional?.university || publicProfile?.education || '',
        graduation_year: graduationYear,
        rqe: professional?.rqe || publicProfile?.rqe || '',
        full_name: professional?.full_name || publicProfile?.full_name || '',
        specialty: professional?.specialty || publicProfile?.specialty || '',
        profession: professional?.profession || publicProfile?.profession || '',
        register_number: professional?.register_number || publicProfile?.register_number || '',
        register_state: professional?.register_state || publicProfile?.register_state || '',
      };

      const privateUpdates = {
        bio: form.bio,
        photo_url: form.photo_url,
        price_standard: priceStd,
        price_priority: pricePri,
        available_days: form.available_days,
        available_hours: form.available_hours,
        prioritario_ativo: form.prioritario_ativo,
      };

      await base44.entities.ProfessionalProfile.update(professional.id, privateUpdates);

      if (publicProfile?.id) {
        await base44.entities.ProfessionalPublicProfile.update(publicProfile.id, publicUpdates);

        // Save or delete office location
        if (needsLocation) {
          await saveOfficeLocation(publicProfile.id, officeForm);
        } else {
          await deleteOfficeLocation(publicProfile.id);
        }
      }
    },
    onSuccess: () => {
      toast.success('Perfil atualizado! Visível na busca em instantes.');
      queryClient.invalidateQueries({ queryKey: ['myProfessionalProfile'] });
      queryClient.invalidateQueries({ queryKey: ['myPublicProfile'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      queryClient.invalidateQueries({ queryKey: ['office-location'] });
    },
    onError: (err) => toast.error(err?.message || 'Erro ao salvar perfil'),
  });

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Link to public profile */}
      {publicProfile?.id && publicProfile?.status === 'approved' && form.perfil_ativo && (
        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <div>
            <p className="text-sm font-medium text-emerald-800">Seu perfil está visível na busca</p>
            <p className="text-xs text-emerald-600 mt-0.5">Pacientes podem te encontrar e agendar consultas</p>
          </div>
          <Link to={createPageUrl(`PerfilProfissional?id=${publicProfile.id}`)}>
            <button className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium hover:underline">
              Ver perfil <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      )}

      {/* Read-only fields */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-gray-400" />
            Dados Imutáveis
          </CardTitle>
          <p className="text-xs text-gray-400">Esses dados só podem ser alterados pelo suporte</p>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <ReadOnlyField label="Nome completo" value={professional?.full_name} />
          <ReadOnlyField label="Profissão" value={professional?.profession} />
          <ReadOnlyField label="Especialidade" value={professional?.specialty} />
          <ReadOnlyField label="Registro" value={`${professional?.register_number || ''} / ${professional?.register_state || ''}`} />
          {professional?.rqe && <ReadOnlyField label="RQE" value={professional.rqe} />}
          <ReadOnlyField label="Universidade" value={professional?.university} />
          <ReadOnlyField label="Ano de Formação" value={professional?.graduation_year} />
          <ReadOnlyField label="Sexo" value={professional?.sex} />
        </CardContent>
      </Card>

      {/* Photo */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Foto de Perfil</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {form.photo_url ? (
              <div className="relative">
                <img src={form.photo_url} alt="Foto" className="w-24 h-24 rounded-xl object-cover" />
                <button onClick={() => set('photo_url', '')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✕</button>
              </div>
            ) : (
              <label className="cursor-pointer w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-emerald-400 transition-colors">
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                {uploading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Camera className="w-5 h-5 text-gray-400" />}
                <span className="text-xs text-gray-400">Upload</span>
              </label>
            )}
            <p className="text-sm text-gray-500">Foto profissional, fundo neutro, boa iluminação</p>
          </div>
        </CardContent>
      </Card>

      {/* Bio & Instagram */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Apresentação</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Sobre você</Label>
            <Textarea value={form.bio} onChange={e => set('bio', e.target.value)} placeholder="Conte sobre sua experiência, abordagem e como pode ajudar..." className="mt-1 min-h-[100px]" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><Globe className="w-3 h-3" />Instagram (opcional)</Label>
            <Input value={form.instagram_url} onChange={e => set('instagram_url', e.target.value)} placeholder="https://instagram.com/seu_perfil" className="mt-1" />
          </div>
        </CardContent>
      </Card>

      {/* Patient types & Tags */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Público e Especialização</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Público atendido</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PATIENT_TYPES.map(type => (
                <button key={type} onClick={() => togglePatientType(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    form.patient_types.includes(type) ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                  }`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Experiência em (tags)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Ex: ansiedade, hipertensão..." className="flex-1" />
              <Button type="button" onClick={addTag} variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button onClick={() => set('tags', form.tags.filter(t => t !== tag))}><X className="w-3 h-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modality & Address */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Modalidade e Local</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Modalidade de atendimento</Label>
            <div className="flex gap-2 mt-2">
              {MODALITIES.map(m => (
                <button key={m.value} onClick={() => set('modality', m.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.modality === m.value ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {needsLocation && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl">
              <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" />Endereço do consultório</Label>

              {/* Mapbox address search */}
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={addressSearch}
                      onChange={e => { setAddressSearch(e.target.value); searchAddress(e.target.value); }}
                      placeholder="Buscar endereço no mapa..."
                      className="pl-9"
                    />
                  </div>
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((feat) => (
                      <button
                        key={feat.id}
                        onClick={() => selectAddress(feat)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                      >
                        <span className="font-medium">{feat.text}</span>
                        <span className="text-gray-400 ml-1 text-xs">{feat.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Structured address fields */}
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs text-gray-500">Rua *</Label>
                  <Input value={officeForm.address_line} onChange={e => setOffice('address_line', e.target.value)} placeholder="Rua / Avenida" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Número</Label>
                  <Input value={officeForm.number} onChange={e => setOffice('number', e.target.value)} placeholder="Nº" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-gray-500">Complemento</Label>
                  <Input value={officeForm.complement} onChange={e => setOffice('complement', e.target.value)} placeholder="Sala, andar..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Bairro</Label>
                  <Input value={officeForm.neighborhood} onChange={e => setOffice('neighborhood', e.target.value)} placeholder="Bairro" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs text-gray-500">Cidade *</Label>
                  <Input value={officeForm.city} onChange={e => setOffice('city', e.target.value)} placeholder="Cidade" />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">UF *</Label>
                  <Input value={officeForm.state} onChange={e => setOffice('state', e.target.value.toUpperCase())} placeholder="UF" maxLength={2} />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">CEP</Label>
                  <Input value={officeForm.postal_code} onChange={e => setOffice('postal_code', e.target.value)} placeholder="00000-000" />
                </div>
              </div>

              {/* Map with draggable marker */}
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-2">Arraste o marcador para ajustar a posição exata do consultório</p>
                <MapboxMap
                  center={mapCenter}
                  zoom={15}
                  markers={mapMarkers}
                  height="250px"
                  draggableMarker
                  onMarkerChange={handleMarkerDrag}
                />
              </div>

              {officeForm.latitude && officeForm.longitude ? (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Coordenadas: {officeForm.latitude.toFixed(5)}, {officeForm.longitude.toFixed(5)}
                </p>
              ) : (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Busque o endereço acima para definir a localização no mapa
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Galeria do Consultório</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {form.gallery_urls.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                <button onClick={() => set('gallery_urls', form.gallery_urls.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">✕</button>
              </div>
            ))}
            <label className="cursor-pointer w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-emerald-400 transition-colors">
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
              {uploadingGallery ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Plus className="w-4 h-4 text-gray-400" />}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Valores das Consultas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Consulta Padrão (R$)</Label>
              <Input type="number" value={form.price_standard} onChange={e => set('price_standard', e.target.value)} placeholder="150" className="mt-1" />
            </div>
            <div>
              <Label>Consulta Prioritária (R$)</Label>
              <Input type="number" value={form.price_priority} onChange={e => set('price_priority', e.target.value)} placeholder="250" className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disponibilidade granular por dia */}
      <DisponibilidadeEditor professional={professional} />

      {/* Controles de visibilidade */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Controles de Visibilidade</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Perfil ativo na busca</p>
              <p className="text-xs text-gray-500 mt-0.5">Quando ativo, pacientes podem te encontrar e agendar consultas.</p>
              {perfilAtivoError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {perfilAtivoError}
                </div>
              )}
            </div>
            <Switch
              checked={form.perfil_ativo}
              onCheckedChange={(v) => {
                if (v) {
                  const err = validatePerfilAtivo();
                  if (err) { setPerfilAtivoError(err); return; }
                  setPerfilAtivoError(null);
                } else {
                  setPerfilAtivoError(null);
                }
                set('perfil_ativo', v);
              }}
              className="mt-0.5"
            />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Consulta prioritária disponível</p>
              <p className="text-xs text-gray-500 mt-0.5">Permite que pacientes solicitem atendimento em até 36h com valor diferenciado.</p>
              {form.prioritario_ativo && !parseFloat(form.price_priority) && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Defina o valor da consulta prioritária.
                </div>
              )}
            </div>
            <Switch
              checked={form.prioritario_ativo}
              onCheckedChange={(v) => set('prioritario_ativo', v)}
              className="mt-0.5"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !!perfilAtivoError}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 disabled:opacity-50">
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Salvar Alterações
      </Button>
    </div>
  );
}
