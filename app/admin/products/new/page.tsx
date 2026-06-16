import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ProductForm from "../ProductForm";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Add Product</h1>
      <ProductForm />
    </div>
  );
}
