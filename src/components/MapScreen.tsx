import React from 'react';
import { Category, Event, EventFilters, TimelineFilter, User, UserRole } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { formatAlmatyTime, isEventLiveNow } from '../utils/time';
import { AstanaLeafletMap } from './AstanaLeafletMap';
import { EmptyFilterState } from './SystemStates';

interface MapScreenProps {
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  events: Event[];
  categories: Category[];
  filters: EventFilters;
  selectedPinId: string | null;
  userPosition: [number, number] | null;
  nearbyCount: number;
  unreadNotifications: number;
  currentUser: User | null;
  role: UserRole;
  onSelectPin: (eventId: string) => void;
  onOpenEvent: (eventId: string) => void;
  onChangeTimeline: (timeline: TimelineFilter) => void;
  onOpenList: () => void;
  onOpenFilters: () => void;
  onOpenCreate: () => void;
  onOpenNearbyNow: () => void;
  onOpenProfile: () => void;
  onResetFilters: () => void;
}

export const MapScreen: React.FC<MapScreenProps> = ({
  lang,
  onChangeLang,
  events,
  categories,
  filters,
  selectedPinId,
  userPosition,
  nearbyCount,
  unreadNotifications,
  currentUser,
  onSelectPin,
  onOpenEvent,
  onChangeTimeline,
  onOpenList,
  onOpenFilters,
  onOpenCreate,
  onOpenNearbyNow,
  onOpenProfile,
  onResetFilters,
}) => {
  const t = TRANSLATIONS[lang];
  const activeFiltersCount =
    filters.categoryIds.length +
    (filters.freeOnly ? 1 : 0) +
    (filters.radiusKm !== 10 ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  const liveEvent = events.find((e) => isEventLiveNow(e.starts_at, e.ends_at));
  const highlightedEvent =
    events.find((e) => e.id === selectedPinId) || liveEvent || events[0] || null;
  const highlightedCat = highlightedEvent
    ? categories.find((c) => c.id === highlightedEvent.category_id)
    : null;

  const nowTime = formatAlmatyTime(new Date());

  return (
    <div className="flex-1 relative overflow-hidden bg-[#e8eef3]">
      {/* Real Interactive Astana OpenStreetMap */}
      <AstanaLeafletMap
        mode="main"
        events={events}
        categories={categories}
        selectedEventId={highlightedEvent?.id}
        onSelectEvent={(id) => onSelectPin(id)}
        userPosition={userPosition}
        className="w-full h-full"
      />

      {/* Top Overlay Header (matching part1.html) */}
      <header
        className="absolute top-0 inset-x-0 px-4 pt-3 pb-3 z-20 pointer-events-none"
        style={{ background: 'linear-gradient(#ffffff 72%, rgba(255,255,255,0))' }}
      >
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-extrabold shadow-sm flex-none">
              Р
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 leading-none text-[15px]">
                {t.appName}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 truncate">
                {t.city} · {t.timeline.today}, {nowTime} ({t.timezone})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-none">
            <div className="flex bg-[#F8FAFC] rounded-full p-0.5 border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => onChangeLang('ru')}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition ${
                  lang === 'ru' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                }`}
              >
                RU
              </button>
              <button
                onClick={() => onChangeLang('kz')}
                className={`px-2.5 py-1 rounded-full cursor-pointer transition ${
                  lang === 'kz' ? 'bg-indigo-600 text-white' : 'text-slate-600'
                }`}
              >
                KZ
              </button>
            </div>
            <button
              onClick={onOpenProfile}
              className="relative w-10 h-10 rounded-full bg-white border border-slate-200 grid place-items-center text-sm shadow-sm cursor-pointer"
              aria-label={t.nav.profile}
            >
              {currentUser ? (
                <span className="text-xs font-bold text-indigo-700">
                  {currentUser.avatar_initials}
                </span>
              ) : (
                '👤'
              )}
              {unreadNotifications > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
              )}
            </button>
          </div>
        </div>

        {/* Timeline Tabs */}
        <div className="flex gap-2 mt-2.5 pointer-events-auto" role="tablist">
          {(['today', 'tomorrow', 'weekend'] as TimelineFilter[]).map((key) => {
            const active = filters.timeline === key;
            return (
              <button
                key={key}
                onClick={() => onChangeTimeline(active ? 'all' : key)}
                className={`flex-1 h-9 rounded-full text-xs font-semibold transition cursor-pointer ${
                  active
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-white text-slate-700 border border-slate-200 shadow-sm'
                }`}
              >
                {t.timeline[key]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Highlighted / Selected Event Floating Card OR Empty Filter State */}
      {events.length === 0 ? (
        <div className="absolute inset-x-4 top-36 z-20">
          <EmptyFilterState lang={lang} onReset={onResetFilters} />
        </div>
      ) : (
        highlightedEvent && (
          <button
            onClick={() => onOpenEvent(highlightedEvent.id)}
            className="absolute left-4 right-4 bottom-40 z-20 bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-slate-100 p-3 flex items-center gap-3 text-left cursor-pointer hover:border-indigo-300 transition"
          >
            <div
              className="w-11 h-11 rounded-xl flex-none grid place-items-center text-xl text-white"
              style={{
                background:
                  highlightedEvent.poster_gradient || 'linear-gradient(135deg,#4F46E5,#0EA5E9)',
              }}
            >
              {highlightedCat?.icon || '📍'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isEventLiveNow(highlightedEvent.starts_at, highlightedEvent.ends_at) && (
                  <span className="inline-block text-[10px] font-bold text-white bg-emerald-500 rounded-full px-2 py-0.5">
                    {t.map.liveNow}
                  </span>
                )}
                <span className="text-[11px] font-semibold text-emerald-700">
                  {highlightedEvent.price === 0
                    ? `${t.map.free} · 0 ₸`
                    : `${highlightedEvent.price} ₸`}
                </span>
              </div>
              <div className="font-bold text-slate-900 text-sm truncate mt-0.5">
                {highlightedEvent.title}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {highlightedEvent.address}
              </div>
            </div>
            <span className="text-indigo-600 font-bold text-sm flex-none">→</span>
          </button>
        )
      )}

      {/* Bottom Floating Action Bar (matching part1.html) */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5 pt-10 pointer-events-none"
        style={{ background: 'linear-gradient(rgba(255,255,255,0), #ffffff 60%)' }}
      >
        <div className="flex gap-2 mb-2.5 pointer-events-auto">
          <button
            onClick={onOpenList}
            className="tap flex-1 h-12 rounded-2xl bg-white border border-slate-200 shadow font-semibold text-slate-800 text-sm cursor-pointer hover:bg-slate-50 transition"
          >
            ☰ {t.map.listBtn}
          </button>
          <button
            onClick={onOpenFilters}
            className="tap flex-1 h-12 rounded-2xl bg-white border border-slate-200 shadow font-semibold text-slate-800 text-sm cursor-pointer hover:bg-slate-50 transition"
          >
            ⚙ {t.map.filtersBtn}{' '}
            {activeFiltersCount > 0 && (
              <span className="ml-1 bg-indigo-600 text-white text-[11px] rounded-full px-1.5 py-0.5">
                {activeFiltersCount}
              </span>
            )}
          </button>
          <button
            onClick={onOpenCreate}
            className="tap w-12 h-12 rounded-2xl bg-indigo-600 text-white text-2xl shadow cursor-pointer hover:bg-indigo-700 transition"
            aria-label="Добавить событие"
          >
            ＋
          </button>
        </div>

        <button
          onClick={onOpenNearbyNow}
          className="tap pointer-events-auto w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold text-[15px] shadow-lg shadow-indigo-300 flex items-center justify-center gap-2 cursor-pointer hover:bg-indigo-700 transition"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          {t.map.whatNearNow} · {nearbyCount} {t.map.eventsCount}
        </button>
      </div>
    </div>
  );
};
