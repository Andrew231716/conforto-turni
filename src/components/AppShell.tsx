"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Panoramica" },
  { href: "/persone", label: "Persone" },
  { href: "/programma", label: "Programma" },
  { href: "/genera", label: "Genera" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/impostazioni", label: "Impostazioni" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = pathname.startsWith("/calendario");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--surface)]/90 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="logo-mark" aria-hidden />
            <div>
              <div className="font-display text-lg leading-tight tracking-tight text-[var(--ink)]">
                Conforto Turni
              </div>
              <div className="text-xs text-[var(--muted)]">
                Visite e incoraggiamento
              </div>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-[var(--teal)] text-white"
                      : "text-[var(--ink)] hover:bg-[var(--teal-soft)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
