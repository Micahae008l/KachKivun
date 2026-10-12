import thresholds from "@/content/blog/role-thresholds.json";
import { RoleTable, type RoleFact } from "./Prose";

type Threshold = {
  title: string;
  category: string;
  combat: boolean;
  dapar: number | null;
  profile: number | null;
};

const ROLES = thresholds as Threshold[];

/** Roles whose verified minimum equals the given profile or דפ"ר, straight from the catalog data. */
export function VerifiedRoles({ profile, dapar }: { profile?: number; dapar?: number }) {
  const rows: RoleFact[] = ROLES.filter(
    (r) => (profile == null || r.profile === profile) && (dapar == null || r.dapar === dapar),
  ).map((r) => ({
    title: r.title,
    dapar: r.dapar ?? undefined,
    profile: r.profile ?? undefined,
    note: r.category,
  }));
  return <RoleTable roles={rows} />;
}

export const verifiedRoleCount = ROLES.length;
