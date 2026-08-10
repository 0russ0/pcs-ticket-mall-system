"use client";

import { useState } from "react";
import Link from "next/link";
import type { NavItem } from "./DesktopNav";

export default function MobileMenu({
  items,
  signOutAction,
}: {
  items: NavItem[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  function toggle(label: string) {
    setExpanded((prev) => (prev === label ? null : label));
  }

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100"
        aria-label="Toggle menu"
      >
        {open ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute top-20 left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-30">
          {items.map((item) => {
            if (item.href) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-6 py-4 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-100"
                >
                  {item.label}
                </Link>
              );
            }

            // Group with children
            const isExpanded = expanded === item.label;
            return (
              <div key={item.label} className="border-b border-gray-100">
                <button
                  onClick={() => toggle(item.label)}
                  className="flex items-center justify-between w-full px-6 py-4 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                >
                  {item.label}
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20" fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => { setOpen(false); setExpanded(null); }}
                        className="block px-10 py-3 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-100 last:border-0"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <form action={signOutAction}>
            <button
              type="submit"
              className="block w-full text-left px-6 py-4 text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
