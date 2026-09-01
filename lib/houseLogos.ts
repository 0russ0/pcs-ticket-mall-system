const HOUSE_LOGO_SLUGS: Record<string, string> = {
  "Rachel Carson House": "rachel-carson",
  "Clemente House": "clemente",
  "Hot Metal House": "hot-metal",
  "Liberty House": "liberty",
};

export function houseBadgeUrl(team: string): string | null {
  const slug = HOUSE_LOGO_SLUGS[team];
  return slug ? `/houses/${slug}-badge.png` : null;
}

export function houseLogoUrl(team: string): string | null {
  const slug = HOUSE_LOGO_SLUGS[team];
  return slug ? `/houses/${slug}-logo.png` : null;
}

export const ALL_HOUSE_LOGOS = Object.entries(HOUSE_LOGO_SLUGS).map(([team, slug]) => ({
  team,
  logoUrl: `/houses/${slug}-logo.png`,
  badgeUrl: `/houses/${slug}-badge.png`,
}));
