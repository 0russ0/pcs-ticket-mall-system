import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import DesktopNav, { type NavItem } from "./DesktopNav";
import MobileMenu from "./MobileMenu";

const STUDENT_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/store", label: "Shop" },
  { href: "/orders", label: "My Orders" },
];

const TEACHER_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/award-points", label: "Award Points" },
  { href: "/dashboard/campaigns", label: "Challenges" },
  { href: "/dashboard/golden-bulldog", label: "Golden Bulldog" },
  { href: "/store", label: "Store" },
  { href: "/leaderboards", label: "Leaderboards" },
];

const POWER_USER_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/award-points", label: "Award Points" },
  { href: "/dashboard/campaigns", label: "Challenges" },
  { href: "/house-points", label: "House Points" },
  { href: "/dashboard/golden-bulldog", label: "Golden Bulldog" },
  { href: "/store", label: "Store" },
  { href: "/leaderboards", label: "Leaderboards" },
];

const ADMIN_LINKS: NavItem[] = [
  { href: "/dashboard", label: "Home" },
  {
    label: "Points",
    children: [
      { href: "/dashboard/award-points", label: "Award Points" },
      { href: "/dashboard/golden-bulldog", label: "Golden Bulldog" },
      { href: "/admin/bulk-points", label: "Bulk Award" },
      { href: "/admin/campaigns", label: "Campaigns" },
      { href: "/house-points", label: "House Points" },
    ],
  },
  {
    label: "Store",
    children: [
      { href: "/admin/orders", label: "Orders & Approvals" },
      { href: "/admin/products", label: "Manage Products" },
    ],
  },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/admin/reports", label: "Reports" },
  {
    label: "Admin",
    children: [
      { href: "/admin/students", label: "Manage Students" },
      { href: "/admin/staff", label: "Manage Staff" },
      { href: "/admin/settings", label: "Settings" },
    ],
  },
];

export default async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const role = session.user.role;
  const items =
    role === "admin" ? ADMIN_LINKS
    : role === "teacher" ? TEACHER_LINKS
    : role === "power_user" ? POWER_USER_LINKS
    : STUDENT_LINKS;

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <Image src="/logo.png" alt="Provident Charter School" width={72} height={72} className="h-18 w-auto" priority />
          <span className="font-bold text-lg text-blue-600 hidden sm:inline">Bulldog Bank</span>
        </Link>

        <DesktopNav items={items} />

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-gray-600">{session.user.name}</span>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-sm font-medium text-gray-500 hover:text-red-600 hidden md:inline" type="submit">
              Sign out
            </button>
          </form>

          <MobileMenu
            items={items}
            signOutAction={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          />
        </div>
      </div>
    </header>
  );
}
