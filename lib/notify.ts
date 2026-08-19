import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const FROM = "pcsmall@providentcharterschool.org";

export async function notifyStudentCancelledOrder(
  schoolId: number,
  order: { id: number; totalPoints: number },
  student: { firstName: string; lastName: string; grade: string; homeroom: string },
  items: { quantity: number; product: { name: string } }[]
) {
  const recipients = await prisma.digestRecipient.findMany({ where: { schoolId } });
  if (recipients.length === 0) return;
  if (!process.env.RESEND_API_KEY) return;

  const itemList = items.map((i) => `${i.quantity}× ${i.product.name}`).join(", ");
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827;">
  <div style="background:#dc2626;padding:16px 24px;border-radius:8px 8px 0 0;">
    <span style="color:white;font-size:18px;font-weight:700;">Order Cancelled by Student</span>
  </div>
  <div style="background:#f9fafb;padding:20px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 8px;"><strong>${student.firstName} ${student.lastName}</strong> (Gr ${student.grade} · ${student.homeroom}) cancelled Order #${order.id}.</p>
    <p style="margin:0 0 8px;color:#374151;">${itemList}</p>
    <p style="margin:0;font-weight:700;color:#dc2626;">${order.totalPoints} pts refunded, inventory restocked.</p>
  </div>
  <p style="margin-top:16px;font-size:13px;">
    <a href="https://pcs-ticket-mall-system.vercel.app/admin/orders" style="color:#6b7280;">View approvals →</a>
  </p>
</body></html>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: recipients.map((r) => r.email),
    subject: `Order #${order.id} cancelled by ${student.firstName} ${student.lastName}`,
    html,
  });
}
