import React from 'react';
import { Category, EventFilters, TimelineFilter } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';

interface FilterSheetProps {
  open: boolean;
  lang: Lang;
  filters: EventFilters;
  categories: Category[];
  matchedCount: number;
  onChange: (next: EventFilters) => void;
  onReset: () => void;
  onClose: () => void;
}

const RADIUS_STEPS = [0.5, 1, 3, 5, 10];

export const FilterSheet: React.FC<FilterSheetProps> = ({
  open,
  lang,
  filters,
  categories,
  matchedCount,
  onChange,
  onReset,
  onClose,
}) => {
  if (!open) return null;
  const t = TRANSLATIONS[lang].filters;
  const tl = TRANSLATIONS[lang].timeline;

  const toggleCategory = (catId: string) => {
    const exists = filters.categoryIds.includes(catId);
    const nextIds = exists
      ? filters.categoryIds.filter((id) => id !== catId)
      : [...filters.categoryIds, catId];
    onChange({ ...filters, categoryIds: nextIds });
  };

  const radiusIdx = Math.max(
    0,
    RADIUS_STEPS.findIndex((r) => r >= filters.radiusKm)
  );
  const sliderPct = (radiusIdx / (RADIUS_STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full md:max-w-lg bg-white rounded-t-[28px] md:rounded-3xl px-5 pt-3 pb-6 shadow-2xl max-h-[85vh] overflow-y-auto no-sb"
        role="dialog"
        aria-label={t.title}
      >
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 md:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t.title}</h2>
          <button
            onClick={onReset}
            className="tap text-sm font-semibold text-indigo-600 cursor-pointer"
          >
            {t.reset}
          </button>
        </div>

        <h3 className="text-sm font-semibold text-slate-500 mt-3 mb-2">{t.categories}</h3>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          {categories
            .filter((c) => c.is_active)
            .map((cat) => {
              const active = filters.categoryIds.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`tap px-4 rounded-full transition cursor-pointer ${
                    active
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#F8FAFC] border border-slate-200 text-slate-700'
                  }`}
                >
                  {cat.icon} {lang === 'kz' ? cat.name_kz : cat.name_ru}
                </button>
              );
            })}
        </div>

        <div className="flex items-center justify-between bg-[#F8FAFC] rounded-2xl px-4 mt-5 min-h-[56px]">
          <div>
            <div className="font-semibold text-slate-900 text-sm">{t.freeOnly}</div>
            <div className="text-xs text-slate-500">{t.freeOnlySub}</div>
          </div>
          <button
            role="switch"
            aria-checked={filters.freeOnly}
            onClick={() => onChange({ ...filters, freeOnly: !filters.freeOnly })}
            className={`tap relative w-14 h-8 rounded-full transition-colors cursor-pointer ${
              filters.freeOnly ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${
                filters.freeOnly ? 'right-1' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <h3 className="font-semibold text-slate-500">{t.radius}</h3>
            <span className="font-bold text-indigo-600 tabular-nums">
              {filters.radiusKm < 1
                ? `${filters.radiusKm * 1000} м`
                : `${filters.radiusKm} км`}
            </span>
          </div>
          <div className="relative h-11 flex items-center">
            <div className="w-full h-1.5 bg-slate-200 rounded-full" />
            <div
              className="absolute h-1.5 bg-indigo-600 rounded-full pointer-events-none"
              style={{ width: `${sliderPct}%` }}
            />
            <input
              type="range"
              min={0}
              max={RADIUS_STEPS.length - 1}
              step={1}
              value={radiusIdx}
              onChange={(e) =>
                onChange({ ...filters, radiusKm: RADIUS_STEPS[Number(e.target.value)] })
              }
              aria-label={t.radius}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div
              className="absolute w-7 h-7 rounded-full bg-white border-4 border-indigo-600 shadow pointer-events-none"
              style={{ left: `calc(${sliderPct}% - 14px)` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>500 м</span>
            <span>1 км</span>
            <span>3 км</span>
            <span>5 км</span>
            <span>10 км</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-slate-500 mt-5 mb-2">{t.when}</h3>
        <div className="flex gap-2 text-sm font-semibold">
          {(['today', 'tomorrow', 'weekend'] as TimelineFilter[]).map((key) => {
            const active = filters.timeline === key;
            return (
              <button
                key={key}
                onClick={() =>
                  onChange({ ...filters, timeline: active ? 'all' : key })
                }
                className={`tap flex-1 rounded-full transition cursor-pointer ${
                  active
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-600'
                    : 'bg-[#F8FAFC] border border-slate-200 text-slate-700'
                }`}
              >
                {tl[key]}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="tap w-full h-14 rounded-2xl bg-indigo-600 text-white font-bold mt-6 shadow-lg shadow-indigo-300 hover:bg-indigo-700 transition cursor-pointer"
        >
          {t.showPrefix} {matchedCount} {t.eventsWord}
        </button>
      </div>
    </div>
  );
};
