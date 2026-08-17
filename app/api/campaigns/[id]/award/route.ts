import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin", "teacher"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const campaignId = Number(id);
  const schoolId = session.user.schoolId!;
  const staffId = session.user.staffId;

  if (!staffId) return NextResponse.json({ error: "Staff ID missing from session" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, schoolId, isActive: true } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found or inactive" }, { status: 404 });

  const body = await req.json();
  const { studentIds, points, reason, categoryId } = body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return NextResponse.json({ error: "Select at least one student" }, { status: 400 });
  }
  if (!points || points <= 0) {
    return NextResponse.json({ error: "Points must be greater than 0" }, { status: 400 });
  }

  // Validate students belong to this school
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId },
    select: { id: true },
  });
  if (validStudents.length === 0) return NextResponse.json({ error: "No valid students found" }, { status: 400 });

  const validIds = validStudents.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    // Always create CampaignAward rows
    await tx.campaignAward.createMany({
      data: validIds.map((studentId) => ({
        campaignId,
        schoolId,
        studentId,
        staffId,
        points,
        reason: reason?.trim() || null,
      })),
    });

    if (campaign.addToTotal) {
      // Also create PointAward rows and increment student totals
      const catId = categoryId ?? await tx.pointCategory
        .findFirst({ where: { schoolId }, orderBy: { isActive: "desc" }, select: { id: true } })
        .then((c) => c?.id);

      if (catId) {
        await tx.pointAward.createMany({
          data: validIds.map((studentId) => ({
            schoolId,
            studentId,
            staffId,
            categoryId: catId,
            points,
            reason: reason?.trim() || null,
          })),
        });
      }

      await tx.student.updateMany({
        where: { id: { in: validIds } },
        data: { totalPoints: { increment: points }, lifetimePoints: { increment: points } },
      });
    }
  });

  return NextResponse.json({ awarded: validIds.length });
}
