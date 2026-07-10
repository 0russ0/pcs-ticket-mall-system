import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import StaffReportClient from "./StaffReportClient";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");

  const schoolId = session.user.schoolId!;
  const { period = "month" } = await searchParams;

  const now = new Date();
  let since: Date;
  if (period === "week") {
    since = new Date(now);
    since.setDate(now.getDate() - 7);
  } else if (period === "semester") {
    since = new Date(now);
    since.setMonth(now.getMonth() - 6);
  } else if (period === "year") {
    since = new Date(now.getFullYear(), 0, 1);
  } else {
    // month
    since = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const awards = await prisma.pointAward.findMany({
    where: { schoolId, createdAt: { gte: since } },
    include: {
      staff: { select: { id: true, firstName: true, lastName: true, googleEmail: true } },
      category: { select: { name: true } },
    },
  });

  // Group by staff
  const staffMap = new Map<
    number,
    {
      staffId: number;
      name: string;
      email: string;
      totalPoints: number;
      awardCount: number;
      byCategory: Record<string, number>;
    }
  >();

  for (const award of awards) {
    const key = award.staffId;
    if (!staffMap.has(key)) {
      staffMap.set(key, {
        staffId: key,
        name: `${award.staff.firstName ?? ""} ${award.staff.lastName ?? ""}`.trim() || award.staff.googleEmail,
        email: award.staff.googleEmail,
        totalPoints: 0,
        awardCount: 0,
        byCategory: {},
      });
    }
    const entry = staffMap.get(key)!;
    entry.totalPoints += award.points;
    entry.awardCount += 1;
    entry.byCategory[award.category.name] = (entry.byCategory[award.category.name] ?? 0) + award.points;
  }

  const rows = Array.from(staffMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
  const categories = [...new Set(awards.map((a) => a.category.name))].sort();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Staff Points Report</h1>
      <StaffReportClient rows={rows} categories={categories} period={period} />
    </div>
  );
}
