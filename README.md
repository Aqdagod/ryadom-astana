# Рядом — интерактивная карта мероприятий Астаны

Веб-приложение (PWA) и Telegram-экосистема для поиска и публикации локальных городских, студенческих и культурных событий в Астане.

## Технологический стек
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Leaflet (OpenStreetMap), PWA
- **Backend & DB:** Supabase (PostgreSQL, PostGIS, Row Level Security, Edge Functions, Storage)
- **Hosting:** Vercel Edge Network

## Локальный запуск
1. Установите зависимости: `npm install`
2. Скопируйте `.env.example` в `.env` и укажите `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT_USERNAME`
3. Запустите проект: `npm run dev`
