"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileMenu({
  links,
  signOutAction,
}: {
  links: { href: string; label: string }[];
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

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
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-6 py-4 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-600 border-b border-gray-100"
            >
              {l.label}
            </Link>
          ))}
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
