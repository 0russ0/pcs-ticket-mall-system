import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import ProductRow from "./ProductRow";

export default async function AdminProductsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/dashboard");

  const products = await prisma.product.findMany({
    where: { schoolId: session.user.schoolId! },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Store Management</h1>
        <div className="flex gap-2">
          <Link href="/admin/products/upload" className="btn btn-secondary">Bulk Upload CSV</Link>
          <Link href="/admin/products/new" className="btn btn-primary">Add Product</Link>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-2">Name</th>
              <th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Points</th>
              <th className="py-2 pr-2">Inventory</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <ProductRow key={p.id} product={p} />
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="text-gray-500 py-4">No products yet.</p>}
      </div>
    </div>
  );
}
