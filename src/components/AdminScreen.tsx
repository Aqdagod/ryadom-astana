import React, { useState } from 'react';
import { UserRole } from '../types/database';
import { Lang, TRANSLATIONS } from '../i18n/translations';
import { apiClient } from '../services/apiClient';
import { formatAlmatyFullStamp } from '../utils/time';
import { ForbiddenState } from './SystemStates';

interface AdminScreenProps {
  lang: Lang;
  onGoHome: () => void;
  onBack: () => void;
  onNotify: (msg: string) => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  lang,
  onGoHome,
  onBack,
  onNotify,
}) => {
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatRu, setNewCatRu] = useState('');
  const [newCatKz, setNewCatKz] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🎨');

  const t = TRANSLATIONS[lang].admin;

  // RLS check via apiClient
  const res = apiClient.getAdminData();
  if (res.error?.status === 403) {
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

  const { sources, categories, users } = res.data!;
  const activeCount = sources.filter((s) => s.is_active).length;

  const handleAddCat = async () => {
    const r = await apiClient.addCategory({
      name_ru: newCatRu,
      name_kz: newCatKz,
      icon: newCatIcon,
    });
    if (r.error) {
      onNotify(r.error.message);
      return;
    }
    setNewCatRu('');
    setNewCatKz('');
    setShowAddCat(false);
    onNotify(lang === 'kz' ? 'Санат қосылды' : 'Категория добавлена');
  };

  return (
    <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
      <header className="bg-white px-5 pt-2 lg:pt-4 pb-3 border-b border-slate-200 flex-none">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-slate-900 leading-tight">{t.title}</h1>
            <p className="text-[13px] text-slate-500">{t.subtitle}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">
            ADMIN
          </span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-sb px-4 py-4 lg:px-6 lg:py-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
        {/* Telegram Sources */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide">
              {t.channelsTitle}
            </h2>
            <span className="text-[11px] text-slate-400">
              {activeCount} / {sources.length} {t.activeCount}
            </span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
            {sources.map((src) => (
              <div key={src.id} className="flex items-center gap-3 p-3.5">
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[14px] font-semibold truncate ${
                      src.is_active ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {src.telegram_channel}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    last_fetched_at:{' '}
                    <span className="font-medium text-slate-700 tabular-nums">
                      {formatAlmatyFullStamp(src.last_fetched_at)}
                    </span>
                    {!src.is_active && (lang === 'kz' ? ' · өшірілген' : ' · отключён')}
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="sw"
                  checked={src.is_active}
                  onChange={async () => {
                    const r = await apiClient.toggleSourceActive(src.id);
                    if (r.error) onNotify(r.error.message);
                    else onNotify(`${src.telegram_channel}: ${!src.is_active ? 'ON' : 'OFF'}`);
                  }}
                  aria-label={src.telegram_channel}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide">
              {t.categoriesTitle}
            </h2>
            <button
              onClick={() => setShowAddCat(!showAddCat)}
              className="text-[12px] font-semibold text-indigo-600 cursor-pointer"
            >
              {t.addCategory}
            </button>
          </div>

          {showAddCat && (
            <div className="bg-white rounded-2xl border border-indigo-200 p-3 mb-2.5 space-y-2 shadow-sm">
              <div className="grid grid-cols-[52px_1fr] gap-2">
                <input
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="h-9 rounded-lg border border-slate-300 text-center text-base"
                  placeholder="🎨"
                />
                <input
                  value={newCatRu}
                  onChange={(e) => setNewCatRu(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                  placeholder="Название (RU)"
                />
              </div>
              <input
                value={newCatKz}
                onChange={(e) => setNewCatKz(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                placeholder="Атауы (KZ)"
              />
              <button
                onClick={handleAddCat}
                className="w-full h-9 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
              >
                {lang === 'kz' ? 'Сақтау' : 'Добавить категорию'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="px-3 h-8 inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 text-[13px] font-semibold"
              >
                <span>{cat.icon}</span>
                <span>{lang === 'kz' ? cat.name_kz : cat.name_ru}</span>
              </span>
            ))}
          </div>
        </section>
        </div>

        {/* Users & Roles */}
        <section>
          <h2 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide mb-2">
            {t.usersTitle}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
            {users.map((u) => (
              <div
                key={u.id}
                className={`p-3.5 ${u.is_blocked ? 'bg-red-50/50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full font-bold text-[13px] flex items-center justify-center ${
                      u.is_blocked
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    {u.avatar_initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">
                      {u.name}
                    </p>
                    <p
                      className={`text-[11px] ${
                        u.is_blocked ? 'text-red-600 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {u.is_blocked ? t.blocked : u.username || `tg:${u.telegram_id}`}
                    </p>
                  </div>
                  <select
                    value={u.role}
                    onChange={async (e) => {
                      const r = await apiClient.updateUserRole(u.id, e.target.value as UserRole);
                      if (r.error) onNotify(r.error.message);
                      else onNotify(`${u.name} → ${e.target.value}`);
                    }}
                    className="h-9 rounded-lg border border-slate-300 bg-white text-[12px] font-semibold text-slate-700 px-2"
                  >
                    <option value="user">user</option>
                    <option value="moderator">moderator</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <div className="flex items-center justify-between mt-2.5 pl-12">
                  <span
                    className={`text-[12px] ${
                      u.is_blocked ? 'text-red-700 font-medium' : 'text-slate-600'
                    }`}
                  >
                    {u.is_blocked ? t.blocked : t.block}
                  </span>
                  <input
                    type="checkbox"
                    className={`sw ${u.is_blocked ? 'sw-danger' : ''}`}
                    checked={u.is_blocked}
                    onChange={async () => {
                      const r = await apiClient.toggleUserBlocked(u.id);
                      if (r.error) onNotify(r.error.message);
                      else {
                        onNotify(
                          `${u.name}: ${!u.is_blocked ? 'заблокирован' : 'разблокирован'}`
                        );
                      }
                    }}
                    aria-label={t.block}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        </div>
      </main>
    </div>
  );
};
