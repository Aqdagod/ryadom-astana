import React, { useEffect, useState } from 'react';
import { Category, NearbyEventResult } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { ASTANA_DISTRICTS, formatAlmatyDateTime, isEventLiveNow } from '../utils/time';
import { apiClient } from '../services/apiClient';
import { NearbyEmptyState } from './SystemStates';

interface NearbyNowSheetProps {
  open: boolean;
  lang: Lang;
  categories: Category[];
  userPosition: [number, number] | null;
  onUpdatePosition: (coords: [number, number], label: string) => void;
  onSelectEvent: (eventId: string) => void;
  onCreateEvent: () => void;
  onClose: () => void;
}

export const NearbyNowSheet: React.FC<NearbyNowSheetProps> = ({
  open,
  lang,
  categories,
  userPosition,
  onUpdatePosition,
  onSelectEvent,
  onCreateEvent,
  onClose,
}) => {
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');
  const [radiusKm, setRadiusKm] = useState(5);
  const [results, setResults] = useState<NearbyEventResult[]>([]);
  const [locationLabel, setLocationLabel] = useState('Астана');

  const t = TRANSLATIONS[lang].map;

  useEffect(() => {
    if (!open) return;
    let active = true;

    const loadNearby = async (lat: number, lng: number) => {
      const res = await apiClient.getNearbyEventsRPC({
        lat,
        lng,
        radiusKm,
        windowHours: 3,
      });
      if (active) setResults(res.data || []);
    };

    if (userPosition) {
      setGeoStatus('granted');
      void loadNearby(userPosition[0], userPosition[1]);
      return () => {
        active = false;
      };
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setGeoStatus('loading');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const inAstana = lat >= 50.9 && lat <= 51.4 && lng >= 71.1 && lng <= 71.7;
          if (inAstana) {
            setGeoStatus('granted');
            setLocationLabel(lang === 'kz' ? 'Менің геолокациям' : 'Моя геопозиция');
            onUpdatePosition([lat, lng], 'GPS');
            void loadNearby(lat, lng);
          } else {
            setGeoStatus('denied');
          }
        },
        () => {
          setGeoStatus('denied');
        },
        { timeout: 3500 }
      );
    } else {
      setGeoStatus('denied');
    }

    return () => {
      active = false;
    };
  }, [open, radiusKm, userPosition]);

  const handleSelectDistrict = async (dId: string) => {
    const dist = ASTANA_DISTRICTS.find((d) => d.id === dId);
    if (!dist) return;
    const label = lang === 'kz' ? dist.name_kz : dist.name_ru;
    setLocationLabel(label);
    setGeoStatus('granted');
    onUpdatePosition([dist.lat, dist.lng], label);
    const res = await apiClient.getNearbyEventsRPC({
      lat: dist.lat,
      lng: dist.lng,
      radiusKm,
      windowHours: 3,
    });
    setResults(res.data || []);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full md:max-w-xl bg-white rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-7 shadow-2xl max-h-[85vh] overflow-y-auto no-sb">
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 md:hidden" />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.nearbySheetTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {locationLabel} · {lang === 'kz' ? 'Радиус' : 'Радиус'} {radiusKm} {t.km}
            </p>
          </div>
          <button
            onClick={onClose}
            className="tap rounded-full text-slate-500 text-lg grid place-items-center cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* District selector if geolocation denied or user wants to switch */}
        <div className="mt-3">
          {geoStatus === 'denied' && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3.5 mb-3">
              <p className="text-xs font-bold text-indigo-900">{t.noLocationTitle}</p>
              <p className="text-[11px] text-indigo-700 mt-0.5">{t.noLocationDesc}</p>
            </div>
          )}

          <div className="flex gap-1.5 overflow-x-auto no-sb pb-1">
            {ASTANA_DISTRICTS.map((d) => (
              <button
                key={d.id}
                onClick={() => handleSelectDistrict(d.id)}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-[11px] font-semibold text-slate-700 whitespace-nowrap transition cursor-pointer"
              >
                📍 {(lang === 'kz' ? d.name_kz : d.name_ru).split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Radius quick chips (including 0.1 km to test F-06 empty state!) */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[11px] font-semibold text-slate-500">
            {lang === 'kz' ? 'Радиус:' : 'Радиус:'}
          </span>
          {[0.1, 1, 3, 5, 10].map((r) => (
            <button
              key={r}
              onClick={() => setRadiusKm(r)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold cursor-pointer ${
                radiusKm === r
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {r < 1 ? `${r * 1000} м` : `${r} ${t.km}`}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {geoStatus === 'loading' && (
            <div className="py-8 text-center text-sm text-slate-500">
              {lang === 'kz' ? 'Геолокация анықталуда...' : 'Определяем геопозицию...'}
            </div>
          )}

          {geoStatus !== 'loading' && results.length === 0 && (
            <NearbyEmptyState
              lang={lang}
              onExpandRadius={() => setRadiusKm(10)}
              onCreateEvent={() => {
                onClose();
                onCreateEvent();
              }}
            />
          )}

          {geoStatus !== 'loading' &&
            results.map(({ event, distanceKm }) => {
              const cat = categories.find((c) => c.id === event.category_id);
              const live = isEventLiveNow(event.starts_at, event.ends_at);
              return (
                <article
                  key={event.id}
                  onClick={() => {
                    onClose();
                    onSelectEvent(event.id);
                  }}
                  className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm flex gap-3 items-center cursor-pointer hover:border-indigo-300 transition"
                >
                  <div
                    className="w-16 h-16 rounded-xl flex-none grid place-items-center text-2xl text-white"
                    style={{
                      background: event.poster_gradient || 'linear-gradient(135deg,#4F46E5,#0EA5E9)',
                    }}
                  >
                    {cat?.icon || '📍'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {live && (
                        <span className="text-[10px] font-bold text-white bg-emerald-500 rounded-full px-2 py-0.5">
                          ● {t.liveNow}
                        </span>
                      )}
                      <span className="text-[11px] font-bold text-indigo-600 tabular-nums">
                        {distanceKm} {t.km}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 truncate mt-1">
                      {event.title}
                    </h3>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {formatAlmatyDateTime(event.starts_at, lang)} · {event.address}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">
                        {event.price === 0 ? `${t.free} · 0 ₸` : `${event.price} ₸`}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        👥 {event.attendees_count} {t.goingCount}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
        </div>
      </div>
    </div>
  );
};
