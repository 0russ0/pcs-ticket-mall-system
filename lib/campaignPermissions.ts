// Shared rule for who can edit/delete a campaign — used by the PATCH/DELETE routes
// and by both campaign detail pages to decide whether to show the buttons at all.
// Admins manage everything. Power users manage any house-scoped campaign (not just
// ones they personally created — they already see/award on all of these via the
// campaigns list filter). The creator of a campaign can also always manage their
// own, regardless of role, which mainly covers future creator types.
export function canManageCampaign(
  session: { role: string; staffId: number | null },
  campaign: { createdByStaffId: number | null; audienceFilter: unknown }
): boolean {
  if (session.role === "admin") return true;
  if (session.staffId != null && campaign.createdByStaffId === session.staffId) return true;
  if (session.role === "power_user") {
    return (campaign.audienceFilter as { type?: string } | null)?.type === "houses";
  }
  return false;
}
