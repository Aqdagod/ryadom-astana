export type UserRole = 'guest' | 'user' | 'moderator' | 'admin';

export type EventStatus =
  | 'draft'
  | 'pending_moderation'
  | 'published'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export type ReportReason =
  | 'spam'
  | 'wrong_info'
  | 'offensive'
  | 'fraud'
  | 'copyright';

export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type TimelineFilter = 'all' | 'today' | 'tomorrow' | 'weekend';

export type ApiErrorCode =
  | 'EMPTY_LIST'
  | 'NO_GEO'
  | 'VALIDATION_FAILED'
  | 'INVALID_FILTER'
  | 'UNAUTHORIZED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'USER_DEACTIVATED'
  | 'NOT_FOUND'
  | 'DUPLICATE_ENTRY'
  | 'CONCURRENCY_CONFLICT'
  | 'INVALID_FILE'
  | 'INVALID_STATUS_TRANSITION'
  | 'CANNOT_DEACTIVATE_SELF'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

// RFC 9457 ProblemDetails-compatible API error contract
export interface ApiError {
  type: string;
  title: string;
  status: number;
  code: ApiErrorCode;
  detail: string;
  traceId: string;
  timestamp: string;
  // UI compatibility fields
  message: string;
  details?: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

// === 11 Core Domain Entities (TZ v1.1 / Week 8 ER-model) ===

// 1. User
export interface User {
  id: string;
  telegram_id: string;
  name: string;
  username?: string;
  role: UserRole;
  is_blocked: boolean;
  avatar_initials: string;
  bio_ru?: string;
  bio_kz?: string;
  created_at: string;
}

// 2. Category
export interface Category {
  id: string;
  slug: string;
  name_ru: string;
  name_kz: string;
  icon: string;
  color: string;
  bg_soft: string;
  text_color: string;
  is_active: boolean;
}

// 3. Event
export interface Event {
  id: string;
  title: string;
  description: string;
  category_id: string;
  author_id: string;
  status: EventStatus;
  starts_at: string;
  ends_at: string;
  lat: number;
  lng: number;
  address: string;
  district: string;
  price: number;
  poster_url?: string;
  poster_gradient?: string;
  source_url?: string;
  is_auto_collected: boolean;
  llm_confidence?: number;
  attendees_count: number;
  views_count: number;
  favorites_count: number;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

// 4. Moderation
export interface Moderation {
  id: string;
  event_id: string;
  moderator_id: string;
  action: 'approved' | 'rejected' | 'edited';
  reason?: string;
  created_at: string;
}

// 5. Attendance
export interface Attendance {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
}

// 6. Favorite
export interface Favorite {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
}

// 7. Subscription
export interface Subscription {
  id: string;
  user_id: string;
  target_type: 'category' | 'author';
  target_id: string;
  created_at: string;
}

// 8. Report
export interface Report {
  id: string;
  event_id: string;
  reporter_id: string;
  reason: ReportReason;
  comment?: string;
  status: ReportStatus;
  created_at: string;
}

// 9. Source
export interface Source {
  id: string;
  name: string;
  telegram_channel: string;
  is_active: boolean;
  last_fetched_at: string;
  events_collected_count: number;
}

// 10. EventSource
export interface EventSource {
  id: string;
  event_id: string;
  source_id: string;
  external_post_id: string;
  external_url: string;
  raw_text?: string;
  parsed_at: string;
}

// 11. Notification
export interface Notification {
  id: string;
  user_id: string;
  type: 'event_approved' | 'event_rejected' | 'event_cancelled' | 'new_from_subscription' | 'reminder';
  title_ru: string;
  title_kz: string;
  body_ru: string;
  body_kz: string;
  event_id?: string;
  is_read: boolean;
  created_at: string;
}

// === DTOs & UI State Types ===

export interface EventFilters {
  timeline: TimelineFilter;
  categoryIds: string[];
  freeOnly: boolean;
  radiusKm: number;
  search: string;
  userLat?: number;
  userLng?: number;
}

export interface NearbyEventResult {
  event: Event;
  distanceKm: number;
}

export interface EventDraftInput {
  id?: string;
  title: string;
  description: string;
  category_id: string;
  starts_at: string;
  ends_at: string;
  lat: number;
  lng: number;
  address: string;
  district: string;
  price: number;
  poster_url?: string;
  poster_gradient?: string;
}

export type AppScreen =
  | 'map'
  | 'list'
  | 'event_detail'
  | 'create_event'
  | 'my_saved'
  | 'author_profile'
  | 'my_events'
  | 'moderation'
  | 'admin'
  | 'profile'
  | 'system_states';

export type PendingAuthAction =
  | { type: 'attend'; eventId: string }
  | { type: 'favorite'; eventId: string }
  | { type: 'subscribe'; targetType: 'category' | 'author'; targetId: string }
  | { type: 'report'; eventId: string }
  | { type: 'create_event' }
  | { type: 'navigate'; screen: AppScreen };
