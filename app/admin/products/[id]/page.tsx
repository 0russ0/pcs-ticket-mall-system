import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ProductForm from "../ProductForm";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id: Number(id), schoolId: session.user.schoolId! },
  });
  if (!product) notFound();

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Edit Product</h1>
      <ProductForm product={product} />
    </div>
  );
}
