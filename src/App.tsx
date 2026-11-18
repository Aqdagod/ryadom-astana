import { useEffect, useState } from 'react';
import {
  AppScreen,
  Event,
  EventDraftInput,
  EventFilters,
  PendingAuthAction,
  ReportReason,
  TimelineFilter,
  UserRole,
} from './types/database';
import { Lang, TRANSLATIONS } from './i18n/translations';
import { apiClient, DatabaseState } from './services/apiClient';
import {
  ASTANA_CENTER,
  formatAlmatyDateTime,
  formatAlmatyTime,
  haversineKm,
  isEventLiveNow,
} from './utils/time';
import { AstanaLeafletMap } from './components/AstanaLeafletMap';
import { MapScreen } from './components/MapScreen';
import { ListScreen } from './components/ListScreen';
import { FilterSheet } from './components/FilterSheet';
import { NearbyNowSheet } from './components/NearbyNowSheet';
import { EventDetailScreen } from './components/EventDetailScreen';
import { TelegramAuthModal } from './components/TelegramAuthModal';
import { CreateEventScreen } from './components/CreateEventScreen';
import { MySavedScreen } from './components/MySavedScreen';
import { AuthorProfileScreen } from './components/AuthorProfileScreen';
import { MyEventsScreen } from './components/MyEventsScreen';
import { ModerationScreen } from './components/ModerationScreen';
import { AdminScreen } from './components/AdminScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { EmptyFilterState, SystemStatesScreen } from './components/SystemStates';
import { OfflineIndicator, PWAInstallButton } from './components/PWAComponents';

const DEFAULT_FILTERS: EventFilters = {
  timeline: 'today',
  categoryIds: [],
  freeOnly: false,
  radiusKm: 10,
  search: '',
};

export default function App() {
  const [db, setDb] = useState<DatabaseState>(() => apiClient.getSnapshot());
  const [lang, setLang] = useState<Lang>('ru');
  const [screen, setScreen] = useState<AppScreen>('map');
  const [prevScreen, setPrevScreen] = useState<AppScreen>('map');
  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [showNearbyNow, setShowNearbyNow] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAuthAction | null>(null);

  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeAuthorId, setActiveAuthorId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [nearbyCount, setNearbyCount] = useState(0);
  const [clockTick, setClockTick] = useState(() => formatAlmatyTime(new Date()));

  useEffect(() => {
    const unsub = apiClient.subscribe(() => {
      setDb({ ...apiClient.getSnapshot() });
    });
    void apiClient.runExpirationCron();
    const timer = setInterval(() => {
      setClockTick(formatAlmatyTime(new Date()));
      void apiClient.runExpirationCron();
    }, 30000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const currentUser = db.currentUserId
    ? db.users.find((u) => u.id === db.currentUserId) || null
    : null;
  const currentRole: UserRole = currentUser ? currentUser.role : 'guest';
  const t = TRANSLATIONS[lang];

  const publishedRes = apiClient.getPublishedEvents({
    ...filters,
    userLat: userPosition?.[0],
    userLng: userPosition?.[1],
  });
  const filteredEvents = publishedRes.data || [];

  const nearbyRef = userPosition || ASTANA_CENTER;
  useEffect(() => {
    let active = true;
    void apiClient
      .getNearbyEventsRPC({
        lat: nearbyRef[0],
        lng: nearbyRef[1],
        radiusKm: 5,
        windowHours: 3,
      })
      .then((res) => {
        if (active) setNearbyCount((res.data || []).length);
      });
    return () => {
      active = false;
    };
  }, [nearbyRef[0], nearbyRef[1], db.events.length]);

  const navigate = (next: AppScreen) => {
    setPrevScreen(screen);
    setScreen(next);
  };

  const handleRoleSwitch = async (role: UserRole) => {
    if (role === 'guest') {
      await apiClient.logout();
      if (screen === 'my_events' || screen === 'my_saved' || screen === 'moderation' || screen === 'admin') {
        navigate('map');
      }
      notify(t.roles.guest);
      return;
    }
    if (!currentUser || currentRole !== role) {
      setPendingAction(
        role === 'moderator'
          ? { type: 'navigate', screen: 'moderation' }
          : role === 'admin'
          ? { type: 'navigate', screen: 'admin' }
          : null
      );
      setShowAuthModal(true);
      return;
    }
    if (role === 'moderator') navigate('moderation');
    else if (role === 'admin') navigate('admin');
  };

  const requireAuthThen = (action: PendingAuthAction, fn: () => void) => {
    if (!currentUser) {
      setPendingAction(action);
      setShowAuthModal(true);
      return;
    }
    fn();
  };

  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    const act = pendingAction;
    setPendingAction(null);
    if (!act) return;

    if (act.type === 'attend') {
      const res = await apiClient.toggleAttendance(act.eventId);
      if (!res.error) notify(t.detail.goingActive);
    } else if (act.type === 'favorite') {
      const res = await apiClient.toggleFavorite(act.eventId);
      if (!res.error) notify(t.detail.inFavorites);
    } else if (act.type === 'subscribe') {
      const res = await apiClient.toggleSubscription(act.targetType, act.targetId);
      if (!res.error) notify(t.mySaved.subscribed);
    } else if (act.type === 'create_event') {
      setEditingEvent(null);
      navigate('create_event');
    } else if (act.type === 'navigate') {
      navigate(act.screen);
    }
  };

  const handleOpenEvent = (eventId: string) => {
    setActiveEventId(eventId);
    navigate('event_detail');
  };

  const handleOpenAuthor = (authorId: string) => {
    setActiveAuthorId(authorId);
    navigate('author_profile');
  };

  const handleToggleAttend = (eventId: string) => {
    requireAuthThen({ type: 'attend', eventId }, async () => {
      const res = await apiClient.toggleAttendance(eventId);
      if (res.error) {
        notify(res.error.message);
      } else if (res.data) {
        notify(
          res.data.attending
            ? t.detail.goingActive
            : lang === 'kz'
            ? 'Белгі алынды'
            : 'Отметка «Иду» снята'
        );
      }
    });
  };

  const handleToggleFavorite = (eventId: string) => {
    requireAuthThen({ type: 'favorite', eventId }, async () => {
      const res = await apiClient.toggleFavorite(eventId);
      if (res.error) notify(res.error.message);
    });
  };

  const handleToggleSubscribe = (targetType: 'category' | 'author', targetId: string) => {
    requireAuthThen({ type: 'subscribe', targetType, targetId }, async () => {
      const res = await apiClient.toggleSubscription(targetType, targetId);
      if (res.error) notify(res.error.message);
    });
  };

  const handleSubmitReport = async (
    eventId: string,
    reason: ReportReason,
    comment: string
  ): Promise<{ ok: boolean; errorMessage?: string }> => {
    if (!currentUser) {
      setPendingAction({ type: 'report', eventId });
      setShowAuthModal(true);
      return { ok: false, errorMessage: 'Требуется вход через Telegram' };
    }
    const res = await apiClient.submitReport(eventId, reason, comment);
    if (res.error) {
      return {
        ok: false,
        errorMessage: `${res.error.status} ${res.error.code}: ${res.error.message}`,
      };
    }
    return { ok: true };
  };

  const handleSaveEvent = async (
    input: EventDraftInput,
    submitImmediately: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await apiClient.saveEventDraft(input, submitImmediately);
    if (res.error) {
      return {
        ok: false,
        error: `${res.error.status} ${res.error.code}: ${res.error.message}`,
      };
    }
    setEditingEvent(null);
    navigate('my_events');
    notify(
      submitImmediately
        ? lang === 'kz'
          ? 'Оқиға модерацияға жіберілді'
          : 'Отправлено на модерацию'
        : lang === 'kz'
        ? 'Жоба сақталды'
        : 'Сохранено в черновик'
    );
    return { ok: true };
  };

  const activeEvent = activeEventId
    ? db.events.find((e) => e.id === activeEventId) || null
    : null;
  const activeAuthor = activeAuthorId
    ? db.users.find((u) => u.id === activeAuthorId) || null
    : null;

  const userFavorites = currentUser
    ? db.favorites.filter((f) => f.user_id === currentUser.id).map((f) => f.event_id)
    : [];
  const userAttendances = currentUser
    ? db.attendances.filter((a) => a.user_id === currentUser.id).map((a) => a.event_id)
    : [];
  const userSubscriptions = currentUser
    ? db.subscriptions.filter((s) => s.user_id === currentUser.id)
    : [];
  const userNotifications = currentUser
    ? db.notifications.filter((n) => n.user_id === currentUser.id)
    : [];
  const unreadNotifsCount = userNotifications.filter((n) => !n.is_read).length;

  const myEvents = currentUser ? db.events.filter((e) => e.author_id === currentUser.id) : [];

  const contextEventForAuth = activeEvent?.title;

  const showMobileBottomNav = [
    'list',
    'my_saved',
    'my_events',
    'moderation',
    'admin',
    'profile',
    'system_states',
  ].includes(screen);

  const isModOrAdmin = currentRole === 'moderator' || currentRole === 'admin';
  const activeFiltersCount =
    filters.categoryIds.length +
    (filters.freeOnly ? 1 : 0) +
    (filters.radiusKm !== 10 ? 1 : 0) +
    (filters.search.trim() ? 1 : 0);

  const liveEvent = filteredEvents.find((e) => isEventLiveNow(e.starts_at, e.ends_at));
  const highlightedEvent =
    filteredEvents.find((e) => e.id === selectedPinId) || liveEvent || filteredEvents[0] || null;
  const highlightedCat = highlightedEvent
    ? db.categories.find((c) => c.id === highlightedEvent.category_id)
    : null;
  const pendingModCount = db.events.filter((e) => e.status === 'pending_moderation').length;

  return (
    <div className="h-[100dvh] w-full bg-[#F8FAFC] flex flex-col overflow-hidden">
      {/* Desktop Web App Top Navbar (lg+) */}
      <header className="hidden lg:flex h-16 flex-none bg-white border-b border-slate-200 px-4 xl:px-6 items-center justify-between gap-3 z-30 overflow-x-auto no-sb">
        {/* Brand */}
        <button
          onClick={() => navigate('map')}
          className="flex items-center gap-2.5 cursor-pointer shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white grid place-items-center font-extrabold shadow-sm">
            Р
          </div>
          <div className="text-left">
            <div className="font-bold text-slate-900 leading-none text-base">{t.appName}</div>
            <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums hidden xl:block">
              {t.city} · {clockTick} ({t.timezone})
            </div>
          </div>
        </button>

        {/* Primary Web Navigation */}
        <nav className="flex items-center gap-1 xl:gap-1.5 text-xs xl:text-sm font-semibold shrink-0">
          <button
            onClick={() => navigate('map')}
            className={`px-2.5 xl:px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              screen === 'map' || screen === 'list'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🧭 {lang === 'kz' ? 'Карта және афиша' : 'Карта и афиша'}
          </button>

          <button
            onClick={() =>
              requireAuthThen({ type: 'navigate', screen: 'my_saved' }, () =>
                navigate('my_saved')
              )
            }
            className={`px-2.5 xl:px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              screen === 'my_saved'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            ★ {t.mySaved.title}
          </button>

          <button
            onClick={() =>
              requireAuthThen({ type: 'navigate', screen: 'my_events' }, () =>
                navigate('my_events')
              )
            }
            className={`px-2.5 xl:px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              screen === 'my_events'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            🗂 {t.myEvents.title}
          </button>

          <button
            onClick={() => navigate('moderation')}
            className={`px-2.5 xl:px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              screen === 'moderation'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🛡 {t.moderation.title}</span>
            {pendingModCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold tabular-nums">
                {pendingModCount}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate('admin')}
            className={`px-2.5 xl:px-3 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
              screen === 'admin'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            📡 {t.admin.title}
          </button>
        </nav>

        {/* Right Controls: Create CTA + Role Switcher + RU/KZ + PWA + Profile */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              requireAuthThen({ type: 'create_event' }, () => {
                setEditingEvent(null);
                navigate('create_event');
              })
            }
            className="h-9 px-3 xl:px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer whitespace-nowrap"
          >
            ＋ {lang === 'kz' ? 'Оқиға қосу' : 'Создать событие'}
          </button>

          {/* Compact Role Switcher */}
          <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
            {(['guest', 'user', 'moderator', 'admin'] as UserRole[]).map((role) => {
              const active = currentRole === role;
              return (
                <button
                  key={role}
                  onClick={() => handleRoleSwitch(role)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                    active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.roles[role]}
                </button>
              );
            })}
          </div>

          {/* RU / KZ */}
          <div className="flex bg-[#F8FAFC] rounded-full p-0.5 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setLang('ru')}
              className={`px-2.5 py-1 rounded-full cursor-pointer transition ${
                lang === 'ru' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              RU
            </button>
            <button
              onClick={() => setLang('kz')}
              className={`px-2.5 py-1 rounded-full cursor-pointer transition ${
                lang === 'kz' ? 'bg-indigo-600 text-white' : 'text-slate-600'
              }`}
            >
              KZ
            </button>
          </div>

          <PWAInstallButton lang={lang} />

          <button
            onClick={() => navigate('system_states')}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
              screen === 'system_states'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Экран 12: Системные состояния"
          >
            403 / Empty
          </button>

          <button
            onClick={() => navigate('profile')}
            className={`relative w-9 h-9 rounded-full border grid place-items-center text-xs font-bold cursor-pointer transition ${
              screen === 'profile'
                ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            aria-label={t.nav.profile}
          >
            {currentUser ? currentUser.avatar_initials : '👤'}
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Compact Role Switcher Bar (< lg) */}
      <div className="lg:hidden flex-none w-full bg-white border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-sb z-30">
        <div className="flex items-center gap-1 flex-nowrap">
          {(['guest', 'user', 'moderator', 'admin'] as UserRole[]).map((role) => {
            const active = currentRole === role;
            return (
              <button
                key={role}
                onClick={() => handleRoleSwitch(role)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                  active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {t.roles[role]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton lang={lang} />
          <button
            onClick={() => navigate('system_states')}
            className="px-2 py-1 rounded-lg bg-slate-100 text-[11px] font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
          >
            403 / Empty
          </button>
        </div>
      </div>

      <OfflineIndicator lang={lang} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full">
        {/* DESKTOP SPLIT-SCREEN VIEW FOR MAP & LIST (lg+) */}
        {(screen === 'map' || screen === 'list') && (
          <div className="hidden lg:flex flex-1 overflow-hidden w-full">
            {/* Left Sidebar: Search, Filters, What's Nearby CTA, and Scrollable Events List */}
            <aside className="w-[440px] xl:w-[480px] flex-none bg-[#F8FAFC] border-r border-slate-200 flex flex-col overflow-hidden">
              <div className="bg-white px-5 pt-4 pb-3 border-b border-slate-200 flex-none space-y-3">
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 h-11 px-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-sm focus-within:border-indigo-500">
                    <span>🔍</span>
                    <input
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder={t.list.searchPlaceholder}
                      className="bg-transparent outline-none w-full text-slate-900 placeholder-slate-400"
                    />
                    {filters.search && (
                      <button
                        onClick={() => setFilters({ ...filters, search: '' })}
                        className="text-slate-400 text-xs font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </label>

                  <button
                    onClick={() => setShowFilters(true)}
                    className="h-11 px-3.5 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-700 text-xs flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    <span>⚙</span>
                    <span>{t.map.filtersBtn}</span>
                    {activeFiltersCount > 0 && (
                      <span className="bg-indigo-600 text-white text-[10px] rounded-full px-1.5 py-0.5">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Timeline tabs */}
                <div className="flex gap-2">
                  {(['today', 'tomorrow', 'weekend'] as TimelineFilter[]).map((key) => {
                    const active = filters.timeline === key;
                    return (
                      <button
                        key={key}
                        onClick={() =>
                          setFilters({ ...filters, timeline: active ? 'all' : key })
                        }
                        className={`flex-1 h-9 rounded-full text-xs font-semibold transition cursor-pointer ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {t.timeline[key]}
                      </button>
                    );
                  })}
                </div>

                {/* What's Nearby Now CTA */}
                <button
                  onClick={() => setShowNearbyNow(true)}
                  className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  {t.map.whatNearNow} · {nearbyCount} {t.map.eventsCount}
                </button>
              </div>

              {/* Scrollable Events Feed */}
              <div className="flex-1 overflow-y-auto no-sb p-4 space-y-3">
                {filteredEvents.length === 0 ? (
                  <EmptyFilterState lang={lang} onReset={() => setFilters(DEFAULT_FILTERS)} />
                ) : (
                  filteredEvents.map((ev) => {
                    const cat = db.categories.find((c) => c.id === ev.category_id);
                    const live = isEventLiveNow(ev.starts_at, ev.ends_at);
                    const refPos = userPosition || ASTANA_CENTER;
                    const dist = haversineKm(refPos[0], refPos[1], ev.lat, ev.lng);
                    const isSelected = highlightedEvent?.id === ev.id;

                    return (
                      <article
                        key={ev.id}
                        onMouseEnter={() => setSelectedPinId(ev.id)}
                        onClick={() => handleOpenEvent(ev.id)}
                        className={`bg-white rounded-2xl shadow-sm border overflow-hidden cursor-pointer transition flex gap-3 p-3 ${
                          isSelected
                            ? 'border-indigo-400 ring-2 ring-indigo-100'
                            : 'border-slate-200/80 hover:border-indigo-300'
                        }`}
                      >
                        <div
                          className="w-24 h-24 rounded-xl flex-none relative grid place-items-center text-3xl text-white overflow-hidden"
                          style={{
                            background:
                              ev.poster_gradient || 'linear-gradient(135deg,#4F46E5,#0EA5E9)',
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
                            <span className="absolute top-1.5 left-1.5 text-[9px] font-bold text-white bg-emerald-500 rounded-full px-1.5 py-0.5">
                              ● LIVE
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-indigo-600 truncate">
                                {cat ? `${cat.icon} ${lang === 'kz' ? cat.name_kz : cat.name_ru}` : ''}
                              </span>
                              <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                                {dist} {t.map.km}
                              </span>
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug mt-0.5 line-clamp-1">
                              {ev.title}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5 truncate">{ev.address}</p>
                          </div>

                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className="font-semibold text-slate-700">
                              🕖 {formatAlmatyDateTime(ev.starts_at, lang)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500">
                                👥 <b className="text-slate-800 tabular-nums">{ev.attendees_count}</b>
                              </span>
                              <span
                                className={`font-bold rounded-full px-2 py-0.5 text-[11px] ${
                                  ev.price === 0
                                    ? 'text-emerald-700 bg-emerald-50'
                                    : 'text-slate-700 bg-slate-100'
                                }`}
                              >
                                {ev.price === 0 ? t.map.free : `${ev.price} ₸`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Full-Height Interactive Leaflet Map */}
            <div className="flex-1 relative h-full bg-[#e8eef3]">
              <AstanaLeafletMap
                mode="main"
                events={filteredEvents}
                categories={db.categories}
                selectedEventId={highlightedEvent?.id}
                onSelectEvent={(id) => setSelectedPinId(id)}
                userPosition={userPosition}
                className="w-full h-full"
              />

              {/* Floating Selected Event Card on Desktop Map */}
              {highlightedEvent && (
                <div className="absolute left-6 bottom-6 z-20 w-[360px]">
                  <button
                    onClick={() => handleOpenEvent(highlightedEvent.id)}
                    className="w-full bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-slate-200 p-3.5 flex items-center gap-3 text-left cursor-pointer hover:border-indigo-400 transition"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex-none grid place-items-center text-2xl text-white"
                      style={{
                        background:
                          highlightedEvent.poster_gradient ||
                          'linear-gradient(135deg,#4F46E5,#0EA5E9)',
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
                    <span className="text-indigo-600 font-bold text-base flex-none">→</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MOBILE VIEW FOR MAP & LIST (< lg) */}
        {screen === 'map' && (
          <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
            <MapScreen
              lang={lang}
              onChangeLang={setLang}
              events={filteredEvents}
              categories={db.categories}
              filters={filters}
              selectedPinId={selectedPinId}
              userPosition={userPosition}
              nearbyCount={nearbyCount}
              unreadNotifications={unreadNotifsCount}
              currentUser={currentUser}
              role={currentRole}
              onSelectPin={(id) => setSelectedPinId(id)}
              onOpenEvent={handleOpenEvent}
              onChangeTimeline={(timeline) => setFilters({ ...filters, timeline })}
              onOpenList={() => navigate('list')}
              onOpenFilters={() => setShowFilters(true)}
              onOpenCreate={() =>
                requireAuthThen({ type: 'create_event' }, () => {
                  setEditingEvent(null);
                  navigate('create_event');
                })
              }
              onOpenNearbyNow={() => setShowNearbyNow(true)}
              onOpenProfile={() => navigate('profile')}
              onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            />
          </div>
        )}

        {screen === 'list' && (
          <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
            <ListScreen
              lang={lang}
              onChangeLang={setLang}
              events={filteredEvents}
              categories={db.categories}
              filters={filters}
              userPosition={userPosition}
              onChangeSearch={(search) => setFilters({ ...filters, search })}
              onChangeTimeline={(timeline) => setFilters({ ...filters, timeline })}
              onOpenFilters={() => setShowFilters(true)}
              onSelectEvent={handleOpenEvent}
              onBackToMap={() => navigate('map')}
              onResetFilters={() => setFilters(DEFAULT_FILTERS)}
            />
          </div>
        )}

        {/* SHARED RESPONSIVE SCREENS (Mobile & Desktop) */}
        {screen === 'event_detail' && activeEvent && (
          <EventDetailScreen
            event={activeEvent}
            category={db.categories.find((c) => c.id === activeEvent.category_id)}
            author={db.users.find((u) => u.id === activeEvent.author_id)}
            authorEventsCount={
              db.events.filter(
                (e) => e.author_id === activeEvent.author_id && e.status === 'published'
              ).length
            }
            lang={lang}
            isAttending={userAttendances.includes(activeEvent.id)}
            isFavorited={userFavorites.includes(activeEvent.id)}
            onBack={() => navigate(prevScreen === 'event_detail' ? 'map' : prevScreen)}
            onOpenAuthor={handleOpenAuthor}
            onToggleAttend={() => handleToggleAttend(activeEvent.id)}
            onToggleFavorite={() => handleToggleFavorite(activeEvent.id)}
            onSubmitReport={(reason, comment) =>
              handleSubmitReport(activeEvent.id, reason, comment)
            }
          />
        )}

        {screen === 'create_event' && (
          <CreateEventScreen
            lang={lang}
            categories={db.categories}
            editingEvent={editingEvent}
            onBack={() => navigate(editingEvent ? 'my_events' : 'map')}
            onSave={handleSaveEvent}
          />
        )}

        {screen === 'my_saved' && (
          <MySavedScreen
            lang={lang}
            categories={db.categories}
            events={db.events}
            users={db.users}
            favoriteEventIds={userFavorites}
            attendingEventIds={userAttendances}
            subscriptions={userSubscriptions}
            onSelectEvent={handleOpenEvent}
            onOpenAuthor={handleOpenAuthor}
            onToggleFavorite={handleToggleFavorite}
            onToggleSubscription={handleToggleSubscribe}
          />
        )}

        {screen === 'author_profile' && activeAuthor && (
          <AuthorProfileScreen
            author={activeAuthor}
            events={db.events}
            categories={db.categories}
            lang={lang}
            isSubscribed={userSubscriptions.some(
              (s) => s.target_type === 'author' && s.target_id === activeAuthor.id
            )}
            onBack={() => navigate(activeEventId ? 'event_detail' : 'map')}
            onToggleSubscribe={() => handleToggleSubscribe('author', activeAuthor.id)}
            onSelectEvent={handleOpenEvent}
          />
        )}

        {screen === 'my_events' && (
          <MyEventsScreen
            lang={lang}
            events={myEvents}
            onCreateNew={() =>
              requireAuthThen({ type: 'create_event' }, () => {
                setEditingEvent(null);
                navigate('create_event');
              })
            }
            onEditEvent={(ev) => {
              setEditingEvent(ev);
              navigate('create_event');
            }}
            onReturnToDraft={async (id) => {
              const r = await apiClient.returnRejectedToDraft(id);
              if (r.error) notify(r.error.message);
              else notify(lang === 'kz' ? 'Жобаға қайтарылды' : 'Возвращено в черновик');
            }}
            onSubmitForModeration={async (id) => {
              const r = await apiClient.submitDraftToModeration(id);
              if (r.error) notify(r.error.message);
              else notify(lang === 'kz' ? 'Модерацияға жіберілді' : 'Отправлено на модерацию');
            }}
            onCancelEvent={async (id) => {
              const r = await apiClient.cancelMyEvent(id);
              if (r.error) notify(r.error.message);
              else notify(lang === 'kz' ? 'Оқиға тоқтатылды' : 'Событие отменено');
            }}
            onSelectEvent={handleOpenEvent}
          />
        )}

        {screen === 'moderation' && (
          <ModerationScreen
            lang={lang}
            role={currentRole}
            categories={db.categories}
            events={db.events}
            reports={db.reports}
            onGoHome={() => navigate('map')}
            onBack={() => navigate('profile')}
            onNotify={(msg) => {
              setFilters((f) => ({ ...f, timeline: 'all' }));
              notify(msg);
            }}
          />
        )}

        {screen === 'admin' && (
          <AdminScreen
            lang={lang}
            onGoHome={() => navigate('map')}
            onBack={() => navigate('profile')}
            onNotify={notify}
          />
        )}

        {screen === 'profile' && (
          <ProfileScreen
            lang={lang}
            user={currentUser}
            role={currentRole}
            notifications={userNotifications}
            onNavigate={(sc) => {
              if ((sc === 'my_events' || sc === 'my_saved') && !currentUser) {
                requireAuthThen({ type: 'navigate', screen: sc }, () => navigate(sc));
                return;
              }
              navigate(sc);
            }}
            onOpenAuth={() => {
              setPendingAction(null);
              setShowAuthModal(true);
            }}
            onLogout={async () => {
              await apiClient.logout();
              notify(lang === 'kz' ? 'Шықтыңыз' : 'Вы вышли из аккаунта');
            }}
            onMarkNotificationsRead={() => void apiClient.markNotificationsRead()}
            onSelectEvent={handleOpenEvent}
          />
        )}

        {screen === 'system_states' && (
          <SystemStatesScreen
            lang={lang}
            onResetFilters={() => {
              setFilters(DEFAULT_FILTERS);
              navigate('map');
            }}
            onExpandRadius={() => {
              setFilters({ ...filters, radiusKm: 10 });
              setShowNearbyNow(true);
              navigate('map');
            }}
            onCreateEvent={() =>
              requireAuthThen({ type: 'create_event' }, () => {
                setEditingEvent(null);
                navigate('create_event');
              })
            }
            onHome={() => navigate('map')}
            onBack={() => navigate('map')}
          />
        )}

        {/* Mobile Bottom Navigation Bar (< lg) */}
        {showMobileBottomNav && (
          <nav className="lg:hidden flex-none h-[64px] bg-white border-t border-slate-200 grid grid-cols-4 text-[11px] font-medium text-slate-500">
            <button
              onClick={() => navigate('map')}
              className="flex flex-col items-center justify-center gap-0.5 cursor-pointer hover:text-indigo-600"
            >
              <span className="text-lg">🧭</span>
              <span>{t.nav.map}</span>
            </button>

            {isModOrAdmin ? (
              <>
                <button
                  onClick={() => navigate('moderation')}
                  className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    screen === 'moderation' ? 'text-indigo-600 font-bold' : ''
                  }`}
                >
                  <span className="text-lg">🛡</span>
                  <span>{t.nav.queue}</span>
                </button>
                <button
                  onClick={() => navigate('admin')}
                  className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    screen === 'admin' ? 'text-indigo-600 font-bold' : ''
                  }`}
                >
                  <span className="text-lg">📡</span>
                  <span>{t.nav.sources}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() =>
                    requireAuthThen({ type: 'navigate', screen: 'my_saved' }, () =>
                      navigate('my_saved')
                    )
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    screen === 'my_saved' ? 'text-indigo-600 font-bold' : ''
                  }`}
                >
                  <span className="text-lg">★</span>
                  <span>{t.nav.favorites}</span>
                </button>
                <button
                  onClick={() =>
                    requireAuthThen({ type: 'navigate', screen: 'my_events' }, () =>
                      navigate('my_events')
                    )
                  }
                  className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                    screen === 'my_events' ? 'text-indigo-600 font-bold' : ''
                  }`}
                >
                  <span className="text-lg">🗂</span>
                  <span>{t.nav.my}</span>
                </button>
              </>
            )}

            <button
              onClick={() => navigate('profile')}
              className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                screen === 'profile' ? 'text-indigo-600 font-bold' : ''
              }`}
            >
              <span className="text-lg">👤</span>
              <span>{t.nav.profile}</span>
            </button>
          </nav>
        )}
      </div>

      {/* Responsive Overlays (Bottom Sheet on Mobile, Centered Modal on Desktop) */}
      <FilterSheet
        open={showFilters}
        lang={lang}
        filters={filters}
        categories={db.categories}
        matchedCount={filteredEvents.length}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        onClose={() => setShowFilters(false)}
      />

      <NearbyNowSheet
        open={showNearbyNow}
        lang={lang}
        categories={db.categories}
        userPosition={userPosition}
        onUpdatePosition={(coords) => setUserPosition(coords)}
        onSelectEvent={handleOpenEvent}
        onCreateEvent={() =>
          requireAuthThen({ type: 'create_event' }, () => {
            setEditingEvent(null);
            navigate('create_event');
          })
        }
        onClose={() => setShowNearbyNow(false)}
      />

      <TelegramAuthModal
        open={showAuthModal}
        lang={lang}
        contextEventTitle={contextEventForAuth}
        onSuccess={handleAuthSuccess}
        onClose={() => {
          setShowAuthModal(false);
          setPendingAction(null);
        }}
      />

      {/* Global Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[340px] bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl whitespace-nowrap truncate">
          {toast}
        </div>
      )}
    </div>
  );
}
