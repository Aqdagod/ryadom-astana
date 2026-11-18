import React, { useState } from 'react';
import { Event, EventStatus } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { formatAlmatyDateTime } from '../utils/time';

interface MyEventsScreenProps {
  lang: Lang;
  events: Event[];
  onCreateNew: () => void;
  onEditEvent: (event: Event) => void;
  onReturnToDraft: (eventId: string) => void;
  onSubmitForModeration: (eventId: string) => void;
  onCancelEvent: (eventId: string) => void;
  onSelectEvent: (eventId: string) => void;
}

export const MyEventsScreen: React.FC<MyEventsScreenProps> = ({
  lang,
  events,
  onCreateNew,
  onEditEvent,
  onReturnToDraft,
  onSubmitForModeration,
  onCancelEvent,
  onSelectEvent,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');
  const t = TRANSLATIONS[lang].myEvents;

  const visible = events.filter((e) => e.status !== 'cancelled');
  const filtered =
    statusFilter === 'all' ? visible : visible.filter((e) => e.status === statusFilter);

  const countBy = (st: EventStatus) => visible.filter((e) => e.status === st).length;

  const badgeStyle = (st: EventStatus) => {
    if (st === 'rejected') return 'bg-red-50 text-red-600';
    if (st === 'pending_moderation') return 'bg-amber-50 text-amber-700';
    if (st === 'published') return 'bg-emerald-50 text-emerald-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white px-5 pt-2 lg:pt-4 pb-3 border-b border-slate-200 flex-none">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-slate-900 leading-tight">{t.title}</h1>
              <p className="text-[13px] text-slate-500">{t.subtitle}</p>
            </div>
            <button
              onClick={onCreateNew}
              className="h-10 px-4 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer hover:bg-indigo-700 transition"
              aria-label="Создать"
            >
              <span>＋</span>
              <span className="hidden sm:inline">{lang === 'kz' ? 'Оқиға жасау' : 'Создать событие'}</span>
            </button>
          </div>

          <div className="flex gap-2 mt-3 overflow-x-auto no-sb -mx-5 px-5 lg:mx-0 lg:px-0">
            {(
              [
                { id: 'all', label: `${t.all} · ${visible.length}` },
                { id: 'draft', label: `${t.draft} · ${countBy('draft')}` },
                { id: 'pending_moderation', label: `${t.pending_moderation} · ${countBy('pending_moderation')}` },
                { id: 'published', label: `${t.published} · ${countBy('published')}` },
                { id: 'rejected', label: `${t.rejected} · ${countBy('rejected')}` },
              ] as const
            ).map((chip) => (
              <button
                key={chip.id}
                onClick={() => setStatusFilter(chip.id)}
                className={`px-3.5 h-8 rounded-full text-[13px] whitespace-nowrap cursor-pointer transition ${
                  statusFilter === chip.id
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 font-medium'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-sb px-4 py-4 lg:px-6 lg:py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4 items-start">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
            {lang === 'kz' ? 'Бұл санатта оқиғалар жоқ' : 'В этом статусе событий пока нет'}
          </div>
        )}

        {filtered.map((ev) => (
          <article
            key={ev.id}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <h3
                onClick={() => ev.status === 'published' && onSelectEvent(ev.id)}
                className={`text-[15px] font-semibold text-slate-900 leading-snug ${
                  ev.status === 'published' ? 'cursor-pointer hover:text-indigo-600' : ''
                }`}
              >
                {ev.title}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${badgeStyle(
                  ev.status
                )}`}
              >
                {t[ev.status]}
              </span>
            </div>

            <p className="text-[12px] text-slate-500 mt-1">
              🗓 {formatAlmatyDateTime(ev.starts_at, lang)} · 📍 {ev.address}
            </p>

            {ev.status === 'rejected' && ev.rejection_reason && (
              <div className="mt-3 rounded-xl bg-red-50 border border-red-100 p-3 flex gap-2">
                <span className="text-red-500 text-sm leading-5">⚠</span>
                <div>
                  <p className="text-[12px] font-semibold text-red-700">{t.rejectionTitle}</p>
                  <p className="text-[12px] text-red-700/90 leading-snug mt-0.5">
                    {ev.rejection_reason}
                  </p>
                </div>
              </div>
            )}

            {ev.status === 'pending_moderation' && (
              <p className="text-[12px] text-slate-500 mt-2">
                {lang === 'kz'
                  ? 'Модерацияға жіберілді · әдетте 24 сағат ішінде тексереміз'
                  : 'Отправлено на проверку · обычно проверяем до 24 ч'}
              </p>
            )}

            {ev.status === 'published' && (
              <p className="text-[12px] text-slate-500 mt-2">
                👁 {ev.views_count} {t.views} · ★ {ev.favorites_count} {t.inFavs}
              </p>
            )}

            <div className="flex gap-2 mt-3">
              {ev.status === 'rejected' && (
                <button
                  onClick={() => onReturnToDraft(ev.id)}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold cursor-pointer hover:bg-indigo-700 transition"
                >
                  {t.returnDraft}
                </button>
              )}

              {ev.status === 'pending_moderation' && (
                <button
                  onClick={() => onCancelEvent(ev.id)}
                  className="flex-1 h-10 rounded-xl border border-slate-300 text-slate-700 text-[13px] font-semibold cursor-pointer hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
              )}

              {ev.status === 'published' && (
                <>
                  <button
                    onClick={() => onEditEvent(ev)}
                    className="flex-1 h-10 rounded-xl bg-indigo-50 text-indigo-700 text-[13px] font-semibold cursor-pointer hover:bg-indigo-100"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => onCancelEvent(ev.id)}
                    className="flex-1 h-10 rounded-xl border border-slate-300 text-slate-700 text-[13px] font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    {t.cancel}
                  </button>
                </>
              )}

              {ev.status === 'draft' && (
                <>
                  <button
                    onClick={() => onEditEvent(ev)}
                    className="flex-1 h-10 rounded-xl bg-indigo-50 text-indigo-700 text-[13px] font-semibold cursor-pointer"
                  >
                    {t.edit}
                  </button>
                  <button
                    onClick={() => onSubmitForModeration(ev.id)}
                    className="flex-1 h-10 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold cursor-pointer"
                  >
                    {t.sendToMod}
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
        </div>
      </main>
    </div>
  );
};
