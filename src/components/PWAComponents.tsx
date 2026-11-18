import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWA';

export const PWAInstallButton: React.FC<{ lang?: 'ru' | 'kz' }> = ({ lang = 'ru' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-semibold shadow-sm hover:bg-indigo-700 transition cursor-pointer whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5" />
        {lang === 'kz' ? 'Орнату (PWA)' : 'Установить PWA'}
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer whitespace-nowrap"
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
          {lang === 'kz' ? 'iOS-қа орнату' : 'На экран iOS'}
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
              <h3 className="text-base font-bold text-slate-900">
                {lang === 'kz' ? 'iPhone / iPad-қа орнату' : 'Установка на iPhone / iPad'}
              </h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                1. {lang === 'kz' ? 'Safari-де «Бөлісу» батырмасын басыңыз.' : 'Нажмите кнопку «Поделиться» в панели Safari.'}
                <br />
                2. {lang === 'kz' ? '«Басты экранға қосу» тармағын таңдаңыз.' : 'Выберите «На экран «Домой».'}
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full h-10 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
              >
                {lang === 'kz' ? 'Түсінікті' : 'Понятно'}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC<{ lang?: 'ru' | 'kz' }> = ({ lang = 'ru' }) => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="mx-3 mt-1 mb-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
      <WifiOff className="w-3.5 h-3.5" />
      <span>
        {lang === 'kz'
          ? 'Офлайн режим — кэштелген деректер қолданылуда'
          : 'Офлайн-режим — используются кэшированные данные'}
      </span>
    </div>
  );
};
