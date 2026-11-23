export type DeviceType = "Mobile" | "Tablet" | "Desktop" | "TV";
export type Frame = "island" | "notch" | "hole" | "home" | "tablet" | "browser" | "tv" | "none";

/** A screen view as the tester uses it (from /api/public/screen-views). */
export interface Device { id: string; name: string; brand: string; type: DeviceType; w: number; h: number; shape: Frame }
export interface PublicFamily { id: string; name: string; is_default: boolean; devices: Device[] }

/** A screen view as the admin manages it. */
export interface ScreenView {
  id: number; slug: string; name: string; brand: string; type: DeviceType; width: number; height: number; frame: Frame;
  is_active: boolean; sort_order: number; families?: { id: number; name: string }[]; families_count?: number; updated_at: string;
}
export interface Family {
  id: number; slug: string; name: string; description: string | null; is_active: boolean; is_default: boolean; sort_order: number;
  screen_view_ids: number[]; screen_views_count: number;
}
export interface Me {
  id: number; username: string; email: string | null; display_name: string | null; role: string; role_label: string;
  permissions: string[]; two_factor_enabled: boolean; two_factor_enforced: boolean; must_change_password: boolean;
  needs_profile: boolean; needs_two_factor: boolean; last_login_at: string | null; session_timeout_minutes: number; password_min_length: number;
}
export interface AdminUser {
  id: number; username: string; email: string | null; display_name: string | null; role: string; is_active: boolean;
  must_change_password: boolean; two_factor_confirmed_at: string | null; last_login_at: string | null; last_login_ip: string | null; created_at: string;
}
export interface AuditLog {
  id: number; created_at: string; username: string | null; action: string; status: "success" | "failed"; target_type: string | null;
  target_id: string | null; target_label: string | null; method: string | null; path: string | null; http_status: number | null;
  ip: string | null; user_agent: string | null; meta: Record<string, unknown> | null;
}
export interface SystemLog { id: number; created_at: string; level: string; channel: string | null; message: string; context: Record<string, unknown> | null; url: string | null; ip: string | null; user_id: number | null }
export interface Paged<T> { data: T[]; total: number; page: number; per_page: number }
