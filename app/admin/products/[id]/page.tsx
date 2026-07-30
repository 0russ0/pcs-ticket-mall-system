import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm from "../ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const schoolId = session.user.schoolId!;

  const [product, homerooms] = await Promise.all([
    prisma.product.findFirst({ where: { id: Number(id), schoolId } }),
    prisma.student.findMany({
      where: { schoolId },
      select: { homeroom: true },
      distinct: ["homeroom"],
      orderBy: { homeroom: "asc" },
    }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Edit Product</h1>
      <ProductForm
        product={{ ...product, audienceFilter: product.audienceFilter as any }}
        homerooms={homerooms.map((h) => h.homeroom)}
      />
    </div>
  );
}
