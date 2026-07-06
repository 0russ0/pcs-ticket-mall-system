import Link from "next/link";
import Image from "next/image";
import { auth, signOut } from "@/auth";

const STUDENT_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/store", label: "Shop" },
  { href: "/orders", label: "My Orders" },
];

const TEACHER_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/award-points", label: "Award Points" },
  { href: "/leaderboards", label: "Leaderboards" },
];

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/award-points", label: "Award Points" },
  { href: "/admin/orders", label: "Approvals" },
  { href: "/admin/products", label: "Store" },
  { href: "/leaderboards", label: "Leaderboards" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function NavBar() {
  const session = await auth();
  if (!session?.user) return null;

  const role = session.user.role;
  const links =
    role === "admin" ? ADMIN_LINKS : role === "teacher" ? TEACHER_LINKS : STUDENT_LINKS;

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Provident Charter School" width={72} height={72} className="h-18 w-auto" priority />
            <span className="font-bold text-lg text-blue-600 hidden sm:inline">Student Rewards</span>
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm font-medium text-gray-700 hover:text-blue-600">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-gray-600">{session.user.name}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button className="text-sm font-medium text-gray-500 hover:text-red-600" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Bottom mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 flex justify-around pb-[env(safe-area-inset-bottom)]">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex-1 flex flex-col items-center justify-center py-2 text-xs font-medium text-gray-600 hover:text-blue-600 min-h-[48px]"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
