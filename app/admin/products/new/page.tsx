import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm from "../ProductForm";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const schoolId = session.user.schoolId!;
  const homerooms = await prisma.student.findMany({
    where: { schoolId },
    select: { homeroom: true },
    distinct: ["homeroom"],
    orderBy: { homeroom: "asc" },
  });

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Add Product</h1>
      <ProductForm homerooms={homerooms.map((h) => h.homeroom)} />
    </div>
  );
}
