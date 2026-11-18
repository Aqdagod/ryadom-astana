import React from 'react';
import { AppScreen, Notification, User, UserRole } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { formatAlmatyDateTime } from '../utils/time';
import { PWAInstallButton } from './PWAComponents';

interface ProfileScreenProps {
  lang: Lang;
  user: User | null;
  role: UserRole;
  notifications: Notification[];
  onNavigate: (screen: AppScreen) => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onMarkNotificationsRead: () => void;
  onSelectEvent: (eventId: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  lang,
  user,
  role,
  notifications,
  onNavigate,
  onOpenAuth,
  onLogout,
  onMarkNotificationsRead,
  onSelectEvent,
}) => {
  const t = TRANSLATIONS[lang];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white px-5 pt-3 lg:pt-4 pb-4 border-b border-slate-200 flex-none">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-base flex items-center justify-center shadow-sm">
              {user ? user.avatar_initials : 'Г'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {user ? user.name : t.roles.guest}
              </h1>
              <p className="text-xs text-slate-500">
                {user
                  ? `tg_id: ${user.telegram_id} · ${t.roles[role]}`
                  : lang === 'kz'
                  ? 'Кіру жасалмаған'
                  : 'Вход не выполнен'}
              </p>
            </div>
          </div>
          {!user ? (
            <button
              onClick={onOpenAuth}
              className="px-3.5 h-9 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
            >
              {lang === 'kz' ? 'Кіру' : 'Войти'}
            </button>
          ) : (
            <button
              onClick={onLogout}
              className="px-3 h-9 rounded-xl border border-slate-300 text-slate-600 text-xs font-semibold cursor-pointer"
            >
              {lang === 'kz' ? 'Шығу' : 'Выйти'}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-sb px-4 py-4 lg:px-6 lg:py-6">
        <div className="max-w-3xl mx-auto space-y-4">
        {/* Quick navigation sections including RLS test links */}
        <section className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm overflow-hidden">
          <button
            onClick={() => onNavigate('my_events')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🗂</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.myEvents.title}</p>
                <p className="text-[11px] text-slate-500">
                  {lang === 'kz' ? 'Менің жарияланымдарым' : 'Черновики, модерация, отклонённые'}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          <button
            onClick={() => onNavigate('my_saved')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">★</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.mySaved.title}</p>
                <p className="text-[11px] text-slate-500">
                  {lang === 'kz' ? 'Таңдаулы және жазылымдар' : 'Избранное, «Я иду» и подписки'}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          <button
            onClick={() => onNavigate('moderation')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🛡</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.moderation.title}</p>
                <p className="text-[11px] text-slate-500">
                  {role === 'moderator' || role === 'admin'
                    ? lang === 'kz'
                      ? 'Рұқсат бар'
                      : 'Доступ открыт'
                    : lang === 'kz'
                    ? 'RLS: 403 тексерісі'
                    : 'Требуется роль Модератор (проверка RLS)'}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          <button
            onClick={() => onNavigate('admin')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📡</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.admin.title}</p>
                <p className="text-[11px] text-slate-500">
                  {role === 'admin'
                    ? lang === 'kz'
                      ? 'Рұқсат бар'
                      : 'Источники, категории, роли'
                    : lang === 'kz'
                    ? 'RLS: 403 тексерісі'
                    : 'Требуется роль Админ (проверка RLS)'}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          <button
            onClick={() => onNavigate('system_states')}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">🧩</span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{t.states.title}</p>
                <p className="text-[11px] text-slate-500">
                  Экран 12 · F-04, F-06, F-48 (403)
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>
        </section>

        {/* PWA Install card */}
        <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-3.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-indigo-900">
              {lang === 'kz' ? 'Рядом PWA қолданбасы' : 'Приложение Рядом (PWA)'}
            </p>
            <p className="text-[11px] text-indigo-700">
              {lang === 'kz' ? 'Астана картасы офлайн да жұмыс істейді' : 'Работает офлайн и на экране «Домой»'}
            </p>
          </div>
          <PWAInstallButton lang={lang} />
        </div>

        {/* Notifications */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              {lang === 'kz' ? 'Хабарламалар' : 'Уведомления'} {unreadCount > 0 ? `(${unreadCount})` : ''}
            </h2>
            {unreadCount > 0 && (
              <button
                onClick={onMarkNotificationsRead}
                className="text-xs font-semibold text-indigo-600 cursor-pointer"
              >
                {lang === 'kz' ? 'Оқылды' : 'Прочитать все'}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center text-xs text-slate-400">
                {lang === 'kz' ? 'Жаңа хабарламалар жоқ' : 'Уведомлений пока нет'}
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => n.event_id && onSelectEvent(n.event_id)}
                  className={`rounded-2xl border p-3 shadow-sm cursor-pointer ${
                    n.is_read
                      ? 'bg-white border-slate-200'
                      : 'bg-indigo-50/60 border-indigo-200'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">
                    {lang === 'kz' ? n.title_kz : n.title_ru}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {lang === 'kz' ? n.body_kz : n.body_ru}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {formatAlmatyDateTime(n.created_at, lang)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
        </div>
      </main>
    </div>
  );
};
