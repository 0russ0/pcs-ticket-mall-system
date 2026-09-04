// A staff member can manage a ClassGroup if they're an admin or if they're one
// of its co-teachers (have a Class row in the group). Mirrors the campaign
// permission pattern in lib/campaignPermissions.ts.
export function canManageClassGroup(
  session: { role: string; staffId: number | null },
  group: { classes: { teacherId: number }[] }
): boolean {
  if (session.role === "admin") return true;
  if (session.staffId == null) return false;
  return group.classes.some((c) => c.teacherId === session.staffId);
}
