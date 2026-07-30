import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProposeItemForm from "./ProposeItemForm";

export default async function ProposeItemPage() {
  const session = await auth();
  if (!session?.user || !["teacher", "admin"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  const schoolId = session.user.schoolId!;

  const homeroomRows = await prisma.student.findMany({
    where: { schoolId },
    select: { homeroom: true },
    distinct: ["homeroom"],
    orderBy: { homeroom: "asc" },
  });
  const homerooms = homeroomRows.map((r) => r.homeroom).filter(Boolean);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Propose a Store Item</h1>
        <p className="text-sm text-gray-500 mt-1">
          Submit an item or experience for the student mall. An admin will review and approve it before it goes live.
        </p>
      </div>
      <ProposeItemForm homerooms={homerooms} />
    </div>
  );
}
