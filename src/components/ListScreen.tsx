import React from 'react';
import { Category, Event, EventFilters, TimelineFilter } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { ASTANA_CENTER, formatAlmatyDateTime, haversineKm, isEventLiveNow } from '../utils/time';
import { EmptyFilterState } from './SystemStates';

interface ListScreenProps {
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  events: Event[];
  categories: Category[];
  filters: EventFilters;
  userPosition: [number, number] | null;
  onChangeSearch: (q: string) => void;
  onChangeTimeline: (tl: TimelineFilter) => void;
  onOpenFilters: () => void;
  onSelectEvent: (eventId: string) => void;
  onBackToMap: () => void;
  onResetFilters: () => void;
}

export const ListScreen: React.FC<ListScreenProps> = ({
  lang,
  onChangeLang,
  events,
  categories,
  filters,
  userPosition,
  onChangeSearch,
  onChangeTimeline,
  onOpenFilters,
  onSelectEvent,
  onBackToMap,
  onResetFilters,
}) => {
  const t = TRANSLATIONS[lang];
  const refPos = userPosition || ASTANA_CENTER;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white px-4 pt-3 pb-3 border-b border-slate-100 flex-none">
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToMap}
            className="tap rounded-full grid place-items-center text-lg cursor-pointer"
            aria-label="Назад"
          >
            ←
          </button>
          <div className="font-bold text-slate-900">{t.list.title}</div>
          <div className="flex bg-[#F8FAFC] rounded-full p-0.5 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => onChangeLang('ru')}
              className={`px-2.5 py-1 rounded-full cursor-pointer ${
                lang === 'ru' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              RU
            </button>
            <button
              onClick={() => onChangeLang('kz')}
              className={`px-2.5 py-1 rounded-full cursor-pointer ${
                lang === 'kz' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              KZ
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <label className="flex-1 flex items-center gap-2 h-11 px-3 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-sm">
            <span>🔍</span>
            <input
              value={filters.search}
              onChange={(e) => onChangeSearch(e.target.value)}
              placeholder={t.list.searchPlaceholder}
              className="bg-transparent outline-none w-full text-slate-900 placeholder-slate-400"
            />
            {filters.search && (
              <button
                onClick={() => onChangeSearch('')}
                className="text-slate-400 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </label>
          <button
            onClick={onOpenFilters}
            className="tap rounded-2xl bg-white border border-slate-200 grid place-items-center cursor-pointer"
            aria-label={t.map.filtersBtn}
          >
            ⚙
          </button>
        </div>

        <div className="flex gap-2 mt-3 text-sm">
          {(['today', 'tomorrow', 'weekend'] as TimelineFilter[]).map((key) => {
            const active = filters.timeline === key;
            return (
              <button
                key={key}
                onClick={() => onChangeTimeline(active ? 'all' : key)}
                className={`flex-1 h-9 rounded-full font-semibold text-xs cursor-pointer transition ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {t.timeline[key]}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-sb px-4 pt-3 pb-4 space-y-3">
        {events.length === 0 ? (
          <EmptyFilterState lang={lang} onReset={onResetFilters} />
        ) : (
          events.map((ev) => {
            const cat = categories.find((c) => c.id === ev.category_id);
            const live = isEventLiveNow(ev.starts_at, ev.ends_at);
            const dist = haversineKm(refPos[0], refPos[1], ev.lat, ev.lng);

            return (
              <article
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:border-indigo-200 transition"
              >
                <div
                  className="h-28 relative grid place-items-center text-5xl overflow-hidden"
                  style={{
                    background: ev.poster_gradient || 'linear-gradient(135deg,#4F46E5,#0EA5E9)',
                  }}
                >
                  {ev.poster_url ? (
                    <img
                      src={ev.poster_url}
                      alt={ev.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{cat?.icon || '📍'}</span>
                  )}
                  {live && (
                    <span className="absolute top-2 left-2 text-[11px] font-bold text-white bg-emerald-500 rounded-full px-2 py-1">
                      ● {t.map.liveNow}
                    </span>
                  )}
                  {cat && (
                    <span className="absolute top-2 right-2 text-[11px] font-bold text-white bg-black/45 rounded-full px-2 py-1">
                      {lang === 'kz' ? cat.name_kz : cat.name_ru}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-slate-900">{ev.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {ev.address} · {dist} {t.map.km}
                  </p>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="font-semibold text-slate-700">
                      🕖 {formatAlmatyDateTime(ev.starts_at, lang)}
                    </span>
                    <span
                      className={`font-bold rounded-full px-2 py-1 ${
                        ev.price === 0
                          ? 'text-emerald-600 bg-emerald-50'
                          : 'text-slate-700 bg-slate-100'
                      }`}
                    >
                      {ev.price === 0
                        ? `${t.map.free} · 0 ₸`
                        : `${ev.price.toLocaleString('ru-RU')} ₸`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    👥 <b className="text-slate-800 tabular-nums">{ev.attendees_count}</b>{' '}
                    {t.map.goingCount}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
