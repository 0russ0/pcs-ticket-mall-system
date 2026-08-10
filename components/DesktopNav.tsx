"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem =
  | { href: string; label: string; children?: never }
  | { label: string; href?: never; children: { href: string; label: string }[] };

export default function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function isActive(item: NavItem): boolean {
    if (item.href) return pathname === item.href || pathname.startsWith(item.href + "/");
    return item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/")) ?? false;
  }

  return (
    <nav ref={navRef} className="hidden md:flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(item);

        if (item.href) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          );
        }

        // Dropdown group
        const isOpen = openGroup === item.label;
        return (
          <div key={item.label} className="relative">
            <button
              onClick={() => setOpenGroup(isOpen ? null : item.label)}
              className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active ? "text-blue-600 bg-blue-50" : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
              <svg
                className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20" fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                {item.children!.map((child) => {
                  const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setOpenGroup(null)}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        childActive ? "text-blue-600 bg-blue-50 font-medium" : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                      }`}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
