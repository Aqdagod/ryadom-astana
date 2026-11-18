import React from 'react';
import { TRANSLATIONS, Lang } from '../i18n/translations';

export const EmptyFilterState: React.FC<{
  lang: Lang;
  onReset: () => void;
}> = ({ lang, onReset }) => {
  const t = TRANSLATIONS[lang].states;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-2xl">
        🔍
      </div>
      <h3 className="mt-3 text-[16px] font-bold text-slate-900">{t.emptyFilterTitle}</h3>
      <p className="mt-1 text-[13px] text-slate-500 leading-snug">{t.emptyFilterDesc}</p>
      <button
        onClick={onReset}
        className="mt-4 h-10 px-5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition cursor-pointer"
      >
        {t.resetFilters}
      </button>
    </div>
  );
};

export const NearbyEmptyState: React.FC<{
  lang: Lang;
  onExpandRadius?: () => void;
  onCreateEvent?: () => void;
}> = ({ lang, onExpandRadius, onCreateEvent }) => {
  const t = TRANSLATIONS[lang].states;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-2xl">
        📍
      </div>
      <h3 className="mt-3 text-[16px] font-bold text-slate-900">{t.nearbyEmptyTitle}</h3>
      <p className="mt-1 text-[13px] text-slate-500 leading-snug">{t.nearbyEmptyDesc}</p>
      <div className="mt-4 flex gap-2 justify-center">
        {onExpandRadius && (
          <button
            onClick={onExpandRadius}
            className="h-10 px-4 rounded-xl bg-emerald-500 text-white text-[13px] font-semibold hover:bg-emerald-600 transition cursor-pointer"
          >
            {t.expandRadius}
          </button>
        )}
        {onCreateEvent && (
          <button
            onClick={onCreateEvent}
            className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            {t.createOwn}
          </button>
        )}
      </div>
    </div>
  );
};

export const ForbiddenState: React.FC<{
  lang: Lang;
  onHome: () => void;
  onBack: () => void;
}> = ({ lang, onHome, onBack }) => {
  const t = TRANSLATIONS[lang].states;
  return (
    <div className="bg-white rounded-2xl border border-red-100 shadow-sm px-5 py-6 text-center">
      <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl">
        🔒
      </div>
      <p className="mt-3 text-[28px] font-extrabold text-red-600 leading-none">403</p>
      <h3 className="mt-1.5 text-[16px] font-bold text-slate-900">{t.forbiddenTitle}</h3>
      <p className="mt-1 text-[13px] text-slate-500 leading-snug">{t.forbiddenDesc}</p>
      <div className="mt-4 flex gap-2 justify-center">
        <button
          onClick={onHome}
          className="h-10 px-5 rounded-xl bg-indigo-600 text-white text-[13px] font-semibold hover:bg-indigo-700 transition cursor-pointer"
        >
          {t.toHome}
        </button>
        <button
          onClick={onBack}
          className="h-10 px-4 rounded-xl border border-slate-300 text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition cursor-pointer"
        >
          {t.back}
        </button>
      </div>
    </div>
  );
};

export const SystemStatesScreen: React.FC<{
  lang: Lang;
  onResetFilters: () => void;
  onExpandRadius: () => void;
  onCreateEvent: () => void;
  onHome: () => void;
  onBack: () => void;
}> = ({ lang, onResetFilters, onExpandRadius, onCreateEvent, onHome, onBack }) => {
  const t = TRANSLATIONS[lang].states;
  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white px-5 pt-2 lg:pt-4 pb-3 border-b border-slate-200 flex-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight">{t.title}</h1>
            <p className="text-[13px] text-slate-500">{t.subtitle}</p>
          </div>
          <button
            onClick={onBack}
            className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
          >
            {t.back}
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto no-sb px-4 py-4 lg:px-6 lg:py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              F-04 · 200 EMPTY_LIST
            </p>
            <EmptyFilterState lang={lang} onReset={onResetFilters} />
          </section>
          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              F-06 · {lang === 'kz' ? 'Жақын маңда бос' : 'Рядом ничего нет'}
            </p>
            <NearbyEmptyState
              lang={lang}
              onExpandRadius={onExpandRadius}
              onCreateEvent={onCreateEvent}
            />
          </section>
          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              F-48 · 403 FORBIDDEN (RLS)
            </p>
            <ForbiddenState lang={lang} onHome={onHome} onBack={onBack} />
          </section>
        </div>

        <div className="max-w-5xl mx-auto mt-5 bg-slate-900 text-slate-100 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              RFC 9457 · ProblemDetails + traceId (Конвейер 0)
            </span>
            <span className="text-[11px] text-slate-400">
              {lang === 'kz'
                ? 'Барлық 4xx/5xx қателері бірыңғай форматта келеді'
                : 'Все 4xx/5xx ошибки возвращаются в едином формате'}
            </span>
          </div>
          <pre className="text-[11.5px] leading-relaxed font-mono text-indigo-200 overflow-x-auto">{`{
  "type": "/errors/forbidden",
  "title": "Недостаточно прав",
  "status": 403,
  "code": "FORBIDDEN",
  "detail": "Требуется роль: moderator / admin",
  "traceId": "00-19a8f4c2e1b094a1-01"
}`}</pre>
        </div>
      </main>
    </div>
  );
};
