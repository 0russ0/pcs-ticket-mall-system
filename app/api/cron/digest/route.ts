import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "pcsmall@providentcharterschool.org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel cron protection
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schools = await prisma.school.findMany({
    include: { digestRecipients: true },
  });

  const results: { school: string; sent: number; skipped: boolean }[] = [];

  for (const school of schools) {
    if (school.digestRecipients.length === 0) {
      results.push({ school: school.name, sent: 0, skipped: true });
      continue;
    }

    // New requests since last 8 hours (covers both sends without double-counting)
    const since = new Date(Date.now() - 8 * 60 * 60 * 1000);

    const newOrders = await prisma.order.findMany({
      where: { schoolId: school.id, status: "pending", submittedAt: { gte: since } },
      include: {
        student: { select: { firstName: true, lastName: true, grade: true, homeroom: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { submittedAt: "desc" },
    });

    const outstanding = await prisma.order.findMany({
      where: {
        schoolId: school.id,
        status: { in: ["pending", "approved"] },
        submittedAt: { lt: since },
      },
      include: {
        student: { select: { firstName: true, lastName: true, grade: true, homeroom: true } },
        items: { include: { product: { select: { name: true } } } },
      },
      orderBy: { submittedAt: "asc" },
    });

    if (newOrders.length === 0 && outstanding.length === 0) {
      results.push({ school: school.name, sent: 0, skipped: true });
      continue;
    }

    const html = buildEmailHtml(school.name, newOrders, outstanding);
    const subject = newOrders.length > 0
      ? `PCS Mall Digest — ${newOrders.length} new request${newOrders.length !== 1 ? "s" : ""} (${school.name})`
      : `PCS Mall Digest — ${outstanding.length} outstanding request${outstanding.length !== 1 ? "s" : ""} (${school.name})`;

    const to = school.digestRecipients.map((r) => r.email);

    await resend.emails.send({ from: FROM, to, subject, html });
    results.push({ school: school.name, sent: to.length, skipped: false });
  }

  return NextResponse.json({ ok: true, results });
}

type OrderWithDetails = {
  id: number;
  submittedAt: Date;
  totalPoints: number;
  status: string;
  student: { firstName: string; lastName: string; grade: string; homeroom: string };
  items: { quantity: number; pointsPerItem: number; product: { name: string } }[];
};

function orderRow(o: OrderWithDetails) {
  const items = o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ");
  const submitted = o.submittedAt.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${o.student.firstName} ${o.student.lastName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${o.student.grade} · ${o.student.homeroom}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${items}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${o.totalPoints} pts</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${submitted}</td>
    </tr>`;
}

function buildEmailHtml(schoolName: string, newOrders: OrderWithDetails[], outstanding: OrderWithDetails[]) {
  const now = new Date().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });

  const tableStyle = `width:100%;border-collapse:collapse;margin-top:8px;font-size:14px;`;
  const thStyle = `background:#f3f4f6;padding:8px 12px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;`;

  const newSection = newOrders.length > 0 ? `
    <h2 style="color:#1d4ed8;font-size:18px;margin:24px 0 4px;">New Requests (${newOrders.length})</h2>
    <table style="${tableStyle}">
      <thead><tr>
        <th style="${thStyle}">Student</th>
        <th style="${thStyle}">Grade / Homeroom</th>
        <th style="${thStyle}">Items</th>
        <th style="${thStyle};text-align:right;">Points</th>
        <th style="${thStyle}">Submitted</th>
      </tr></thead>
      <tbody>${newOrders.map(orderRow).join("")}</tbody>
    </table>` : `<p style="color:#6b7280;margin-top:16px;">No new requests in this period.</p>`;

  const outstandingSection = outstanding.length > 0 ? `
    <h2 style="color:#b45309;font-size:18px;margin:32px 0 4px;">Need Completing (${outstanding.length})</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">These requests are still pending or approved but not yet completed.</p>
    <table style="${tableStyle}">
      <thead><tr>
        <th style="${thStyle}">Student</th>
        <th style="${thStyle}">Grade / Homeroom</th>
        <th style="${thStyle}">Items</th>
        <th style="${thStyle};text-align:right;">Points</th>
        <th style="${thStyle}">Submitted</th>
      </tr></thead>
      <tbody>${outstanding.map(orderRow).join("")}</tbody>
    </table>` : ``;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;padding:24px;color:#111827;">
  <div style="background:#1d4ed8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <img src="https://pcs-ticket-mall-system.vercel.app/logo.png" alt="PCS" style="height:48px;vertical-align:middle;margin-right:12px;">
    <span style="color:white;font-size:20px;font-weight:700;vertical-align:middle;">PCS Mall Digest</span>
  </div>
  <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#6b7280;margin:0;font-size:13px;">${schoolName} · ${now} ET</p>
  </div>

  <div style="margin-top:24px;">
    ${newSection}
    ${outstandingSection}
  </div>

  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
  <p style="font-size:12px;color:#9ca3af;text-align:center;">
    PCS Student Rewards · Sent automatically ·
    <a href="https://pcs-ticket-mall-system.vercel.app/admin/orders" style="color:#6b7280;">View all orders</a>
  </p>
</body>
</html>`;
}
