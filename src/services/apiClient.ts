import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type {
  ApiError,
  ApiErrorCode,
  ApiResponse,
  Attendance,
  Category,
  Event,
  EventDraftInput,
  EventFilters,
  EventSource,
  EventStatus,
  Favorite,
  Moderation,
  NearbyEventResult,
  Notification,
  Report,
  ReportReason,
  Source,
  Subscription,
  User,
  UserRole,
} from '../types/database';
import { ASTANA_CENTER, haversineKm, matchesTimeline } from '../utils/time';

export interface DatabaseState {
  users: User[];
  categories: Category[];
  events: Event[];
  moderations: Moderation[];
  attendances: Attendance[];
  favorites: Favorite[];
  subscriptions: Subscription[];
  reports: Report[];
  sources: Source[];
  eventSources: EventSource[];
  notifications: Notification[];
  currentUserId: string | null;
}

export interface TelegramWidgetPayload {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    public readonly title: string,
    public readonly detail?: string
  ) {
    super(title);
  }
}

const ALLOWED_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ['pending_moderation', 'cancelled'],
  pending_moderation: ['published', 'rejected', 'cancelled'],
  published: ['cancelled', 'rejected', 'completed'],
  rejected: ['draft'],
  cancelled: [],
  completed: [],
};

function traceId(): string {
  const rand = Math.random().toString(16).slice(2, 10).padEnd(8, '0');
  return `00-${Date.now().toString(16).slice(-8)}${rand}-01`;
}

function makeError(status: number, code: ApiErrorCode, title: string, detail?: string): ApiError {
  return {
    type: `/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title,
    status,
    code,
    detail: detail || title,
    traceId: traceId(),
    timestamp: new Date().toISOString(),
    message: title,
  };
}

function toApiError(err: unknown): ApiError {
  if (err instanceof AppError) {
    return makeError(err.status, err.code, err.title, err.detail);
  }
  const pg = err as { code?: string; message?: string } | null;
  if (pg?.code === '23505') return makeError(409, 'DUPLICATE_ENTRY', 'Запись уже существует', pg.message);
  if (pg?.code === '42501') return makeError(403, 'FORBIDDEN', 'Доступ запрещён', pg.message);
  if (pg?.code === 'PGRST116') return makeError(404, 'NOT_FOUND', 'Запись не найдена', pg.message);
  return makeError(500, 'INTERNAL_ERROR', 'Ошибка сервера', err instanceof Error ? err.message : pg?.message);
}

function assertStatusTransition(from: EventStatus, to: EventStatus): void {
  if (from !== to && !ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new AppError(422, 'INVALID_STATUS_TRANSITION', 'Недопустимый переход статуса события');
  }
}

function assertValidDraft(input: EventDraftInput): void {
  const title = input.title.trim();
  if (title.length < 3 || title.length > 100) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Название должно быть от 3 до 100 символов');
  }
  const sMs = new Date(input.starts_at).getTime();
  const eMs = new Date(input.ends_at).getTime();
  if (Number.isNaN(sMs) || Number.isNaN(eMs) || eMs <= sMs) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Время окончания должно быть позже начала');
  }
  if (sMs < Date.now() - 5 * 60 * 1000) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Дата начала не может быть в прошлом');
  }
  if (input.lat < 50.95 || input.lat > 51.30 || input.lng < 71.20 || input.lng > 71.65) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Точка должна находиться в пределах Астаны');
  }
  if (input.price < 0 || Number.isNaN(input.price)) {
    throw new AppError(400, 'VALIDATION_FAILED', 'Цена не может быть отрицательной');
  }
}

class SupabaseApiClient {
  private state: DatabaseState = {
    users: [],
    categories: [],
    events: [],
    moderations: [],
    attendances: [],
    favorites: [],
    subscriptions: [],
    reports: [],
    sources: [],
    eventSources: [],
    notifications: [],
    currentUserId: null,
  };
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    if (this.initialized || typeof window === 'undefined' || !isSupabaseConfigured) return;
    this.initialized = true;

    void this.refresh();

    supabase.auth.onAuthStateChange((_ev, session) => {
      this.state = { ...this.state, currentUserId: session?.user?.id ?? null };
      this.emit();
      void this.refresh();
    });

    supabase
      .channel('ryadom-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => void this.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => void this.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => void this.refresh())
      .subscribe();
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): DatabaseState {
    return this.state;
  }

  private getCurrentUser(): User | null {
    if (!this.state.currentUserId) return null;
    return this.state.users.find((u) => u.id === this.state.currentUserId) || null;
  }

  private requireUser(): User {
    const user = this.getCurrentUser();
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Войдите через Telegram');
    if (user.is_blocked) throw new AppError(403, 'USER_DEACTIVATED', 'Аккаунт заблокирован');
    return user;
  }

  private requireRole(roles: readonly UserRole[]): User {
    const user = this.requireUser();
    if (!roles.includes(user.role)) throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав');
    return user;
  }

  private async run<T>(work: () => Promise<T>): Promise<ApiResponse<T>> {
    try {
      return { data: await work(), error: null };
    } catch (err) {
      const error = toApiError(err);
      if (error.status === 200 && error.code === 'EMPTY_LIST') {
        return { data: ([] as unknown) as T, error };
      }
      return { data: null, error };
    }
  }

  async refresh(): Promise<void> {
    if (!isSupabaseConfigured) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id ?? null;

    const [categoriesRes, eventsRes, usersRes, eventSourcesRes] = await Promise.all([
      supabase.from('categories').select('*').order('name_ru', { ascending: true }),
      supabase.from('events').select('*').order('starts_at', { ascending: true }),
      supabase.from('users').select('*'),
      supabase.from('event_sources').select('*'),
    ]);

    const users = (usersRes.data as User[] | null) || [];
    const currentUser = uid ? users.find((u) => u.id === uid) || null : null;

    let attendances: Attendance[] = [];
    let favorites: Favorite[] = [];
    let subscriptions: Subscription[] = [];
    let notifications: Notification[] = [];
    let reports: Report[] = [];
    let moderations: Moderation[] = [];
    let sources: Source[] = [];

    if (uid) {
      const [attRes, favRes, subRes, notifRes] = await Promise.all([
        supabase.from('attendances').select('*').eq('user_id', uid),
        supabase.from('favorites').select('*').eq('user_id', uid),
        supabase.from('subscriptions').select('*').eq('user_id', uid),
        supabase.from('notifications').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      ]);
      attendances = (attRes.data as Attendance[] | null) || [];
      favorites = (favRes.data as Favorite[] | null) || [];
      subscriptions = (subRes.data as Subscription[] | null) || [];
      notifications = (notifRes.data as Notification[] | null) || [];

      if (currentUser?.role === 'moderator' || currentUser?.role === 'admin') {
        const [repRes, modRes] = await Promise.all([
          supabase.from('reports').select('*').order('created_at', { ascending: false }),
          supabase.from('moderations').select('*').order('created_at', { ascending: false }),
        ]);
        reports = (repRes.data as Report[] | null) || [];
        moderations = (modRes.data as Moderation[] | null) || [];
      }

      if (currentUser?.role === 'admin') {
        const srcRes = await supabase.from('sources').select('*').order('name', { ascending: true });
        sources = (srcRes.data as Source[] | null) || [];
      }
    }

    this.state = {
      currentUserId: uid,
      categories: (categoriesRes.data as Category[] | null) || [],
      events: (eventsRes.data as Event[] | null) || [],
      users,
      eventSources: (eventSourcesRes.data as EventSource[] | null) || [],
      attendances,
      favorites,
      subscriptions,
      notifications,
      reports,
      moderations,
      sources,
    };
    this.emit();
  }

  async authTelegram(payload: TelegramWidgetPayload): Promise<ApiResponse<User>> {
    return this.run(async () => {
      const { data, error } = await supabase.functions.invoke('auth-telegram', { body: payload });
      if (error) throw new AppError(401, 'UNAUTHORIZED', 'Ошибка авторизации через Telegram', error.message);

      const res = data as {
        access_token?: string;
        refresh_token?: string;
        user?: User;
        code?: string;
        message?: string;
      } | null;

      if (!res?.access_token || !res?.refresh_token || !res?.user) {
        throw new AppError(
          res?.code === 'USER_DEACTIVATED' ? 403 : 401,
          res?.code === 'USER_DEACTIVATED' ? 'USER_DEACTIVATED' : 'UNAUTHORIZED',
          res?.message || 'Неверная подпись Telegram'
        );
      }

      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (sessionErr) throw sessionErr;

      await this.refresh();
      return res.user;
    });
  }

  async logout(): Promise<void> {
    await supabase.auth.signOut();
    await this.refresh();
  }

  getPublishedEvents(filters: EventFilters): ApiResponse<Event[]> {
    const refLat = filters.userLat ?? ASTANA_CENTER[0];
    const refLng = filters.userLng ?? ASTANA_CENTER[1];
    const searchLower = filters.search.trim().toLowerCase();
    const nowMs = Date.now();

    const filtered = this.state.events.filter((ev) => {
      if (ev.status !== 'published') return false;
      if (new Date(ev.ends_at).getTime() <= nowMs) return false;
      if (!matchesTimeline(ev.starts_at, filters.timeline)) return false;
      if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(ev.category_id)) return false;
      if (filters.freeOnly && ev.price > 0) return false;
      if (filters.radiusKm > 0 && haversineKm(refLat, refLng, ev.lat, ev.lng) > filters.radiusKm) return false;
      if (searchLower) {
        const hay = `${ev.title} ${ev.address} ${ev.district} ${ev.description}`.toLowerCase();
        if (!hay.includes(searchLower)) return false;
      }
      return true;
    });

    return filtered.length > 0
      ? { data: filtered, error: null }
      : { data: [], error: makeError(200, 'EMPTY_LIST', 'Событий по фильтрам не найдено') };
  }

  async getNearbyEventsRPC(params: {
    lat: number;
    lng: number;
    radiusKm?: number;
    windowHours?: number;
  }): Promise<ApiResponse<NearbyEventResult[]>> {
    return this.run(async () => {
      if (!isSupabaseConfigured) return [];

      const radiusKm = params.radiusKm ?? 5;
      const windowHours = params.windowHours ?? 3;

      let rpcRes = await supabase.rpc('get_nearby_events', {
        lat: params.lat,
        lng: params.lng,
        radius_km: radiusKm,
        window_hours: windowHours,
      });

      if (rpcRes.error?.code === 'PGRST202') {
        rpcRes = await supabase.rpc('get_nearby_events', {
          user_lat: params.lat,
          user_lng: params.lng,
          radius_km: radiusKm,
          window_hours: windowHours,
        });
      }

      if (rpcRes.error) throw rpcRes.error;

      type RpcRow = Event & { distance_km?: number; dist_km?: number; distanceKm?: number };
      const rows = (rpcRes.data as RpcRow[] | null) || [];

      const results: NearbyEventResult[] = rows
        .map((row) => ({
          event: row,
          distanceKm:
            typeof row.distance_km === 'number'
              ? Number(row.distance_km.toFixed(1))
              : typeof row.distanceKm === 'number'
              ? Number(row.distanceKm.toFixed(1))
              : typeof row.dist_km === 'number'
              ? Number(row.dist_km.toFixed(1))
              : haversineKm(params.lat, params.lng, row.lat, row.lng),
        }))
        .slice(0, 3);

      if (results.length === 0) {
        throw new AppError(200, 'EMPTY_LIST', 'Рядом пока ничего нет');
      }
      return results;
    });
  }

  async uploadPoster(file: File): Promise<ApiResponse<string>> {
    return this.run(async () => {
      const user = this.requireUser();
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        throw new AppError(415, 'INVALID_FILE', 'Допустимы только файлы JPG или PNG');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new AppError(413, 'INVALID_FILE', 'Размер файла не должен превышать 5 МБ');
      }

      const ext = file.type === 'image/png' ? 'png' : 'jpg';
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from('posters')
        .upload(filePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;

      return supabase.storage.from('posters').getPublicUrl(filePath).data.publicUrl;
    });
  }

  async toggleAttendance(eventId: string): Promise<ApiResponse<{ attending: boolean; attendees_count: number }>> {
    return this.run(async () => {
      const user = this.requireUser();
      const ev = this.state.events.find((e) => e.id === eventId);
      if (!ev) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');
      if (ev.status !== 'published') throw new AppError(422, 'INVALID_STATUS_TRANSITION', 'Событие не опубликовано');

      const existing = this.state.attendances.find((a) => a.event_id === eventId && a.user_id === user.id);
      if (existing) {
        const { error } = await supabase.from('attendances').delete().eq('id', existing.id);
        if (error) throw error;
        const nextCount = Math.max(0, ev.attendees_count - 1);
        await supabase.from('events').update({ attendees_count: nextCount }).eq('id', eventId);
        await this.refresh();
        return { attending: false, attendees_count: nextCount };
      }

      const { error } = await supabase.from('attendances').insert({ event_id: eventId, user_id: user.id });
      if (error) throw error;
      const nextCount = ev.attendees_count + 1;
      await supabase.from('events').update({ attendees_count: nextCount }).eq('id', eventId);
      await this.refresh();
      return { attending: true, attendees_count: nextCount };
    });
  }

  async toggleFavorite(eventId: string): Promise<ApiResponse<{ favorited: boolean }>> {
    return this.run(async () => {
      const user = this.requireUser();
      const ev = this.state.events.find((e) => e.id === eventId);
      if (!ev) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');

      const existing = this.state.favorites.find((f) => f.event_id === eventId && f.user_id === user.id);
      if (existing) {
        const { error } = await supabase.from('favorites').delete().eq('id', existing.id);
        if (error) throw error;
        await supabase.from('events').update({ favorites_count: Math.max(0, ev.favorites_count - 1) }).eq('id', eventId);
        await this.refresh();
        return { favorited: false };
      }

      const { error } = await supabase.from('favorites').insert({ event_id: eventId, user_id: user.id });
      if (error) throw error;
      await supabase.from('events').update({ favorites_count: ev.favorites_count + 1 }).eq('id', eventId);
      await this.refresh();
      return { favorited: true };
    });
  }

  async toggleSubscription(targetType: 'category' | 'author', targetId: string): Promise<ApiResponse<{ subscribed: boolean }>> {
    return this.run(async () => {
      const user = this.requireUser();
      const existing = this.state.subscriptions.find(
        (s) => s.user_id === user.id && s.target_type === targetType && s.target_id === targetId
      );

      if (existing) {
        const { error } = await supabase.from('subscriptions').delete().eq('id', existing.id);
        if (error) throw error;
        await this.refresh();
        return { subscribed: false };
      }

      const { error } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        target_type: targetType,
        target_id: targetId,
      });
      if (error) throw error;
      await this.refresh();
      return { subscribed: true };
    });
  }

  async submitReport(eventId: string, reason: ReportReason, comment?: string): Promise<ApiResponse<Report>> {
    return this.run(async () => {
      const user = this.requireUser();
      const { data, error } = await supabase
        .from('reports')
        .insert({
          event_id: eventId,
          reporter_id: user.id,
          reason,
          comment: comment?.trim() || null,
          status: 'open',
        })
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as Report;
    });
  }

  async saveEventDraft(input: EventDraftInput, submitImmediately = false): Promise<ApiResponse<Event>> {
    return this.run(async () => {
      const user = this.requireUser();
      assertValidDraft(input);
      const targetStatus: Event['status'] = submitImmediately ? 'pending_moderation' : 'draft';
      const nowIso = new Date().toISOString();

      if (input.id) {
        const existing = this.state.events.find((e) => e.id === input.id);
        if (!existing) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');
        if (existing.author_id !== user.id && user.role !== 'admin' && user.role !== 'moderator') {
          throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав');
        }
        assertStatusTransition(existing.status, targetStatus);

        const { data, error } = await supabase
          .from('events')
          .update({
            title: input.title.trim(),
            description: input.description.trim(),
            category_id: input.category_id,
            starts_at: input.starts_at,
            ends_at: input.ends_at,
            lat: input.lat,
            lng: input.lng,
            address: input.address.trim(),
            district: input.district,
            price: input.price,
            poster_url: input.poster_url || null,
            poster_gradient: input.poster_gradient || existing.poster_gradient,
            status: targetStatus,
            rejection_reason: null,
            updated_at: nowIso,
          })
          .eq('id', input.id)
          .select('*')
          .single();
        if (error) throw error;
        await this.refresh();
        return data as Event;
      }

      const { data, error } = await supabase
        .from('events')
        .insert({
          title: input.title.trim(),
          description: input.description.trim() || 'Локальное мероприятие в Астане. Присоединяйтесь!',
          category_id: input.category_id,
          author_id: user.id,
          status: targetStatus,
          starts_at: input.starts_at,
          ends_at: input.ends_at,
          lat: input.lat,
          lng: input.lng,
          address: input.address.trim() || 'Астана, центр города',
          district: input.district || 'Есильский',
          price: input.price,
          poster_url: input.poster_url || null,
          poster_gradient: input.poster_gradient || 'linear-gradient(135deg,#4F46E5,#10B981)',
          is_auto_collected: false,
          attendees_count: 0,
          views_count: 0,
          favorites_count: 0,
        })
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as Event;
    });
  }

  async submitDraftToModeration(eventId: string): Promise<ApiResponse<Event>> {
    return this.run(async () => {
      this.requireUser();
      const ev = this.state.events.find((e) => e.id === eventId);
      if (!ev) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');
      assertStatusTransition(ev.status, 'pending_moderation');

      const { data, error } = await supabase
        .from('events')
        .update({ status: 'pending_moderation', rejection_reason: null, updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as Event;
    });
  }

  async returnRejectedToDraft(eventId: string): Promise<ApiResponse<Event>> {
    return this.run(async () => {
      this.requireUser();
      const ev = this.state.events.find((e) => e.id === eventId);
      if (!ev) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');
      assertStatusTransition(ev.status, 'draft');

      const { data, error } = await supabase
        .from('events')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as Event;
    });
  }

  async cancelMyEvent(eventId: string): Promise<ApiResponse<Event>> {
    return this.run(async () => {
      this.requireUser();
      const ev = this.state.events.find((e) => e.id === eventId);
      if (!ev) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');
      if (ev.status === 'published' && new Date(ev.starts_at).getTime() <= Date.now()) {
        throw new AppError(422, 'INVALID_STATUS_TRANSITION', 'Нельзя отменить уже начавшееся событие');
      }
      assertStatusTransition(ev.status, 'cancelled');

      const { data, error } = await supabase
        .from('events')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('*')
        .single();
      if (error) throw error;

      const { data: attendees } = await supabase.from('attendances').select('user_id').eq('event_id', eventId);
      if (attendees && attendees.length > 0) {
        await supabase.from('notifications').insert(
          attendees.map((a: { user_id: string }) => ({
            user_id: a.user_id,
            type: 'event_cancelled',
            title_ru: ev.title,
            title_kz: ev.title,
            body_ru: `Событие «${ev.title}» отменено`,
            body_kz: `«${ev.title}» оқиғасы тоқтатылды`,
            event_id: ev.id,
            is_read: false,
          }))
        );
      }

      await this.refresh();
      return data as Event;
    });
  }

  getModerationQueue(): ApiResponse<Event[]> {
    try {
      this.requireRole(['moderator', 'admin']);
      return { data: this.state.events.filter((e) => e.status === 'pending_moderation'), error: null };
    } catch (err) {
      return { data: null, error: toApiError(err) };
    }
  }

  async editEventAsModerator(
    eventId: string,
    patch: Partial<Pick<Event, 'title' | 'address' | 'price' | 'category_id' | 'starts_at' | 'ends_at'>>
  ): Promise<ApiResponse<Event>> {
    return this.run(async () => {
      const mod = this.requireRole(['moderator', 'admin']);
      const { data, error } = await supabase
        .from('events')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', eventId)
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('moderations').insert({ event_id: eventId, moderator_id: mod.id, action: 'edited' });
      await this.refresh();
      return data as Event;
    });
  }

  async moderateEvent(
    eventId: string,
    action: 'approved' | 'rejected',
    reason?: string
  ): Promise<ApiResponse<Event>> {
    return this.run(async () => {
      const mod = this.requireRole(['moderator', 'admin']);
      const ev = this.state.events.find((e) => e.id === eventId);
      if (!ev) throw new AppError(404, 'NOT_FOUND', 'Событие не найдено');

      const nowIso = new Date().toISOString();
      if (action === 'rejected') {
        const cleanReason = (reason || '').trim();
        if (cleanReason.length < 10) {
          throw new AppError(400, 'VALIDATION_FAILED', 'Причина отклонения должна содержать минимум 10 символов');
        }
        assertStatusTransition(ev.status, 'rejected');

        const { data, error } = await supabase
          .from('events')
          .update({ status: 'rejected', rejection_reason: cleanReason, updated_at: nowIso })
          .eq('id', eventId)
          .select('*')
          .single();
        if (error) throw error;

        await supabase.from('moderations').insert({
          event_id: eventId,
          moderator_id: mod.id,
          action: 'rejected',
          reason: cleanReason,
        });
        await supabase.from('notifications').insert({
          user_id: ev.author_id,
          type: 'event_rejected',
          title_ru: `Событие «${ev.title}» отклонено`,
          title_kz: `«${ev.title}» оқиғасы қабылданбады`,
          body_ru: cleanReason,
          body_kz: cleanReason,
          event_id: ev.id,
          is_read: false,
        });

        await this.refresh();
        return data as Event;
      }

      assertStatusTransition(ev.status, 'published');
      const { data, error } = await supabase
        .from('events')
        .update({ status: 'published', rejection_reason: null, updated_at: nowIso })
        .eq('id', eventId)
        .select('*')
        .single();
      if (error) throw error;

      await supabase.from('moderations').insert({ event_id: eventId, moderator_id: mod.id, action: 'approved' });
      await supabase.from('notifications').insert({
        user_id: ev.author_id,
        type: 'event_approved',
        title_ru: `Событие «${ev.title}» опубликовано на карте`,
        title_kz: `«${ev.title}» оқиғасы картада жарияланды`,
        body_ru: 'Теперь его видят все жители Астаны.',
        body_kz: 'Енді оны Астананың барлық тұрғындары көре алады.',
        event_id: ev.id,
        is_read: false,
      });

      await this.refresh();
      return data as Event;
    });
  }

  async resolveReport(reportId: string, resolution: 'resolved' | 'dismissed'): Promise<ApiResponse<Report>> {
    return this.run(async () => {
      this.requireRole(['moderator', 'admin']);
      const rep = this.state.reports.find((r) => r.id === reportId);
      if (!rep) throw new AppError(404, 'NOT_FOUND', 'Жалоба не найдена');
      if (rep.status !== 'open') throw new AppError(409, 'CONCURRENCY_CONFLICT', 'Жалоба уже обработана');

      const { data, error } = await supabase
        .from('reports')
        .update({ status: resolution })
        .eq('id', reportId)
        .select('*')
        .single();
      if (error) throw error;

      if (resolution === 'resolved') {
        await supabase
          .from('events')
          .update({
            status: 'rejected',
            rejection_reason: 'Снято модератором по жалобе пользователей',
            updated_at: new Date().toISOString(),
          })
          .eq('id', rep.event_id);
      }

      await this.refresh();
      return data as Report;
    });
  }

  getAdminData(): ApiResponse<{ sources: Source[]; categories: Category[]; users: User[] }> {
    try {
      this.requireRole(['admin']);
      return {
        data: { sources: this.state.sources, categories: this.state.categories, users: this.state.users },
        error: null,
      };
    } catch (err) {
      return { data: null, error: toApiError(err) };
    }
  }

  async toggleSourceActive(sourceId: string): Promise<ApiResponse<Source>> {
    return this.run(async () => {
      this.requireRole(['admin']);
      const src = this.state.sources.find((s) => s.id === sourceId);
      if (!src) throw new AppError(404, 'NOT_FOUND', 'Источник не найден');

      const nextActive = !src.is_active;
      const { data, error } = await supabase
        .from('sources')
        .update({
          is_active: nextActive,
          last_fetched_at: nextActive ? new Date().toISOString() : src.last_fetched_at,
        })
        .eq('id', sourceId)
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as Source;
    });
  }

  async addCategory(payload: { name_ru: string; name_kz: string; icon: string }): Promise<ApiResponse<Category>> {
    return this.run(async () => {
      this.requireRole(['admin']);
      const nameRu = payload.name_ru.trim();
      if (nameRu.length < 2) throw new AppError(400, 'VALIDATION_FAILED', 'Введите название категории');

      const { data, error } = await supabase
        .from('categories')
        .insert({
          slug: `cat-${Date.now()}`,
          name_ru: nameRu,
          name_kz: payload.name_kz.trim() || nameRu,
          icon: payload.icon || '✨',
          color: '#4F46E5',
          bg_soft: '#EEF2FF',
          text_color: '#4338CA',
          is_active: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as Category;
    });
  }

  async updateUserRole(userId: string, role: UserRole): Promise<ApiResponse<User>> {
    return this.run(async () => {
      const admin = this.requireRole(['admin']);
      if (admin.id === userId && role !== 'admin') {
        throw new AppError(422, 'CANNOT_DEACTIVATE_SELF', 'Нельзя понизить собственную роль администратора');
      }
      const { data, error } = await supabase.from('users').update({ role }).eq('id', userId).select('*').single();
      if (error) throw error;
      await this.refresh();
      return data as User;
    });
  }

  async toggleUserBlocked(userId: string): Promise<ApiResponse<User>> {
    return this.run(async () => {
      const admin = this.requireRole(['admin']);
      if (admin.id === userId) {
        throw new AppError(422, 'CANNOT_DEACTIVATE_SELF', 'Нельзя заблокировать свою учётную запись');
      }
      const target = this.state.users.find((u) => u.id === userId);
      if (!target) throw new AppError(404, 'NOT_FOUND', 'Пользователь не найден');

      const { data, error } = await supabase
        .from('users')
        .update({ is_blocked: !target.is_blocked })
        .eq('id', userId)
        .select('*')
        .single();
      if (error) throw error;
      await this.refresh();
      return data as User;
    });
  }

  async markNotificationsRead(): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    await this.refresh();
  }

  async runExpirationCron(): Promise<number> {
    await this.refresh();
    return 0;
  }
}

export const apiClient = new SupabaseApiClient();
