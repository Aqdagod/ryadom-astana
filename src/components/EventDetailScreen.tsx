import React, { useState } from 'react';
import { Category, Event, ReportReason, User } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { formatAlmatyDateTime, formatAlmatyTime, isEventLiveNow } from '../utils/time';
import { AstanaLeafletMap } from './AstanaLeafletMap';

interface EventDetailScreenProps {
  event: Event;
  category?: Category;
  author?: User;
  authorEventsCount: number;
  lang: Lang;
  isAttending: boolean;
  isFavorited: boolean;
  onBack: () => void;
  onOpenAuthor: (authorId: string) => void;
  onToggleAttend: () => void;
  onToggleFavorite: () => void;
  onSubmitReport: (reason: ReportReason, comment: string) => Promise<{ ok: boolean; errorMessage?: string }>;
}

export const EventDetailScreen: React.FC<EventDetailScreenProps> = ({
  event,
  category,
  author,
  authorEventsCount,
  lang,
  isAttending,
  isFavorited,
  onBack,
  onOpenAuthor,
  onToggleAttend,
  onToggleFavorite,
  onSubmitReport,
}) => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('wrong_info');
  const [reportComment, setReportComment] = useState('');
  const [reportMsg, setReportMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const t = TRANSLATIONS[lang].detail;
  const tm = TRANSLATIONS[lang].map;
  const live = isEventLiveNow(event.starts_at, event.ends_at);

  const handleShare = () => {
    const shareText = `${event.title} — ${formatAlmatyDateTime(event.starts_at, lang)}, ${event.address}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
    setToast(t.copied);
    setTimeout(() => setToast(null), 2200);
  };

  const handleReportSubmit = async () => {
    const res = await onSubmitReport(reportReason, reportComment);
    if (!res.ok) {
      setReportMsg({ type: 'err', text: res.errorMessage || '409 DUPLICATE_ENTRY' });
    } else {
      setReportMsg({
        type: 'ok',
        text: lang === 'kz' ? 'Шағым модерацияға жіберілді' : 'Жалоба отправлена на модерацию',
      });
      setTimeout(() => {
        setShowReportModal(false);
        setReportMsg(null);
        setReportComment('');
      }, 1200);
    }
  };

  const twoGisUrl = `https://2gis.kz/astana/geo/${event.lng}%2C${event.lat}`;
  const osrmUrl = `https://map.project-osrm.org/?z=14&center=${event.lat}%2C${event.lng}&loc=51.128%2C71.430&loc=${event.lat}%2C${event.lng}`;

  const actionButtons = (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={onToggleAttend}
          className={`tap flex-1 h-12 rounded-2xl font-bold shadow-lg transition cursor-pointer ${
            isAttending
              ? 'bg-emerald-500 text-white shadow-emerald-200'
              : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
          }`}
        >
          {isAttending ? t.goingActive : t.going}
        </button>
        <button
          onClick={() => setShowRouteModal(true)}
          className="tap flex-[1.4] h-12 rounded-2xl bg-white border-2 border-indigo-600 text-indigo-600 font-bold text-xs sm:text-sm cursor-pointer hover:bg-indigo-50 transition"
        >
          🧭 {t.route} (2ГИС/OSRM)
        </button>
      </div>
      <div className="flex gap-2 text-xs font-semibold text-slate-700">
        <button
          onClick={handleShare}
          className="tap flex-1 rounded-xl bg-[#F8FAFC] border border-slate-200 cursor-pointer hover:bg-slate-100"
        >
          ⤴ {t.share}
        </button>
        <button
          onClick={onToggleFavorite}
          className={`tap flex-1 rounded-xl border cursor-pointer transition ${
            isFavorited
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-[#F8FAFC] border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          {isFavorited ? t.inFavorites : `♡ ${t.toFavorites}`}
        </button>
        <button
          onClick={() => setShowReportModal(true)}
          className="tap flex-1 rounded-xl bg-[#F8FAFC] border border-slate-200 text-red-500 cursor-pointer hover:bg-red-50"
        >
          ⚑ {t.report}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-white lg:bg-[#F8FAFC] relative overflow-hidden">
      <div className="flex-1 overflow-y-auto no-sb pb-32 lg:pb-10">
        <div className="lg:max-w-5xl lg:mx-auto lg:px-6 lg:pt-6">
          {/* Desktop Back Bar */}
          <div className="hidden lg:flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              ← {lang === 'kz' ? 'Артқа' : 'Назад к событиям'}
            </button>
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              ⤴ {t.share}
            </button>
          </div>

          <div className="lg:grid lg:grid-cols-[1.25fr_0.95fr] lg:gap-6 lg:items-start">
            {/* Left Column: Poster & Info */}
            <div className="bg-white lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm lg:overflow-hidden">
              <div
                className="relative h-56 lg:h-72 grid place-items-center text-7xl overflow-hidden"
                style={{
                  background: event.poster_gradient || 'linear-gradient(135deg,#4F46E5,#0EA5E9)',
                }}
              >
                {event.poster_url ? (
                  <img
                    src={event.poster_url}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{category?.icon || '📍'}</span>
                )}

                <button
                  onClick={onBack}
                  className="lg:hidden tap absolute top-4 left-4 rounded-full bg-white/90 grid place-items-center text-lg shadow cursor-pointer"
                  aria-label="Назад"
                >
                  ←
                </button>
                <button
                  onClick={handleShare}
                  className="lg:hidden tap absolute top-4 right-4 rounded-full bg-white/90 grid place-items-center text-lg shadow cursor-pointer"
                  aria-label={t.share}
                >
                  ⤴
                </button>

                {live && (
                  <span className="absolute bottom-3 left-4 text-xs font-bold text-white bg-emerald-500 rounded-full px-3 py-1 shadow">
                    ● {tm.liveNow}
                  </span>
                )}
              </div>

              <div className="px-5 pt-4 pb-5 lg:p-6">
                <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                  {category && (
                    <span
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: category.bg_soft, color: category.text_color }}
                    >
                      {category.icon} {lang === 'kz' ? category.name_kz : category.name_ru}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 ${
                      event.price === 0
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {event.price === 0
                      ? `${tm.free} · 0 ₸`
                      : `${event.price.toLocaleString('ru-RU')} ₸`}
                  </span>
                </div>

                <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900 mt-2.5 leading-tight">
                  {event.title}
                </h1>
                <p className="text-sm text-slate-500 mt-1.5">
                  🕖 {formatAlmatyDateTime(event.starts_at, lang)}–{formatAlmatyTime(event.ends_at)} (Asia/Almaty)
                </p>
                <p className="text-sm lg:text-[15px] text-slate-700 mt-3 leading-relaxed">
                  {event.description}
                </p>

                {/* Author & Source */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 gap-2">
                  <button
                    onClick={() => author && onOpenAuthor(author.id)}
                    className="tap flex items-center gap-2.5 text-left cursor-pointer"
                  >
                    <span className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 grid place-items-center font-bold text-sm flex-none">
                      {author?.avatar_initials || 'АВ'}
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-indigo-600 underline">
                        {author?.name || 'Организатор'}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {t.authorLabel} · {authorEventsCount} {t.eventsLabel}
                      </span>
                    </span>
                  </button>

                  {event.source_url && (
                    <a
                      href={event.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="tap flex items-center text-xs font-semibold text-indigo-600 underline whitespace-nowrap"
                    >
                      {event.source_url.replace('https://', '')} ↗
                    </a>
                  )}
                </div>

                <p className="text-sm text-slate-600 mt-3 lg:hidden">
                  👥 <b className="text-slate-900 tabular-nums">{event.attendees_count}</b> {t.peopleGoing}
                </p>
              </div>
            </div>

            {/* Right Column: Map + Desktop Actions */}
            <div className="px-5 lg:px-0 lg:space-y-4">
              <div className="bg-white lg:rounded-3xl lg:border lg:border-slate-200 lg:shadow-sm lg:p-5">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-36 lg:h-56">
                  <AstanaLeafletMap
                    mode="mini"
                    center={[event.lat, event.lng]}
                    zoom={15}
                    className="w-full h-full"
                  />
                  <div className="absolute bottom-0 inset-x-0 z-10 bg-white/95 px-3 py-1.5 text-xs border-t border-slate-100">
                    <b className="text-slate-900">{event.district}</b> · {event.address}
                  </div>
                </div>

                <div className="hidden lg:block mt-4">
                  <div className="flex items-center justify-between mb-3 text-sm text-slate-600">
                    <span>
                      👥 <b className="text-slate-900 tabular-nums">{event.attendees_count}</b> {t.peopleGoing}
                    </span>
                    <span className="font-bold text-emerald-600">
                      {event.price === 0 ? `${tm.free} · 0 ₸` : `${event.price.toLocaleString('ru-RU')} ₸`}
                    </span>
                  </div>
                  {actionButtons}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Mobile Sticky Actions */}
      <div className="lg:hidden absolute inset-x-0 bottom-0 z-20 bg-white border-t border-slate-100 px-4 pt-3 pb-5">
        {actionButtons}
      </div>

      {/* Route Sheet (2GIS & OSRM) */}
      {showRouteModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => setShowRouteModal(false)}
          />
          <div className="relative w-full md:max-w-md bg-white rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-7 shadow-2xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 md:hidden" />
            <h3 className="text-base font-bold text-slate-900">{t.route}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {event.address} ({event.lat.toFixed(4)}, {event.lng.toFixed(4)})
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <a
                href={twoGisUrl}
                target="_blank"
                rel="noreferrer"
                className="h-12 rounded-xl bg-emerald-500 text-white font-bold text-sm flex items-center justify-center shadow"
              >
                2ГИС Астана ↗
              </a>
              <a
                href={osrmUrl}
                target="_blank"
                rel="noreferrer"
                className="h-12 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow"
              >
                OSRM Маршрут ↗
              </a>
            </div>
            <button
              onClick={() => setShowRouteModal(false)}
              className="mt-3 w-full h-10 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              {lang === 'kz' ? 'Жабу' : 'Закрыть'}
            </button>
          </div>
        </div>
      )}

      {/* Report Modal (UC-07 with 409 DUPLICATE_ENTRY) */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
            onClick={() => setShowReportModal(false)}
          />
          <div className="relative w-full md:max-w-md bg-white rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-7 shadow-2xl">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 md:hidden" />
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">{t.reportTitle}</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-slate-400 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mt-3">
              {(Object.keys(t.reportReasons) as ReportReason[]).map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer ${
                    reportReason === r
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    className="accent-indigo-600"
                  />
                  <span>{t.reportReasons[r]}</span>
                </label>
              ))}
            </div>

            <textarea
              rows={2}
              value={reportComment}
              onChange={(e) => setReportComment(e.target.value)}
              placeholder={
                lang === 'kz'
                  ? 'Қосымша түсініктеме (міндетті емес)'
                  : 'Комментарий (необязательно)'
              }
              className="w-full mt-3 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500"
            />

            {reportMsg && (
              <div
                className={`mt-2.5 rounded-xl p-2.5 text-xs font-semibold ${
                  reportMsg.type === 'err'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {reportMsg.text}
              </div>
            )}

            <button
              onClick={handleReportSubmit}
              className="mt-3 w-full h-12 rounded-xl bg-red-600 text-white font-bold text-sm cursor-pointer hover:bg-red-700 transition"
            >
              {t.reportSubmit}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
