import React, { useState } from 'react';
import { Category, Event, EventDraftInput } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import {
  ASTANA_CENTER,
  ASTANA_DISTRICTS,
  buildAlmatyIso,
  formatAlmatyDateTime,
  formatAlmatyTime,
  getAlmatyDateParts,
  isWithinAstana,
  toAlmatyInputValues,
} from '../utils/time';
import { AstanaLeafletMap } from './AstanaLeafletMap';
import { apiClient } from '../services/apiClient';

interface CreateEventScreenProps {
  lang: Lang;
  categories: Category[];
  editingEvent?: Event | null;
  onBack: () => void;
  onSave: (input: EventDraftInput, submitImmediately: boolean) => Promise<{ ok: boolean; error?: string }>;
}

export const CreateEventScreen: React.FC<CreateEventScreenProps> = ({
  lang,
  categories,
  editingEvent,
  onBack,
  onSave,
}) => {
  const t = TRANSLATIONS[lang].create;
  const tm = TRANSLATIONS[lang].map;

  // Defaults in Asia/Almaty (+2 hours from now so valid by default)
  const defaultStart = editingEvent
    ? toAlmatyInputValues(editingEvent.starts_at)
    : toAlmatyInputValues(new Date(Date.now() + 2 * 3600 * 1000).toISOString());
  const defaultEnd = editingEvent
    ? toAlmatyInputValues(editingEvent.ends_at)
    : toAlmatyInputValues(new Date(Date.now() + 4 * 3600 * 1000).toISOString());

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 4 = preview
  const [title, setTitle] = useState(editingEvent?.title || '');
  const [categoryId, setCategoryId] = useState(editingEvent?.category_id || categories[0]?.id || 'cat-tech');
  const [description, setDescription] = useState(editingEvent?.description || '');
  const [posterUrl, setPosterUrl] = useState<string | undefined>(editingEvent?.poster_url);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);

  const [date, setDate] = useState(defaultStart.date);
  const [startTime, setStartTime] = useState(defaultStart.startTime);
  const [endTime, setEndTime] = useState(defaultEnd.startTime);

  const [lat, setLat] = useState(editingEvent?.lat || ASTANA_CENTER[0]);
  const [lng, setLng] = useState(editingEvent?.lng || ASTANA_CENTER[1]);
  const [address, setAddress] = useState(editingEvent?.address || 'Astana Hub, пр. Мангилик Ел 55');
  const [district, setDistrict] = useState(editingEvent?.district || 'Есильский');
  const [priceStr, setPriceStr] = useState(String(editingEvent?.price ?? 0));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handlePosterFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPosterError(null);

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setPosterError(
        lang === 'kz' ? 'Тек JPG немесе PNG форматтары рұқсат етілген' : 'Допустимы только файлы JPG или PNG'
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPosterError(
        lang === 'kz' ? 'Файл өлшемі 5 МБ-тан аспауы керек' : 'Размер файла не должен превышать 5 МБ'
      );
      return;
    }

    setUploadingPoster(true);
    const res = await apiClient.uploadPoster(file);
    setUploadingPoster(false);
    if (res.error || !res.data) {
      setPosterError(res.error?.detail || res.error?.message || 'Ошибка загрузки афиши');
      return;
    }
    setPosterUrl(res.data);
  };

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    const clean = title.trim();
    if (clean.length < 3 || clean.length > 100) {
      errs.title =
        lang === 'kz'
          ? 'Атауы 3-тен 100 таңбаға дейін болуы керек'
          : 'Название должно содержать от 3 до 100 символов';
    }
    if (!categoryId) {
      errs.category = lang === 'kz' ? 'Санатты таңдаңыз' : 'Выберите категорию';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!date) {
      errs.date = lang === 'kz' ? 'Күнді таңдаңыз' : 'Укажите дату';
    } else {
      const startsIso = buildAlmatyIso(date, startTime);
      const endsIso = buildAlmatyIso(date, endTime);
      const sMs = new Date(startsIso).getTime();
      const eMs = new Date(endsIso).getTime();

      if (Number.isNaN(sMs) || sMs < Date.now() - 5 * 60 * 1000) {
        errs.startTime =
          lang === 'kz'
            ? 'Басталу уақыты өткен уақытта болмауы тиіс'
            : 'Дата и время начала не могут быть в прошлом';
      }
      if (Number.isNaN(eMs) || eMs <= sMs) {
        errs.endTime =
          lang === 'kz'
            ? 'Аяқталу уақыты басталуынан кейін болуы тиіс'
            : 'Время окончания должно быть позже времени начала';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isWithinAstana(lat, lng)) {
      errs.location =
        lang === 'kz'
          ? 'Нүкте Астана аумағында болуы тиіс'
          : 'Точка должна находиться в пределах Астаны';
    }
    if (address.trim().length < 3) {
      errs.address =
        lang === 'kz' ? 'Мекенжайды енгізіңіз' : 'Укажите адрес или ориентир в Астане';
    }
    const priceNum = Number(priceStr);
    if (priceStr.trim() === '' || Number.isNaN(priceNum) || priceNum < 0) {
      errs.price = lang === 'kz' ? 'Бағасы ≥ 0 болуы тиіс' : 'Цена должна быть ≥ 0';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3 && validateStep3()) setStep(4);
  };

  const handleStepBack = () => {
    setErrors({});
    if (step === 1) onBack();
    else setStep((step - 1) as 1 | 2 | 3);
  };

  const handleFinalSave = async (submitImmediately: boolean) => {
    setSubmitError(null);
    const startsIso = buildAlmatyIso(date, startTime);
    const endsIso = buildAlmatyIso(date, endTime);
    const priceNum = Math.max(0, Number(priceStr) || 0);

    const res = await onSave(
      {
        id: editingEvent?.id,
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        starts_at: startsIso,
        ends_at: endsIso,
        lat,
        lng,
        address: address.trim(),
        district,
        price: priceNum,
        poster_url: posterUrl,
      },
      submitImmediately
    );

    if (!res.ok) {
      setSubmitError(res.error || 'Ошибка сохранения');
    }
  };

  const selectedCat = categories.find((c) => c.id === categoryId);
  const priceNum = Number(priceStr) || 0;
  const startsPreview = buildAlmatyIso(date || getAlmatyDateParts(new Date()).dateKey, startTime || '18:00');
  const endsPreview = buildAlmatyIso(date || getAlmatyDateParts(new Date()).dateKey, endTime || '20:00');

  return (
    <div className="flex-1 flex flex-col bg-[#F9FAFB] overflow-hidden">
      <header className="px-2 pt-1 flex-none bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto flex items-center gap-1">
          <button
            onClick={handleStepBack}
            className="tap rounded-full text-slate-800 text-xl cursor-pointer"
            aria-label="Назад"
          >
            ←
          </button>
          <h1 className="text-lg font-bold text-slate-900">
            {editingEvent ? t.editHeader : t.header}
          </h1>
        </div>
      </header>

      {/* Progress */}
      <div className="px-5 pt-2.5 pb-3 flex-none bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between text-xs font-medium mb-2">
            <span className="text-indigo-600 font-semibold">
              {step === 1 ? t.step1 : step === 2 ? t.step2 : step === 3 ? t.step3 : t.previewStep}
            </span>
            <span className="text-slate-400">{step < 4 ? t.nextPreview : 'F-12'}</span>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step >= idx ? 'bg-indigo-600' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto no-sb px-5 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
        {step === 1 && (
          <>
            {/* Poster upload */}
            <div>
              <label className="text-sm font-semibold text-slate-800">{t.posterLabel}</label>
              <label className="w-full mt-1.5 h-28 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden relative">
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => void handlePosterFile(e)}
                  className="hidden"
                />
                {uploadingPoster ? (
                  <span className="text-xs font-semibold text-indigo-600">
                    {lang === 'kz' ? 'Жүктелуде...' : 'Загрузка в posters...'}
                  </span>
                ) : posterUrl ? (
                  <>
                    <img
                      src={posterUrl}
                      alt="Poster preview"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1.5 right-2 bg-slate-900/75 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                      {lang === 'kz' ? 'Өзгерту' : 'Изменить'}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🖼️</span>
                    <span className="text-sm font-semibold text-indigo-600">{t.uploadPoster}</span>
                    <span className="text-xs text-slate-500">{t.posterHint}</span>
                  </>
                )}
              </label>
              {posterError && (
                <p className="text-xs text-red-600 mt-1.5">⚠ {posterError}</p>
              )}
            </div>

            {/* Title with inline validation */}
            <div>
              <div className="flex justify-between">
                <label className="text-sm font-semibold text-slate-800" htmlFor="ev-title">
                  {t.titleLabel}
                </label>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {title.trim().length} / 100
                </span>
              </div>
              <input
                id="ev-title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title) setErrors({ ...errors, title: '' });
                }}
                placeholder={lang === 'kz' ? 'Мысалы: Astana Dev Night хакатоны' : 'Например: Вечерняя лекция в Astana Hub'}
                className={`w-full h-12 mt-1.5 px-4 rounded-xl bg-white text-sm text-slate-900 outline-none ${
                  errors.title
                    ? 'border-2 border-red-500'
                    : 'border border-slate-300 focus:border-indigo-500'
                }`}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                  ⚠ {errors.title}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-semibold text-slate-800">{t.categoryLabel}</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {categories
                  .filter((c) => c.is_active)
                  .map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setCategoryId(cat.id)}
                      className={`px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                        categoryId === cat.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      {cat.icon} {lang === 'kz' ? cat.name_kz : cat.name_ru}
                    </button>
                  ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="ev-desc">
                {t.descLabel}
              </label>
              <textarea
                id="ev-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={lang === 'kz' ? 'Бағдарлама және қатысу шарттары...' : 'Расскажите о программе, спикерах и что взять с собой...'}
                className="w-full mt-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="ev-date">
                {t.dateLabel}
              </label>
              <input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setErrors({});
                }}
                className="w-full h-12 mt-1.5 px-4 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-800" htmlFor="ev-start">
                  {t.startLabel}
                </label>
                <input
                  id="ev-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setErrors({});
                  }}
                  className={`w-full h-12 mt-1.5 px-4 rounded-xl bg-white text-sm text-slate-900 outline-none ${
                    errors.startTime ? 'border-2 border-red-500' : 'border border-slate-300'
                  }`}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800" htmlFor="ev-end">
                  {t.endLabel}
                </label>
                <input
                  id="ev-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setErrors({});
                  }}
                  className={`w-full h-12 mt-1.5 px-4 rounded-xl bg-white text-sm text-slate-900 outline-none ${
                    errors.endTime ? 'border-2 border-red-500' : 'border border-slate-300'
                  }`}
                />
              </div>
            </div>

            {(errors.startTime || errors.endTime || errors.date) && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                ⚠ {errors.startTime || errors.endTime || errors.date}
              </div>
            )}

            <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3.5 text-xs text-indigo-800">
              🕒 {lang === 'kz' ? 'Барлық уақыт Астана (Asia/Almaty, UTC+5) бойынша сақталады.' : 'Все события в системе хранятся и отображаются в часовом поясе Asia/Almaty (UTC+5).'}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <div className="flex justify-between items-baseline">
                <label className="text-sm font-semibold text-slate-800">{t.mapLabel}</label>
                <span className="text-xs text-slate-500">Астана</span>
              </div>
              <div className="relative h-44 mt-1.5 rounded-2xl border border-slate-300 overflow-hidden">
                <AstanaLeafletMap
                  mode="picker"
                  center={[lat, lng]}
                  zoom={13}
                  pickerPosition={[lat, lng]}
                  onPickLocation={(newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                    setErrors({ ...errors, location: '' });
                  }}
                  className="w-full h-full"
                />
                <span className="absolute right-2.5 top-2.5 z-10 text-[11px] bg-white/95 px-2.5 py-1 rounded-md text-slate-600 font-medium shadow-sm pointer-events-none">
                  {t.tapToPick}
                </span>
                <span className="absolute left-2.5 bottom-2 z-10 text-[11px] bg-white/95 px-2.5 py-1 rounded-md text-slate-700 font-mono shadow-sm pointer-events-none">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              </div>
              {errors.location && (
                <p className="text-xs text-red-600 mt-1.5">⚠ {errors.location}</p>
              )}

              {/* Quick Astana district presets */}
              <div className="flex gap-1.5 overflow-x-auto no-sb mt-2 pb-1">
                {ASTANA_DISTRICTS.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => {
                      setLat(d.lat);
                      setLng(d.lng);
                      setDistrict(d.name_ru.split(' (')[0]);
                    }}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-700 whitespace-nowrap cursor-pointer hover:border-indigo-400"
                  >
                    📍 {d.name_ru.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="ev-address">
                {t.addressLabel}
              </label>
              <input
                id="ev-address"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setErrors({ ...errors, address: '' });
                }}
                className={`w-full h-12 mt-1.5 px-4 rounded-xl bg-white text-sm text-slate-900 outline-none ${
                  errors.address ? 'border-2 border-red-500' : 'border border-slate-300'
                }`}
              />
              {errors.address && (
                <p className="text-xs text-red-600 mt-1.5">⚠ {errors.address}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-800" htmlFor="ev-price">
                {t.priceLabel}
              </label>
              <div className="flex items-center gap-3 mt-1.5">
                <input
                  id="ev-price"
                  type="number"
                  min={0}
                  value={priceStr}
                  onChange={(e) => {
                    setPriceStr(e.target.value);
                    setErrors({ ...errors, price: '' });
                  }}
                  className="h-12 w-32 px-4 rounded-xl bg-white border border-slate-300 text-sm text-slate-900 outline-none tabular-nums"
                />
                {priceNum === 0 && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
                    {tm.free}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1.5">{t.priceHint}</p>
              {errors.price && (
                <p className="text-xs text-red-600 mt-1">⚠ {errors.price}</p>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div
                className="h-36 grid place-items-center text-5xl relative"
                style={{
                  background: 'linear-gradient(135deg,#4F46E5,#10B981)',
                }}
              >
                {posterUrl ? (
                  <img src={posterUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <span>{selectedCat?.icon || '📍'}</span>
                )}
                <span className="absolute top-3 left-3 text-[11px] font-semibold bg-white/90 text-indigo-700 px-2.5 py-1 rounded-full">
                  {selectedCat?.icon} {lang === 'kz' ? selectedCat?.name_kz : selectedCat?.name_ru}
                </span>
              </div>
              <div className="p-4">
                <h2 className="text-lg font-extrabold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-500 mt-1">
                  🕖 {formatAlmatyDateTime(startsPreview, lang)}–{formatAlmatyTime(endsPreview)} (Asia/Almaty)
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  📍 {district} · {address}
                </p>
                {description && (
                  <p className="text-xs text-slate-700 mt-2.5 leading-relaxed">{description}</p>
                )}
                <div className="mt-3">
                  <span
                    className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                      priceNum === 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {priceNum === 0 ? `${tm.free} · 0 ₸` : `${priceNum} ₸`}
                  </span>
                </div>
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-semibold">
                ⚠ {submitError}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-5 pt-3 pb-6 bg-white border-t border-slate-100 flex-none">
        <div className="max-w-2xl mx-auto">
        {step < 4 ? (
          <button
            onClick={handleNext}
            className="tap w-full h-14 rounded-2xl bg-indigo-600 text-white font-semibold text-[15px] shadow-md shadow-indigo-200 hover:bg-indigo-700 transition cursor-pointer"
          >
            {step === 3 ? t.previewBtn : t.nextBtn}
          </button>
        ) : (
          <div className="space-y-2 sm:flex sm:gap-3 sm:space-y-0">
            <button
              onClick={() => void handleFinalSave(true)}
              className="tap w-full sm:flex-1 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-md shadow-indigo-200 hover:bg-indigo-700 transition cursor-pointer"
            >
              {t.sendModBtn}
            </button>
            <button
              onClick={() => void handleFinalSave(false)}
              className="tap w-full sm:flex-1 h-11 sm:h-12 rounded-2xl border border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition cursor-pointer"
            >
              {t.saveDraftBtn}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
