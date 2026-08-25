import { auth } from "@/auth";
import GoldenBulldogPageClient from "./GoldenBulldogPageClient";

export default async function GoldenBulldogPage() {
  const session = await auth();
  const role = session?.user?.role ?? "teacher";
  return <GoldenBulldogPageClient role={role} />;
}
