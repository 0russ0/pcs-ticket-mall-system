import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { Resend } from "resend";

const FROM = "PCS Bulldog Bank <pcsmall@providentcharterschool.org>";

const LOWER_GRADES = ["2", "3", "4", "5"];
const UPPER_GRADES = ["6", "7", "8"];

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
  const schools = await prisma.school.findMany({ include: { digestRecipients: true } });
  const results: { school: string; sent: number; skipped: boolean }[] = [];

  for (const school of schools) {
    if (school.digestRecipients.length === 0) {
      results.push({ school: school.name, sent: 0, skipped: true });
      continue;
    }

    const since = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const familyEmailsEnabled = (await getSetting(school.id, "family_golden_bulldog_emails_enabled")) === "true";

    const [newOrders, outstanding, pendingProposals, cancellations, goldenBulldogs] = await Promise.all([
      prisma.order.findMany({
        where: { schoolId: school.id, status: "pending", submittedAt: { gte: since } },
        include: {
          student: { select: { firstName: true, lastName: true, grade: true, homeroom: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { submittedAt: "desc" },
      }),
      prisma.order.findMany({
        where: { schoolId: school.id, status: { in: ["pending", "approved"] }, submittedAt: { lt: since } },
        include: {
          student: { select: { firstName: true, lastName: true, grade: true, homeroom: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { submittedAt: "asc" },
      }),
      prisma.product.findMany({
        where: { schoolId: school.id, proposalStatus: "pending" },
        include: { proposedBy: { select: { firstName: true, lastName: true, googleEmail: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.order.findMany({
        where: { schoolId: school.id, cancelledBySelf: true, cancelledAt: { gte: since } },
        include: {
          student: { select: { firstName: true, lastName: true, grade: true, homeroom: true } },
          items: { include: { product: { select: { name: true } } } },
        },
        orderBy: { cancelledAt: "desc" },
      }),
      prisma.goldenBulldog.findMany({
        where: { schoolId: school.id, createdAt: { gte: since } },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, grade: true, homeroom: true } },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    if (newOrders.length === 0 && outstanding.length === 0 && pendingProposals.length === 0 && cancellations.length === 0 && goldenBulldogs.length === 0) {
      results.push({ school: school.name, sent: 0, skipped: true });
      continue;
    }

    const guardianCounts = goldenBulldogs.length > 0
      ? await prisma.studentGuardian.groupBy({
          by: ["studentId"],
          where: { studentId: { in: goldenBulldogs.map((g) => g.student.id) } },
          _count: { _all: true },
        })
      : [];
    const guardianCountByStudent = new Map(guardianCounts.map((g) => [g.studentId, g._count._all]));

    const html = buildEmailHtml(school.name, newOrders, outstanding, pendingProposals, cancellations, goldenBulldogs, familyEmailsEnabled, guardianCountByStudent);
    const newCount = newOrders.length;
    const propCount = pendingProposals.length;
    const cancelCount = cancellations.length;
    const gbCount = goldenBulldogs.length;
    const parts = [
      newCount > 0 ? `${newCount} new order${newCount !== 1 ? "s" : ""}` : null,
      propCount > 0 ? `${propCount} store proposal${propCount !== 1 ? "s" : ""}` : null,
      gbCount > 0 ? `${gbCount} golden bulldog${gbCount !== 1 ? "s" : ""}` : null,
      cancelCount > 0 ? `${cancelCount} cancellation${cancelCount !== 1 ? "s" : ""}` : null,
    ].filter(Boolean);
    const subject = parts.length > 0
      ? `PCS Bulldog Bank Digest — ${parts.join(", ")} (${school.name})`
      : `PCS Bulldog Bank Digest — ${outstanding.length} outstanding (${school.name})`;

    const to = school.digestRecipients.map((r) => r.email);
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: FROM, to, subject, html });
    results.push({ school: school.name, sent: to.length, skipped: false });
  }

  return NextResponse.json({ ok: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Handler error", detail: message }, { status: 500 });
  }
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
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Gr ${o.student.grade} · ${o.student.homeroom}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${items}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${o.totalPoints} pts</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${submitted}</td>
    </tr>`;
}

function gradeBandTable(
  heading: string,
  headingColor: string,
  orders: OrderWithDetails[],
  emptyMsg: string
) {
  if (orders.length === 0) return `<p style="color:#6b7280;font-size:13px;margin:4px 0 0 0;">${emptyMsg}</p>`;
  const thStyle = `background:#f3f4f6;padding:8px 12px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;`;
  return `
    <h3 style="color:${headingColor};font-size:15px;margin:16px 0 4px;font-weight:700;">${heading} (${orders.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr>
        <th style="${thStyle}">Student</th>
        <th style="${thStyle}">Grade / Homeroom</th>
        <th style="${thStyle}">Items</th>
        <th style="${thStyle};text-align:right;">Points</th>
        <th style="${thStyle}">Submitted</th>
      </tr></thead>
      <tbody>${orders.map(orderRow).join("")}</tbody>
    </table>`;
}

type CancelledOrder = {
  id: number;
  cancelledAt: Date | null;
  totalPoints: number;
  notes: string | null;
  student: { firstName: string; lastName: string; grade: string; homeroom: string };
  items: { quantity: number; pointsPerItem: number; product: { name: string } }[];
};

function cancellationRow(o: CancelledOrder) {
  const items = o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ");
  const cancelled = o.cancelledAt?.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  }) ?? "";
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${o.student.firstName} ${o.student.lastName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Gr ${o.student.grade} · ${o.student.homeroom}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${items}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${o.totalPoints} pts refunded</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${cancelled}</td>
    </tr>`;
}

type ProposalWithProposer = {
  id: number;
  name: string;
  pointsCost: number;
  category: string;
  description: string | null;
  inventoryLimit: number | null;
  createdAt: Date;
  proposedBy: { firstName: string | null; lastName: string | null; googleEmail: string } | null;
};

function proposalRow(p: ProposalWithProposer) {
  const by = p.proposedBy
    ? (`${p.proposedBy.firstName ?? ""} ${p.proposedBy.lastName ?? ""}`.trim() || p.proposedBy.googleEmail)
    : "Unknown";
  const submitted = p.createdAt.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  const cat = p.category.replace("_", " ");
  const inv = p.inventoryLimit !== null ? `${p.inventoryLimit} spots` : "Unlimited";
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${p.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${cat}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${p.pointsCost} pts</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${inv}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${by}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${submitted}</td>
    </tr>`;
}

type GoldenBulldogWithDetails = {
  id: number;
  createdAt: Date;
  description: string;
  student: { id: number; firstName: string; lastName: string; grade: string; homeroom: string };
  category: { name: string };
};

function goldenBulldogRow(g: GoldenBulldogWithDetails, familyEmailsEnabled: boolean, guardianCount: number) {
  const awarded = g.createdAt.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  const status = !familyEmailsEnabled
    ? `<span style="color:#9ca3af;">Family emails not yet enabled</span>`
    : guardianCount > 0
      ? `<span style="color:#059669;">Sent to ${guardianCount} guardian${guardianCount !== 1 ? "s" : ""}</span>`
      : `<span style="color:#dc2626;">⚠ No guardian email on file</span>`;
  return `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${g.student.firstName} ${g.student.lastName}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">Gr ${g.student.grade} · ${g.student.homeroom}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${g.category.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;">${status}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;">${awarded}</td>
    </tr>`;
}

function buildEmailHtml(
  schoolName: string,
  newOrders: OrderWithDetails[],
  outstanding: OrderWithDetails[],
  proposals: ProposalWithProposer[],
  cancellations: CancelledOrder[],
  goldenBulldogs: GoldenBulldogWithDetails[],
  familyEmailsEnabled: boolean,
  guardianCountByStudent: Map<number, number>
) {
  const now = new Date().toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });

  // Split new orders by grade band
  const newLower = newOrders.filter((o) => LOWER_GRADES.includes(o.student.grade));
  const newUpper = newOrders.filter((o) => UPPER_GRADES.includes(o.student.grade));
  const newOther = newOrders.filter((o) => !LOWER_GRADES.includes(o.student.grade) && !UPPER_GRADES.includes(o.student.grade));

  // Split outstanding by grade band
  const outLower = outstanding.filter((o) => LOWER_GRADES.includes(o.student.grade));
  const outUpper = outstanding.filter((o) => UPPER_GRADES.includes(o.student.grade));
  const outOther = outstanding.filter((o) => !LOWER_GRADES.includes(o.student.grade) && !UPPER_GRADES.includes(o.student.grade));

  const newSection = newOrders.length > 0 ? `
    <h2 style="color:#1d4ed8;font-size:18px;margin:24px 0 8px;">New Requests (${newOrders.length})</h2>
    ${gradeBandTable("Grades 2–5", "#1d4ed8", newLower, "No new requests from grades 2–5.")}
    ${gradeBandTable("Grades 6–8", "#7c3aed", newUpper, "No new requests from grades 6–8.")}
    ${newOther.length > 0 ? gradeBandTable("Other Grades (K–1)", "#6b7280", newOther, "") : ""}
  ` : `<p style="color:#6b7280;margin-top:16px;">No new requests in this period.</p>`;

  const outstandingSection = outstanding.length > 0 ? `
    <h2 style="color:#b45309;font-size:18px;margin:32px 0 8px;">Need Completing (${outstanding.length})</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Pending or approved but not yet fulfilled.</p>
    ${gradeBandTable("Grades 2–5", "#b45309", outLower, "None outstanding for grades 2–5.")}
    ${gradeBandTable("Grades 6–8", "#7c3aed", outUpper, "None outstanding for grades 6–8.")}
    ${outOther.length > 0 ? gradeBandTable("Other Grades (K–1)", "#6b7280", outOther, "") : ""}
  ` : "";

  const thStyle = `background:#f3f4f6;padding:8px 12px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;`;
  const proposalsSection = proposals.length > 0 ? `
    <h2 style="color:#d97706;font-size:18px;margin:32px 0 8px;">🛍️ Pending Store Item Proposals (${proposals.length})</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Submitted by teachers — waiting for your approval.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr>
        <th style="${thStyle}">Item</th>
        <th style="${thStyle}">Category</th>
        <th style="${thStyle};text-align:right;">Cost</th>
        <th style="${thStyle}">Quantity</th>
        <th style="${thStyle}">Proposed By</th>
        <th style="${thStyle}">Submitted</th>
      </tr></thead>
      <tbody>${proposals.map(proposalRow).join("")}</tbody>
    </table>
    <p style="margin:12px 0 0;font-size:13px;">
      <a href="https://pcs-ticket-mall-system.vercel.app/admin/orders" style="color:#d97706;font-weight:600;">Review proposals →</a>
    </p>
  ` : "";

  const goldenBulldogSection = goldenBulldogs.length > 0 ? `
    <h2 style="color:#b45309;font-size:18px;margin:32px 0 8px;">🐾 Golden Bulldog Certificates (${goldenBulldogs.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr>
        <th style="${thStyle}">Student</th>
        <th style="${thStyle}">Grade / Homeroom</th>
        <th style="${thStyle}">Category</th>
        <th style="${thStyle}">Certificate</th>
        <th style="${thStyle}">Awarded</th>
      </tr></thead>
      <tbody>${goldenBulldogs.map((g) => goldenBulldogRow(g, familyEmailsEnabled, guardianCountByStudent.get(g.student.id) ?? 0)).join("")}</tbody>
    </table>
  ` : "";

  const cancellationsSection = cancellations.length > 0 ? `
    <h2 style="color:#dc2626;font-size:18px;margin:32px 0 8px;">🔔 Cancelled by Students (${cancellations.length})</h2>
    <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Points were refunded and inventory restocked automatically.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr>
        <th style="${thStyle}">Student</th>
        <th style="${thStyle}">Grade / Homeroom</th>
        <th style="${thStyle}">Items</th>
        <th style="${thStyle};text-align:right;">Refund</th>
        <th style="${thStyle}">Cancelled</th>
      </tr></thead>
      <tbody>${cancellations.map(cancellationRow).join("")}</tbody>
    </table>
  ` : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:750px;margin:0 auto;padding:24px;color:#111827;">
  <div style="background:#1d4ed8;padding:20px 24px;border-radius:8px 8px 0 0;">
    <img src="https://pcs-ticket-mall-system.vercel.app/logo.png" alt="PCS" style="height:48px;vertical-align:middle;margin-right:12px;">
    <span style="color:white;font-size:20px;font-weight:700;vertical-align:middle;">PCS Bulldog Bank Digest</span>
  </div>
  <div style="background:#f9fafb;padding:16px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#6b7280;margin:0;font-size:13px;">${schoolName} · ${now} ET</p>
  </div>
  <div style="margin-top:24px;">
    ${proposalsSection}
    ${newSection}
    ${outstandingSection}
    ${goldenBulldogSection}
    ${cancellationsSection}
  </div>
  <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
  <p style="font-size:12px;color:#9ca3af;text-align:center;">
    PCS Bulldog Bank · Sent automatically ·
    <a href="https://pcs-ticket-mall-system.vercel.app/admin/orders" style="color:#6b7280;">View approvals</a>
  </p>
</body></html>`;
}
