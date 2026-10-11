/**
 * Public role catalog for server-rendered pages (role pages, catalog). Read-only endpoints, so
 * a plain fetch is enough; local dev reads the live catalog when VITE_API_URL is unset.
 */
import type { RoleInsightDetail, RoleInsightListItem } from "./api";

export const SITE_URL = "https://kachkivun.com";
const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "https://api.kachkivun.com";

export type RoleCatalog = {
  count: number;
  total: number;
  categories: string[];
  roles: RoleInsightListItem[];
};

export async function fetchRoleCatalog(): Promise<RoleCatalog | null> {
  try {
    const res = await fetch(`${API}/api/roles`);
    return res.ok ? ((await res.json()) as RoleCatalog) : null;
  } catch {
    return null;
  }
}

export async function fetchRoleDetail(slug: string): Promise<RoleInsightDetail | null> {
  try {
    const res = await fetch(`${API}/api/roles/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    return ((await res.json()) as { role: RoleInsightDetail }).role;
  } catch {
    return null;
  }
}

export const roleUrl = (slug: string) => `${SITE_URL}/roles/${encodeURIComponent(slug)}`;
