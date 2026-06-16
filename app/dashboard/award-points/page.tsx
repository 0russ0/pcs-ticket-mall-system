import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AwardPointsForm from "./AwardPointsForm";

export default async function AwardPointsPage() {
  const session = await auth();
  if (!session?.user || !["teacher", "admin"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Award Points</h1>
      <AwardPointsForm />
    </div>
  );
}
