import React from 'react';
import { GraduationCap, Award, Briefcase, Users, Tag, MapPin, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { getOfficeLocation } from '@/lib/officeLocations';
import MapboxMap from '@/components/map/MapboxMap';

export default function ProfileAbout({ professional }) {
  const hasOffice = professional.office_address || professional.office_city;
  const showMap = professional.modality === 'presencial' || professional.modality === 'ambos';

  const { data: officeLocation } = useQuery({
    queryKey: ['office-location', professional.id],
    queryFn: () => getOfficeLocation(professional.id),
    enabled: !!professional.id && showMap,
  });

  const hasCoords = officeLocation?.latitude && officeLocation?.longitude;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sobre o Profissional</h2>

      {professional.bio && (
        <p className="text-gray-600 leading-relaxed mb-6">{professional.bio}</p>
      )}

      {/* Formation & Experience grid */}
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        {(professional.education || professional.university) && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
            <GraduationCap className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Formação</p>
              <p className="text-sm font-medium text-gray-800">{professional.education || professional.university}</p>
            </div>
          </div>
        )}

        {professional.years_experience > 0 && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
            <Award className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Experiência</p>
              <p className="text-sm font-medium text-gray-800">{professional.years_experience}+ anos</p>
            </div>
          </div>
        )}

        {professional.profession && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
            <Briefcase className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Profissão</p>
              <p className="text-sm font-medium text-gray-800">{professional.profession}</p>
            </div>
          </div>
        )}

        {professional.specialty && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50">
            <Building2 className="w-5 h-5 text-purple-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Especialidade</p>
              <p className="text-sm font-medium text-gray-800">{professional.specialty}</p>
            </div>
          </div>
        )}
      </div>

      {/* Patients */}
      {professional.patient_types?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-500" />
            Público atendido
          </p>
          <div className="flex flex-wrap gap-2">
            {professional.patient_types.map(type => (
              <span key={type} className="px-3 py-1 bg-teal-50 text-teal-700 text-sm rounded-full border border-teal-100 font-medium">
                {type}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Experience tags */}
      {professional.tags?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-500" />
            Experiência em
          </p>
          <div className="flex flex-wrap gap-2">
            {professional.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-sm px-3 py-1 font-normal capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Physical office with map */}
      {hasOffice && showMap && (
        <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-sm font-medium text-emerald-800 mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Consultório Físico
          </p>
          {officeLocation?.formatted_address ? (
            <p className="text-sm text-gray-700">{officeLocation.formatted_address}</p>
          ) : (
            <>
              {professional.office_address && (
                <p className="text-sm text-gray-700">{professional.office_address}</p>
              )}
              {(professional.office_city || professional.office_state) && (
                <p className="text-sm text-gray-600 mt-0.5">
                  {[professional.office_city, professional.office_state].filter(Boolean).join(' – ')}
                </p>
              )}
            </>
          )}

          {hasCoords && (
            <div className="mt-3">
              <MapboxMap
                center={[officeLocation.longitude, officeLocation.latitude]}
                zoom={15}
                markers={[{
                  lng: officeLocation.longitude,
                  lat: officeLocation.latitude,
                  popup: `<strong>${professional.full_name}</strong><br/>${professional.specialty || ''}<br/>${officeLocation.formatted_address || professional.office_address || ''}`,
                }]}
                height="200px"
                interactive={false}
              />
            </div>
          )}
        </div>
      )}

      {/* Office details without map (online-only with address set) */}
      {hasOffice && !showMap && (
        <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <p className="text-sm font-medium text-emerald-800 mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Consultório Físico
          </p>
          {professional.office_address && (
            <p className="text-sm text-gray-700">{professional.office_address}</p>
          )}
          {(professional.office_city || professional.office_state) && (
            <p className="text-sm text-gray-600 mt-0.5">
              {[professional.office_city, professional.office_state].filter(Boolean).join(' – ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
