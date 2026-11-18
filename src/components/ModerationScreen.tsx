import React, { useState } from 'react';
import { Category, Event, Report, UserRole } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { apiClient } from '../services/apiClient';
import { formatAlmatyDateTime } from '../utils/time';
import { ForbiddenState } from './SystemStates';

interface ModerationScreenProps {
  lang: Lang;
  role: UserRole;
  categories: Category[];
  events: Event[];
  reports: Report[];
  onGoHome: () => void;
  onBack: () => void;
  onNotify: (msg: string) => void;
}

export const ModerationScreen: React.FC<ModerationScreenProps> = ({
  lang,
  role,
  categories,
  events,
  reports,
  onGoHome,
  onBack,
  onNotify,
}) => {
  const [mainTab, setMainTab] = useState<'events' | 'reports'>('events');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'auto' | 'authors'>('all');
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPrice, setEditPrice] = useState('0');
  const [editCatId, setEditCatId] = useState('');

  const t = TRANSLATIONS[lang].moderation;
  const tm = TRANSLATIONS[lang].map;
  const td = TRANSLATIONS[lang].detail;

  // RLS Check via apiClient
  const queueRes = apiClient.getModerationQueue();
  if (queueRes.error?.status === 403) {
    return (
      <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
        <header className="bg-white px-5 pt-2 pb-3 border-b border-slate-200 flex-none">
          <h1 className="text-[22px] font-bold text-slate-900 leading-tight">{t.title}</h1>
          <p className="text-[13px] text-red-600 font-semibold">403 FORBIDDEN</p>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6">
          <ForbiddenState lang={lang} onHome={onGoHome} onBack={onBack} />
        </main>
      </div>
    );
  }

  const queue = queueRes.data || [];
  const openReports = reports.filter((r) => r.status === 'open');

  const autoCount = queue.filter((e) => e.is_auto_collected).length;
  const authorCount = queue.filter((e) => !e.is_auto_collected).length;

  const filteredQueue = queue.filter((e) => {
    if (sourceFilter === 'auto') return e.is_auto_collected;
    if (sourceFilter === 'authors') return !e.is_auto_collected;
    return true;
  });

  const startEditing = (ev: Event) => {
    setEditingId(ev.id);
    setEditTitle(ev.title);
    setEditAddress(ev.address);
    setEditPrice(String(ev.price));
    setEditCatId(ev.category_id);
  };

  const saveEdit = async (eventId: string) => {
    const res = await apiClient.editEventAsModerator(eventId, {
      title: editTitle.trim() || undefined,
      address: editAddress.trim() || undefined,
      price: Math.max(0, Number(editPrice) || 0),
      category_id: editCatId || undefined,
    });
    if (res.error) {
      onNotify(res.error.message);
      return;
    }
    setEditingId(null);
    onNotify(lang === 'kz' ? 'Өрістер жаңартылды' : 'Поля обновлены');
  };

  const handleApprove = async (ev: Event) => {
    const res = await apiClient.moderateEvent(ev.id, 'approved');
    if (res.error) {
      onNotify(res.error.message);
      return;
    }
    onNotify(
      lang === 'kz'
        ? `«${ev.title}» Астана картасында жарияланды!`
        : `«${ev.title}» опубликовано и появилось на карте Астаны!`
    );
  };

  const handleReject = async (ev: Event) => {
    const reason = reasons[ev.id] || '';
    const res = await apiClient.moderateEvent(ev.id, 'rejected', reason);
    if (res.error) {
      setValidationErrors({ ...validationErrors, [ev.id]: `${res.error.status} ${res.error.code}: ${res.error.message}` });
      return;
    }
    setValidationErrors({ ...validationErrors, [ev.id]: '' });
    onNotify(lang === 'kz' ? `«${ev.title}» қабылданбады` : `«${ev.title}» отклонено`);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white px-5 pt-2 lg:pt-4 pb-3 border-b border-slate-200 flex-none">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[22px] font-bold text-slate-900 leading-tight">{t.title}</h1>
              <p className="text-[13px] text-slate-500">
                {t.inQueue}: {queue.length} · {t.reportsTab}: {openReports.length}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold uppercase">
              {role}
            </span>
          </div>

          {/* Events / Reports switch */}
          <div className="flex bg-slate-100 rounded-xl p-1 mt-3 max-w-md">
            <button
              onClick={() => setMainTab('events')}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold cursor-pointer transition ${
                mainTab === 'events' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.eventsTab} · {queue.length}
            </button>
            <button
              onClick={() => setMainTab('reports')}
              className={`flex-1 h-8 rounded-lg text-xs font-semibold cursor-pointer transition ${
                mainTab === 'reports' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.reportsTab} · {openReports.length}
            </button>
          </div>

          {mainTab === 'events' && (
            <div className="flex gap-2 mt-2.5">
              {(
                [
                  { id: 'all', label: `${t.all} · ${queue.length}` },
                  { id: 'auto', label: `${t.auto} · ${autoCount}` },
                  { id: 'authors', label: `${t.byAuthors} · ${authorCount}` },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setSourceFilter(chip.id)}
                  className={`px-3 h-7 rounded-full text-[12px] cursor-pointer transition ${
                    sourceFilter === chip.id
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 font-medium'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-sb px-4 py-4 lg:px-6 lg:py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {mainTab === 'events' && filteredQueue.length === 0 && (
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
            {lang === 'kz' ? 'Модерация кезегі бос 🎉' : 'Очередь модерации пуста 🎉'}
          </div>
        )}

        {mainTab === 'events' &&
          filteredQueue.map((ev) => {
            const cat = categories.find((c) => c.id === ev.category_id);
            const reasonVal = reasons[ev.id] ?? '';
            const isValidReason = reasonVal.trim().length >= 10;
            const errText = validationErrors[ev.id];
            const isEditing = editingId === ev.id;

            return (
              <article
                key={ev.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
              >
                <div className="flex items-center justify-between">
                  {ev.is_auto_collected ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                      {t.autoBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                      👤 {lang === 'kz' ? 'Автордан' : 'От автора'}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {formatAlmatyDateTime(ev.created_at, lang)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-2.5 bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Название</label>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full h-9 mt-1 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600">Адрес</label>
                      <input
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="w-full h-9 mt-1 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Цена, ₸</label>
                        <input
                          type="number"
                          min={0}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full h-9 mt-1 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">Категория</label>
                        <select
                          value={editCatId}
                          onChange={(e) => setEditCatId(e.target.value)}
                          className="w-full h-9 mt-1 px-2 rounded-lg border border-slate-300 bg-white text-xs"
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {lang === 'kz' ? c.name_kz : c.name_ru}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(ev.id)}
                        className="flex-1 h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        {t.saveChanges}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 h-9 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 className="text-[17px] font-bold text-slate-900 mt-3 leading-snug">
                      {ev.title}
                    </h3>

                    <dl className="mt-3 space-y-2 text-[13px]">
                      <div className="flex gap-3">
                        <dt className="w-20 text-slate-500 flex-none">
                          {lang === 'kz' ? 'Күні' : 'Дата'}
                        </dt>
                        <dd className="text-slate-900 font-medium">
                          {formatAlmatyDateTime(ev.starts_at, lang)}
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="w-20 text-slate-500 flex-none">
                          {lang === 'kz' ? 'Орны' : 'Место'}
                        </dt>
                        <dd className="text-slate-900 font-medium">{ev.address}</dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="w-20 text-slate-500 flex-none">
                          {lang === 'kz' ? 'Санат' : 'Категория'}
                        </dt>
                        <dd>
                          {cat && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-semibold">
                              {cat.icon} {lang === 'kz' ? cat.name_kz : cat.name_ru}
                            </span>
                          )}
                        </dd>
                      </div>
                      <div className="flex gap-3">
                        <dt className="w-20 text-slate-500 flex-none">
                          {lang === 'kz' ? 'Бағасы' : 'Цена'}
                        </dt>
                        <dd className="text-slate-900 font-medium">
                          {ev.price === 0 ? tm.free : `${ev.price.toLocaleString('ru-RU')} ₸`}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}

                {ev.source_url && (
                  <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {t.sourcePost}
                    </p>
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:underline break-all"
                    >
                      <span>↗</span>
                      {ev.source_url.replace('https://', '')}
                    </a>
                  </div>
                )}

                {ev.is_auto_collected && ev.llm_confidence && (
                  <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3 text-[12px] text-amber-800 leading-snug">
                    <span className="font-semibold">
                      {lang === 'kz'
                        ? `LLM сенімділігі: ${ev.llm_confidence}%.`
                        : `Уверенность LLM: ${ev.llm_confidence}%.`}
                    </span>{' '}
                    {t.llmNote}
                  </div>
                )}

                {!isEditing && (
                  <button
                    onClick={() => startEditing(ev)}
                    className="mt-3 w-full h-10 rounded-xl bg-indigo-50 text-indigo-700 text-[13px] font-semibold cursor-pointer hover:bg-indigo-100 transition"
                  >
                    ✎ {t.editFields}
                  </button>
                )}

                <div className="mt-4">
                  <label className="text-[12px] font-semibold text-slate-700">
                    {t.rejectReasonLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={reasonVal}
                    onChange={(e) => {
                      setReasons({ ...reasons, [ev.id]: e.target.value });
                      if (validationErrors[ev.id]) {
                        setValidationErrors({ ...validationErrors, [ev.id]: '' });
                      }
                    }}
                    placeholder={t.rejectPlaceholder}
                    className={`mt-1.5 w-full rounded-xl bg-white px-3 py-2 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none ${
                      errText || (!isValidReason && reasonVal.length > 0)
                        ? 'border border-red-300 focus:ring-2 focus:ring-red-200'
                        : 'border border-slate-300 focus:ring-2 focus:ring-indigo-100'
                    }`}
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p
                      className={`text-[11px] ${
                        isValidReason ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {errText || (isValidReason ? '✓ ОК' : t.minChars)}
                    </p>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {reasonVal.trim().length} / 10
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={() => handleReject(ev)}
                    className={`h-11 rounded-xl text-[14px] font-bold cursor-pointer transition ${
                      isValidReason
                        ? 'bg-red-600 text-white shadow-md shadow-red-200 hover:bg-red-700'
                        : 'bg-red-50 text-red-400 hover:bg-red-100'
                    }`}
                  >
                    {t.reject}
                  </button>
                  <button
                    onClick={() => handleApprove(ev)}
                    className="h-11 rounded-xl bg-emerald-500 text-white text-[14px] font-bold shadow-md shadow-emerald-500/30 hover:bg-emerald-600 transition cursor-pointer"
                  >
                    {t.approve}
                  </button>
                </div>
              </article>
            );
          })}

        {mainTab === 'reports' && openReports.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xs text-slate-500">
            {lang === 'kz' ? 'Ашық шағымдар жоқ' : 'Открытых жалоб нет'}
          </div>
        )}

        {mainTab === 'reports' &&
          openReports.map((rep) => {
            const ev = events.find((e) => e.id === rep.event_id);
            return (
              <article
                key={rep.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold">
                    ⚑ {td.reportReasons[rep.reason]}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {formatAlmatyDateTime(rep.created_at, lang)}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">
                  {ev?.title || rep.event_id}
                </h3>
                {rep.comment && (
                  <p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-xl p-2.5">
                    «{rep.comment}»
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <button
                    onClick={async () => {
                      const r = await apiClient.resolveReport(rep.id, 'dismissed');
                      if (r.error) onNotify(r.error.message);
                      else onNotify(lang === 'kz' ? 'Шағым жабылды' : 'Жалоба отклонена');
                    }}
                    className="h-10 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'kz' ? 'Шағымды жабу' : 'Отклонить жалобу'}
                  </button>
                  <button
                    onClick={async () => {
                      const r = await apiClient.resolveReport(rep.id, 'resolved');
                      if (r.error) onNotify(r.error.message);
                      else {
                        onNotify(
                          lang === 'kz'
                            ? 'Оқиға жарияланымнан алынды'
                            : 'Событие снято с публикации'
                        );
                      }
                    }}
                    className="h-10 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'kz' ? 'Жарияланымнан алу' : 'Снять событие'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
};
