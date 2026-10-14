/**
 * Public role catalog for server-rendered pages (role pages, catalog). Read-only endpoints;
 * local dev reads the live catalog when VITE_API_URL is unset.
 */
import { createServerFn } from "@tanstack/react-start";
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

// On Cloudflare, cache these reads at the edge for 5 minutes (ignored elsewhere): a crawl of
// every role page then barely reaches the API.
const EDGE_CACHE = { cf: { cacheTtl: 300, cacheEverything: true } } as RequestInit;

// Server functions: the browser never calls the API directly for these, so client-side
// navigation works from any origin (local preview included) and matches the server render.
const loadCatalog = createServerFn({ method: "GET" }).handler(
  async (): Promise<RoleCatalog | null> => {
    try {
      const res = await fetch(`${API}/api/roles`, EDGE_CACHE);
      return res.ok ? ((await res.json()) as RoleCatalog) : null;
    } catch {
      return null;
    }
  },
);

const loadDetail = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }): Promise<RoleInsightDetail | null> => {
    // null only when the API says the role does not exist (a real 404). Anything else (rate
    // limit, outage, network) throws, so the page answers with a server error that crawlers
    // retry, instead of a 404 that gets the page dropped from search.
    const res = await fetch(`${API}/api/roles/${encodeURIComponent(slug)}`, EDGE_CACHE);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Role lookup failed: ${res.status}`);
    return ((await res.json()) as { role: RoleInsightDetail }).role;
  });

export const fetchRoleCatalog = () => loadCatalog();
export const fetchRoleDetail = (slug: string) => loadDetail({ data: slug });

export const roleUrl = (slug: string) => `${SITE_URL}/roles/${encodeURIComponent(slug)}`;
