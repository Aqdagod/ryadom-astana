import React, { useEffect, useRef, useState } from 'react';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { apiClient, type TelegramWidgetPayload } from '../services/apiClient';

interface TelegramAuthModalProps {
  open: boolean;
  lang: Lang;
  contextEventTitle?: string;
  onSuccess: () => void;
  onClose: () => void;
}

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetPayload) => void;
  }
}

export const TelegramAuthModal: React.FC<TelegramAuthModalProps> = ({
  open,
  lang,
  contextEventTitle,
  onSuccess,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);

  const botUsername =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TELEGRAM_BOT_USERNAME) || '';

  const submitTelegramPayload = async (payload: TelegramWidgetPayload) => {
    setLoading(true);
    setError(null);
    const res = await apiClient.authTelegram(payload);
    setLoading(false);
    if (res.error) {
      setError(res.error.detail || res.error.message);
      return;
    }
    onSuccess();
  };

  useEffect(() => {
    if (!open || !botUsername || !widgetContainerRef.current) return;

    window.onTelegramAuth = (user: TelegramWidgetPayload) => {
      void submitTelegramPayload(user);
    };

    const container = widgetContainerRef.current;
    container.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '14');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
      delete window.onTelegramAuth;
    };
  }, [open, botUsername]);

  if (!open) return null;
  const t = TRANSLATIONS[lang].auth;

  const handleAuth = async () => {
    if (!telegramId.trim()) {
      setError(
        lang === 'kz'
          ? 'Telegram Login Widget арқылы кіріңіз немесе Telegram ID енгізіңіз'
          : 'Войдите через виджет Telegram или введите Telegram ID'
      );
      return;
    }
    const [firstName, ...rest] = name.trim().split(/\s+/);
    await submitTelegramPayload({
      id: telegramId.trim(),
      first_name: firstName || undefined,
      last_name: rest.join(' ') || undefined,
      auth_date: Math.floor(Date.now() / 1000),
      hash: '',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-full md:max-w-md bg-white rounded-t-[28px] md:rounded-3xl px-6 pt-3 pb-7 shadow-2xl max-h-[90vh] overflow-y-auto no-sb"
        role="dialog"
        aria-label={t.title}
      >
        <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto md:hidden" />
        <button
          onClick={onClose}
          className="tap absolute top-4 right-4 rounded-full text-slate-500 text-xl cursor-pointer"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mt-5">
          <span className="text-3xl">📍</span>
        </div>
        <h3 className="text-center text-xl font-bold text-slate-900 mt-3">{t.title}</h3>
        <p className="text-center text-sm text-slate-500 mt-1.5 leading-relaxed">{t.desc}</p>

        {botUsername && <div ref={widgetContainerRef} className="flex justify-center mt-4" />}

        <div className="grid grid-cols-2 gap-2.5 mt-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500">{t.nameLabel}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Имя"
              className="w-full h-10 mt-1 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">{t.idLabel}</label>
            <input
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="Telegram ID"
              className="w-full h-10 mt-1 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-600 font-medium text-center">{error}</p>
        )}

        <button
          onClick={() => void handleAuth()}
          disabled={loading}
          className="tap w-full h-14 rounded-2xl mt-4 text-white font-semibold text-base gap-2.5 flex items-center justify-center shadow-md cursor-pointer hover:opacity-95 transition disabled:opacity-60"
          style={{ background: '#229ED9' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M21.9 4.3 18.7 19.6c-.2 1-.9 1.3-1.7.8l-4.8-3.6-2.3 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13 1.8 11.5c-1-.3-1-1 .2-1.5L20.3 2.9c.9-.3 1.6.2 1.6 1.4z" />
          </svg>
          {loading ? '...' : t.cta}
        </button>

        <div className="flex gap-3 bg-emerald-50 rounded-xl p-3 mt-4">
          <span className="text-emerald-600 text-base leading-none mt-0.5">↩</span>
          <p className="text-xs text-slate-700 leading-snug">
            {contextEventTitle
              ? lang === 'kz'
                ? `Кіргеннен кейін «${contextEventTitle}» оқиғасына ораласыз.`
                : `После входа вы вернётесь на исходную карточку события «${contextEventTitle}».`
              : t.returnNote}
          </p>
        </div>

        <div className="flex gap-3 bg-slate-50 rounded-xl p-3 mt-2.5">
          <span className="text-slate-500 text-base leading-none mt-0.5">🔒</span>
          <p className="text-xs text-slate-600 leading-snug">{t.privacyNote}</p>
        </div>

        <button
          onClick={onClose}
          className="tap w-full mt-2 text-sm font-medium text-slate-500 cursor-pointer"
        >
          {t.notNow}
        </button>
      </div>
    </div>
  );
};
