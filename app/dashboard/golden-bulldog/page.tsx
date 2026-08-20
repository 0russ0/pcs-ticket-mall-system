import { auth } from "@/auth";
import { redirect } from "next/navigation";
import GoldenBulldogPageClient from "./GoldenBulldogPageClient";

export default async function GoldenBulldogPage() {
  const session = await auth();
  // Golden Bulldog is personal student recognition — outside a power user's
  // house-points-only scope.
  if (session?.user?.role === "power_user") redirect("/house-points");
  const role = session?.user?.role ?? "teacher";
  return <GoldenBulldogPageClient role={role} />;
}
