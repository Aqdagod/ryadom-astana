import React from 'react';
import { Category, Event, User } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { formatAlmatyDateTime } from '../utils/time';

interface AuthorProfileScreenProps {
  author: User;
  events: Event[];
  categories: Category[];
  lang: Lang;
  isSubscribed: boolean;
  onBack: () => void;
  onToggleSubscribe: () => void;
  onSelectEvent: (eventId: string) => void;
}

export const AuthorProfileScreen: React.FC<AuthorProfileScreenProps> = ({
  author,
  events,
  categories,
  lang,
  isSubscribed,
  onBack,
  onToggleSubscribe,
  onSelectEvent,
}) => {
  const t = TRANSLATIONS[lang].authorPage;
  const ts = TRANSLATIONS[lang].mySaved;
  const tm = TRANSLATIONS[lang].map;

  const upcomingEvents = events.filter(
    (e) => e.author_id === author.id && e.status === 'published'
  );

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
      <header className="flex items-center px-2 lg:px-6 lg:pt-3 flex-none">
        <div className="max-w-4xl mx-auto w-full flex items-center">
          <button
            onClick={onBack}
            className="tap rounded-full text-slate-800 text-xl cursor-pointer"
            aria-label="Назад"
          >
            ←
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-sb pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="px-5 pt-2 flex flex-col items-center text-center max-w-lg mx-auto">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-600 to-emerald-500 text-white text-3xl font-extrabold flex items-center justify-center ring-4 ring-white shadow-md">
              {author.avatar_initials}
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-4">{author.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {(lang === 'kz' ? author.bio_kz : author.bio_ru) || 'Организатор мероприятий · Астана'}
            </p>

            <div className="flex gap-3 mt-5 w-full">
              <div className="flex-1 bg-white rounded-2xl py-3 border border-slate-100 shadow-sm">
                <p className="text-xl font-bold text-indigo-600 tabular-nums">
                  {Math.max(12, upcomingEvents.length * 6)}
                </p>
                <p className="text-xs text-slate-500">{t.conducted}</p>
              </div>
              <div className="flex-1 bg-white rounded-2xl py-3 border border-slate-100 shadow-sm">
                <p className="text-xl font-bold text-emerald-600 tabular-nums">
                  {upcomingEvents.length}
                </p>
                <p className="text-xs text-slate-500">{t.upcoming}</p>
              </div>
            </div>

            <button
              onClick={onToggleSubscribe}
              className={`tap w-full h-14 rounded-2xl font-semibold text-base mt-4 transition cursor-pointer ${
                isSubscribed
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                  : 'bg-indigo-600 text-white shadow-md shadow-indigo-200 hover:bg-indigo-700'
              }`}
            >
              {isSubscribed ? ts.subscribed : ts.subscribe}
            </button>
          </div>

          <section className="px-5 mt-6">
            <h2 className="text-base font-bold text-slate-900 mb-3">{t.upcomingTitle}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingEvents.map((ev) => {
                const cat = categories.find((c) => c.id === ev.category_id);
                return (
                  <article
                    key={ev.id}
                    onClick={() => onSelectEvent(ev.id)}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm cursor-pointer hover:border-indigo-200 transition"
                  >
                    <div
                      className="h-24 relative flex items-center justify-center text-4xl"
                      style={{
                        background: ev.poster_gradient || 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                      }}
                    >
                      {cat?.icon}
                      {cat && (
                        <span className="absolute top-3 left-3 text-[11px] font-semibold bg-white/90 text-indigo-600 px-2.5 py-1 rounded-full">
                          {lang === 'kz' ? cat.name_kz : cat.name_ru}
                        </span>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="text-sm font-bold text-slate-900">{ev.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatAlmatyDateTime(ev.starts_at, lang)} · {ev.address}
                      </p>
                      <span
                        className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          ev.price === 0
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-slate-700 bg-slate-100'
                        }`}
                      >
                        {ev.price === 0 ? tm.free : `${ev.price.toLocaleString('ru-RU')} ₸`}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
