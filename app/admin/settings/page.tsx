import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SettingsForm from "./SettingsForm";
import DigestRecipientsForm from "./DigestRecipientsForm";
import { getSettings } from "@/lib/settings";

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const schoolId = session.user.schoolId!;
  const [school, settings, categories, recipients] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    getSettings(schoolId),
    prisma.pointCategory.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.digestRecipient.findMany({ where: { schoolId }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-sm text-gray-500">School: {school?.name}</p>
      <SettingsForm initialSettings={settings} initialCategories={categories} />
      <DigestRecipientsForm initialRecipients={recipients.map((r) => ({ id: r.id, email: r.email }))} />
    </div>
  );
}
