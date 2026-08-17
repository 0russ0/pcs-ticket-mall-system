import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import NewCampaignForm from "./NewCampaignForm";

export default async function NewCampaignPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const schoolId = session.user.schoolId!;
  const [homerooms, teams] = await Promise.all([
    prisma.student.findMany({ where: { schoolId }, select: { homeroom: true }, distinct: ["homeroom"], orderBy: { homeroom: "asc" } }),
    prisma.student.findMany({ where: { schoolId }, select: { team: true }, distinct: ["team"], orderBy: { team: "asc" } }),
  ]);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">New Campaign</h1>
      <NewCampaignForm
        homerooms={homerooms.map((r) => r.homeroom)}
        teams={teams.map((t) => t.team)}
      />
    </div>
  );
}
