/** Stable React Query keys — keep in sync with persist + prefetch helpers. */

export const queryKeys = {
  session: (tokenPresent: boolean) => ["session", tokenPresent] as const,
  dashboard: (token: string | null) => ["dashboard", token] as const,
  matchHistory: (token: string | null) => ["match-history", token] as const,
  adminMe: (token: string | null) => ["admin-me", token] as const,
  adminOverview: (token: string | null) => ["admin-overview", token] as const,
  adminUsers: (token: string | null, search: string) => ["admin-users", token, search] as const,
  adminSecurityOverview: (token: string | null) => ["admin-security-overview", token] as const,
  adminSecurityEvents: (token: string | null, filters: string) =>
    ["admin-security-events", token, filters] as const,
  adminBlockedIps: (token: string | null) => ["admin-blocked-ips", token] as const,
};
