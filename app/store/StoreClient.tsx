"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartContext";
import { proxiedImageUrl } from "@/lib/image";

type AudienceFilter =
  | { type: "grade_band"; value: "2-5" | "6-8" }
  | { type: "grades"; values: string[] }
  | { type: "homerooms"; values: string[] }
  | { type: "houses"; values: string[] };

type Product = {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  category: "physical_item" | "experience" | "privilege";
  inventoryLimit: number | null;
  inventoryAvailable: number | null;
  imageUrl: string | null;
  isActive: boolean;
  featured: boolean;
  audienceFilter: AudienceFilter | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  physical_item: "Physical Item",
  experience: "Experience",
  privilege: "Privilege",
};

const CATEGORY_COLORS: Record<string, string> = {
  physical_item: "bg-blue-100 text-blue-800",
  experience: "bg-purple-100 text-purple-800",
  privilege: "bg-green-100 text-green-800",
};

type SortKey = "name_asc" | "name_desc" | "price_asc" | "price_desc" | "newest";
type Tab = "all" | "for_you" | "physical_item" | "experience" | "privilege";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name_asc", label: "A → Z" },
  { value: "name_desc", label: "Z → A" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "newest", label: "Newest" },
];

function isTargeted(
  filter: AudienceFilter | null,
  grade: string | null,
  homeroom: string | null,
  team: string | null
): boolean {
  if (!filter) return false; // "all students" items don't go in For You
  if (filter.type === "grades") return !!grade && filter.values.includes(grade);
  if (filter.type === "homerooms") return !!homeroom && filter.values.includes(homeroom);
  if (filter.type === "houses") return !!team && filter.values.includes(team);
  if (filter.type === "grade_band") {
    const bands: Record<string, string[]> = { "2-5": ["2","3","4","5"], "6-8": ["6","7","8"] };
    return !!grade && (bands[filter.value]?.includes(grade) ?? false);
  }
  return false;
}

function isEligibleForStudent(
  filter: AudienceFilter | null,
  grade: string | null,
  homeroom: string | null,
  team: string | null
): boolean {
  if (!filter) return true;
  if (filter.type === "grades") return !!grade && filter.values.includes(grade);
  if (filter.type === "homerooms") return !!homeroom && filter.values.includes(homeroom);
  if (filter.type === "houses") return !!team && filter.values.includes(team);
  if (filter.type === "grade_band") {
    const bands: Record<string, string[]> = { "2-5": ["2","3","4","5"], "6-8": ["6","7","8"] };
    return !!grade && (bands[filter.value]?.includes(grade) ?? false);
  }
  return true;
}

function audienceSummary(filter: AudienceFilter | null): string | null {
  if (!filter) return null;
  if (filter.type === "grade_band") return `Grades ${filter.value} only`;
  if (filter.type === "grades") return `Grade ${filter.values.join(", ")} only`;
  if (filter.type === "homerooms") return `${filter.values.join(", ")} only`;
  if (filter.type === "houses") return `${filter.values.join(", ")} only`;
  return null;
}

type Props = {
  role: string;
  studentPoints: number | null;
  userGrade: string | null;
  userHomeroom: string | null;
  userTeam: string | null;
};

export default function StoreClient({ role, studentPoints, userGrade, userHomeroom, userTeam }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<SortKey>("name_asc");
  const [search, setSearch] = useState("");
  const { addItem, count, total } = useCart();
  const [added, setAdded] = useState<number | null>(null);

  const isTeacher = role === "teacher";
  const isAdmin = role === "admin";
  const canBuy = role === "student";

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then(setProducts);
  }, []);

  const forYouCount = useMemo(
    () => products.filter((p) => isTargeted(p.audienceFilter, userGrade, userHomeroom, userTeam)).length,
    [products, userGrade, userHomeroom, userTeam]
  );

  const featuredProducts = useMemo(() => {
    return products
      .filter((p) => p.featured)
      .filter((p) => !canBuy || isEligibleForStudent(p.audienceFilter, userGrade, userHomeroom, userTeam))
      .slice(0, 4);
  }, [products, canBuy, userGrade, userHomeroom, userTeam]);

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: "all", label: "All Items" },
    ...(forYouCount > 0 || isTeacher || isAdmin
      ? [{ value: "for_you" as Tab, label: isTeacher || isAdmin ? "Targeted" : "For You", count: forYouCount }]
      : []),
    { value: "physical_item", label: "Physical" },
    { value: "experience", label: "Experience" },
    { value: "privilege", label: "Privilege" },
  ];

  const displayed = useMemo(() => {
    let list = [...products];

    // Students: enforce audience eligibility client-side as a safety net
    if (canBuy) {
      list = list.filter((p) => isEligibleForStudent(p.audienceFilter, userGrade, userHomeroom, userTeam));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)
      );
    }

    if (tab === "for_you") {
      list = list.filter((p) =>
        isTeacher || isAdmin
          ? p.audienceFilter !== null
          : isTargeted(p.audienceFilter, userGrade, userHomeroom, userTeam)
      );
    } else if (tab !== "all") {
      list = list.filter((p) => p.category === tab);
    }

    list.sort((a, b) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      if (sort === "price_asc") return a.pointsCost - b.pointsCost;
      if (sort === "price_desc") return b.pointsCost - a.pointsCost;
      if (sort === "newest") return b.id - a.id;
      return 0;
    });

    return list;
  }, [products, tab, sort, search, isTeacher, isAdmin, userGrade, userHomeroom, userTeam]);

  function handleAdd(p: Product) {
    addItem({
      productId: p.id,
      name: p.name,
      pointsCost: p.pointsCost,
      imageUrl: p.imageUrl,
      quantity: 1,
      inventoryLimit: p.inventoryLimit,
      inventoryAvailable: p.inventoryAvailable,
    });
    setAdded(p.id);
    setTimeout(() => setAdded(null), 1200);
  }

  return (
    <div className={`space-y-4 ${count > 0 ? "pb-20" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">School Store</h1>
        <div className="flex gap-2 items-center">
          {isTeacher && (
            <Link href="/dashboard/propose-item" className="btn btn-secondary text-sm">
              + Propose Store Item
            </Link>
          )}
          {canBuy && (
            <Link href="/store/cart" className="btn btn-primary">
              🛒 Cart {count > 0 && `(${count})`}
            </Link>
          )}
        </div>
      </div>

      {studentPoints !== null && (
        <p className="text-sm text-gray-600">
          You have <span className="font-bold text-blue-600">{studentPoints}</span> points to spend.
        </p>
      )}

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className="input pl-9 w-full"
        />
      </div>

      {/* Tabs + Sort row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
                tab === t.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${tab === t.value ? "bg-white/20" : "bg-blue-100 text-blue-700"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-sm border rounded-lg px-2.5 py-1.5 bg-white shrink-0"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Featured */}
      {featuredProducts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            ⭐ Featured
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {featuredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                canBuy={canBuy}
                isStaffView={isTeacher || isAdmin}
                added={added === p.id}
                onAdd={() => handleAdd(p)}
                highlight
              />
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {displayed.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            canBuy={canBuy}
            isStaffView={isTeacher || isAdmin}
            added={added === p.id}
            onAdd={() => handleAdd(p)}
          />
        ))}
      </div>

      {displayed.length === 0 && products.length > 0 && (
        <p className="text-gray-500 text-sm">
          {search.trim() ? `No items match "${search}".` : "No items in this category."}
        </p>
      )}
      {products.length === 0 && (
        <p className="text-gray-500">No items available yet.</p>
      )}

      {/* Sticky cart bar */}
      {count > 0 && canBuy && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-200 shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">{count} item{count > 1 ? "s" : ""} in cart</p>
              <p className="font-bold text-lg text-blue-600">{total} pts</p>
            </div>
            <Link href="/store/cart" className="btn btn-primary">View Cart</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product: p,
  canBuy,
  isStaffView,
  added,
  onAdd,
  highlight,
}: {
  product: Product;
  canBuy: boolean;
  isStaffView: boolean;
  added: boolean;
  onAdd: () => void;
  highlight?: boolean;
}) {
  const outOfStock = p.inventoryLimit !== null && (p.inventoryAvailable ?? 0) <= 0;
  const exclusive = audienceSummary(p.audienceFilter);
  return (
    <div className={`card flex flex-col p-3 ${highlight ? "ring-2 ring-amber-400" : ""}`}>
      <div className="w-full aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proxiedImageUrl(p.imageUrl)!} alt={p.name} className="object-cover w-full h-full" />
        ) : (
          <span className="text-3xl">🎁</span>
        )}
      </div>
      <span className={`badge ${CATEGORY_COLORS[p.category]} self-start mb-1 text-xs`}>
        {CATEGORY_LABELS[p.category]}
      </span>
      {exclusive && (
        <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mb-1 self-start">
          ★ {exclusive}
        </span>
      )}
      <p className="font-semibold text-sm flex-1">{p.name}</p>
      {p.description && (
        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{p.description}</p>
      )}
      <p className="font-bold text-blue-600 mt-1">{p.pointsCost} pts</p>
      {p.inventoryAvailable !== null && (
        <p className="text-xs text-gray-400">{p.inventoryAvailable} left</p>
      )}
      {canBuy && (
        outOfStock ? (
          <span className="text-xs text-red-600 mt-2">Out of stock</span>
        ) : (
          <button onClick={onAdd} className="btn btn-secondary mt-2 text-sm">
            {added ? "Added ✓" : "Add to Cart"}
          </button>
        )
      )}
      {isStaffView && (
        <span className={`mt-2 text-xs px-2 py-0.5 rounded self-start ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {p.isActive ? "Active" : "Inactive"}
        </span>
      )}
    </div>
  );
}
