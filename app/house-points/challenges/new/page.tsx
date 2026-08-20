import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NewHouseChallengeForm from "./NewHouseChallengeForm";

export default async function NewHouseChallengePage() {
  const session = await auth();
  if (!session?.user || !["admin", "power_user"].includes(session.user.role ?? "")) {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">New House Challenge</h1>
      <NewHouseChallengeForm />
    </div>
  );
}
