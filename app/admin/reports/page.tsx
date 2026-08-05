import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <ReportsClient />
    </div>
  );
}
