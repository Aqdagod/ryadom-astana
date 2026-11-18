import React, { useState } from 'react';
import { Category, Event, Subscription, User } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { formatAlmatyDateTime } from '../utils/time';

interface MySavedScreenProps {
  lang: Lang;
  categories: Category[];
  events: Event[];
  users: User[];
  favoriteEventIds: string[];
  attendingEventIds: string[];
  subscriptions: Subscription[];
  onSelectEvent: (eventId: string) => void;
  onOpenAuthor: (authorId: string) => void;
  onToggleFavorite: (eventId: string) => void;
  onToggleSubscription: (targetType: 'category' | 'author', targetId: string) => void;
}

export const MySavedScreen: React.FC<MySavedScreenProps> = ({
  lang,
  categories,
  events,
  users,
  favoriteEventIds,
  attendingEventIds,
  subscriptions,
  onSelectEvent,
  onOpenAuthor,
  onToggleFavorite,
  onToggleSubscription,
}) => {
  const [tab, setTab] = useState<'favorites' | 'going' | 'subscriptions'>('subscriptions');
  const t = TRANSLATIONS[lang].mySaved;
  const tm = TRANSLATIONS[lang].map;

  const favEvents = events.filter((e) => favoriteEventIds.includes(e.id));
  const goingEvents = events.filter((e) => attendingEventIds.includes(e.id));
  const catSubs = subscriptions.filter((s) => s.target_type === 'category');
  const authorSubs = subscriptions.filter((s) => s.target_type === 'author');

  const renderEventRow = (ev: Event, showHeart: boolean) => {
    const cat = categories.find((c) => c.id === ev.category_id);
    return (
      <div
        key={ev.id}
        onClick={() => onSelectEvent(ev.id)}
        className="flex gap-3 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-200 transition"
      >
        <div
          className="w-16 h-16 rounded-xl flex-none grid place-items-center text-2xl text-white overflow-hidden"
          style={{
            background: ev.poster_gradient || 'linear-gradient(135deg,#4F46E5,#7C3AED)',
          }}
        >
          {ev.poster_url ? (
            <img src={ev.poster_url} alt={ev.title} className="w-full h-full object-cover" />
          ) : (
            cat?.icon || '📍'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{ev.title}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {formatAlmatyDateTime(ev.starts_at, lang)} · {ev.address}
          </p>
          <span
            className={`inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              ev.price === 0
                ? 'text-emerald-700 bg-emerald-50'
                : 'text-slate-700 bg-slate-100'
            }`}
          >
            {ev.price === 0 ? tm.free : `${ev.price.toLocaleString('ru-RU')} ₸`}
          </span>
        </div>
        {showHeart && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(ev.id);
            }}
            className="tap text-indigo-600 text-xl self-center cursor-pointer"
            aria-label="Убрать из избранного"
          >
            ♥
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
      <div className="flex-none bg-white border-b border-slate-100 pb-3">
        <div className="max-w-5xl mx-auto">
          <header className="px-5 pt-2 lg:pt-4 pb-3">
            <h1 className="text-2xl font-extrabold text-slate-900">{t.title}</h1>
          </header>

          <div className="px-5 max-w-md">
            <div className="flex bg-slate-200/70 rounded-2xl p-1">
              {(['favorites', 'going', 'subscriptions'] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`tap flex-1 h-11 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    tab === key
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500'
                  }`}
                >
                  {t[key]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-sb px-5 pt-4 pb-6">
        <div className="max-w-5xl mx-auto space-y-5">
        {tab === 'favorites' && (
          <section>
            {favEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                {lang === 'kz' ? 'Таңдаулы оқиғалар жоқ' : 'В избранном пока пусто'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {favEvents.map((ev) => renderEventRow(ev, true))}
              </div>
            )}
          </section>
        )}

        {tab === 'going' && (
          <section>
            {goingEvents.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                {lang === 'kz' ? 'Сіз әзірге ешбір оқиғаға жазылмадыңыз' : 'Вы пока не отметили «Иду» ни на одном событии'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {goingEvents.map((ev) => renderEventRow(ev, false))}
              </div>
            )}
          </section>
        )}

        {tab === 'subscriptions' && (
          <>
            <section>
              <h2 className="text-sm font-bold text-slate-900 mb-2.5">{t.categories}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catSubs.map((sub) => {
                  const cat = categories.find((c) => c.id === sub.target_id);
                  if (!cat) return null;
                  const count = events.filter((e) => e.status === 'published' && e.category_id === cat.id).length;
                  return (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm"
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: cat.bg_soft }}
                      >
                        {cat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {lang === 'kz' ? cat.name_kz : cat.name_ru}
                        </p>
                        <p className="text-xs text-slate-500">
                          {count} {lang === 'kz' ? 'оқиға жақын маңда' : 'событий рядом'}
                        </p>
                      </div>
                      <button
                        onClick={() => onToggleSubscription('category', cat.id)}
                        className="tap px-3.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                      >
                        {t.unsubscribe}
                      </button>
                    </div>
                  );
                })}
                {catSubs.length === 0 && (
                  <p className="text-xs text-slate-400">
                    {lang === 'kz' ? 'Санаттарға жазылым жоқ' : 'Нет подписок на категории'}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-slate-900 mb-2.5">{t.authors}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {authorSubs.map((sub) => {
                  const author = users.find((u) => u.id === sub.target_id);
                  if (!author) return null;
                  const evCount = events.filter((e) => e.author_id === author.id && e.status === 'published').length;
                  return (
                    <div
                      key={sub.id}
                      onClick={() => onOpenAuthor(author.id)}
                      className="flex items-center gap-3 bg-white rounded-2xl p-3 border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-200 transition"
                    >
                      <div className="w-11 h-11 rounded-full bg-indigo-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {author.avatar_initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{author.name}</p>
                        <p className="text-xs text-slate-500">
                          {evCount} {lang === 'kz' ? 'іс-шара' : 'мероприятий'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSubscription('author', author.id);
                        }}
                        className="tap px-3.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                      >
                        {t.unsubscribe}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-bold text-slate-900 mb-2.5">{t.savedEvents}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {favEvents.map((ev) => renderEventRow(ev, true))}
              </div>
            </section>
          </>
        )}
        </div>
      </div>
    </div>
  );
};
