import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const FROM = "pcsmall@providentcharterschool.org";
const LOGO_URL = "https://pcs-ticket-mall-system.vercel.app/golden-bulldog.png";

function ordinalGrade(grade: string): string {
  if (grade === "K") return "Kindergarten";
  const n = Number(grade);
  if (!Number.isFinite(n)) return grade;
  const suffix = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

export async function sendGoldenBulldogCertificate(
  schoolId: number,
  student: { firstName: string; lastName: string; grade: string },
  category: { name: string },
  description: string,
  observedDate: Date
) {
  const recipients = await prisma.digestRecipient.findMany({ where: { schoolId } });
  if (recipients.length === 0) return;
  if (!process.env.RESEND_API_KEY) return;

  const fullName = `${student.firstName} ${student.lastName}`;
  const dateStr = observedDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" });

  const subject = `${fullName} received a Golden Bulldog award - ${dateStr}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:650px;margin:0 auto;padding:24px;color:#111827;">
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
    We are proud to announce that <strong>${fullName}</strong> received a golden bulldog award on ${dateStr} for <strong>${category.name}</strong>.
  </p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 28px;">
    Keep up the good work<br>
    Provident Charter School
  </p>

  <table role="presentation" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:#3b5998;padding:20px 24px;">
        <table role="presentation" style="width:100%;">
          <tr>
            <td style="width:64px;vertical-align:middle;">
              <img src="${LOGO_URL}" alt="" width="56" height="56" style="display:block;">
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <p style="margin:0;color:#dbeafe;font-size:13px;">Provident Charter School&apos;s</p>
              <p style="margin:2px 0 0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:0.5px;line-height:1.15;">GOLDEN BULLDOG<br>AWARD</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#ffffff;padding:36px 32px;text-align:center;">
        <p style="margin:0 0 8px;font-size:16px;color:#111827;">Congratulations to ${ordinalGrade(student.grade)} grade student</p>
        <p style="margin:0 0 20px;font-size:30px;font-weight:800;color:#111827;">${fullName}</p>
        <p style="margin:0 0 4px;font-size:16px;color:#111827;">For being awarded a Golden Bulldog award for displaying</p>
        <p style="margin:0 0 20px;font-size:22px;font-weight:800;color:#111827;">${category.name}</p>
        <p style="margin:0 0 20px;font-size:15px;font-style:italic;color:#374151;">On ${dateStr}</p>
        <p style="margin:0;font-size:13px;color:#6b7280;">Description: ${description}</p>
      </td>
    </tr>
  </table>

  <p style="margin-top:24px;font-size:12px;color:#9ca3af;text-align:center;">
    PCS Bulldog Bank · Sent automatically
  </p>
</body></html>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: FROM,
    to: recipients.map((r) => r.email),
    subject,
    html,
  });
}
