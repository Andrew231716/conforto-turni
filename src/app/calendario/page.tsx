"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buildDirectCalendarTargets } from "@/lib/calendar";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

export default function CalendarioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Caricamento…</div>}>
      <CalendarioInner />
    </Suspense>
  );
}

function CalendarioInner() {
  const params = useSearchParams();
  const title = params.get("title") || "Evento";
  const start = params.get("start") || "";
  const duration = Number(params.get("duration") || "10080");
  const timezone = params.get("timezone") || "Europe/Rome";
  const description = params.get("description") || "";

  const payload = useMemo(
    () => ({ title, start, duration, timezone, description }),
    [title, start, duration, timezone, description]
  );

  const targets = useMemo(
    () => buildDirectCalendarTargets(payload),
    [payload]
  );

  const { startLabel, endLabel } = useMemo(() => {
    try {
      const [d, t = "00:00"] = start.split(" ");
      const startDate = parseISO(`${d}T${t}:00`);
      const endDate = new Date(startDate.getTime() + duration * 60_000);
      return {
        startLabel: format(startDate, "EEEE d MMMM yyyy - HH:mm", {
          locale: it,
        }),
        endLabel: format(endDate, "EEEE d MMMM yyyy - HH:mm", { locale: it }),
      };
    } catch {
      return { startLabel: start, endLabel: "" };
    }
  }, [start, duration]);

  const dayNum = start.slice(8, 10) || "—";
  const endDay = useMemo(() => {
    try {
      const [d, t = "00:00"] = start.split(" ");
      const startDate = parseISO(`${d}T${t}:00`);
      const endDate = new Date(startDate.getTime() + duration * 60_000);
      return format(endDate, "d");
    } catch {
      return "—";
    }
  }, [start, duration]);

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-2">
        <span className="logo-mark scale-125" aria-hidden />
        <span className="font-display text-lg">Conforto Turni</span>
      </div>

      <article className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h1 className="font-display text-xl leading-snug text-[var(--ink)]">
          {title}
        </h1>

        <div className="mt-5 flex gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-[#2563a8] text-sm font-semibold text-white leading-tight">
            <span>{dayNum}</span>
            <span className="h-px w-6 bg-white/50 my-0.5" />
            <span>{endDay}</span>
          </div>
          <div className="text-sm capitalize text-[var(--ink)]">
            <div>{startLabel}</div>
            <div className="text-[var(--muted)]">{endLabel}</div>
          </div>
        </div>

        {description && (
          <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
            {description}
          </p>
        )}

        <AddToCalendarButton targets={targets} />
      </article>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Organizzato con Conforto Turni
      </p>
    </div>
  );
}

function AddToCalendarButton({
  targets,
}: {
  targets: { id: string; label: string; href: string }[];
}) {
  return (
    <details className="group relative mt-6">
      <summary className="btn-calendar flex w-full cursor-pointer list-none items-center justify-center gap-2 py-3 text-base [&::-webkit-details-marker]:hidden">
        Aggiungi al calendario
        <span aria-hidden>▾</span>
      </summary>
      <div className="absolute left-0 right-0 z-10 mt-1 overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-lg">
        {targets.map((t) => (
          <a
            key={t.id}
            href={t.href}
            target="_blank"
            rel="noreferrer"
            download={
              t.id === "ical" || t.id === "apple" ? "evento.ics" : undefined
            }
            className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-sm last:border-0 hover:bg-[var(--teal-soft)]"
          >
            <CalendarIcon id={t.id} />
            {t.label}
          </a>
        ))}
      </div>
    </details>
  );
}

function CalendarIcon({ id }: { id: string }) {
  const colors: Record<string, string> = {
    google: "#4285F4",
    apple: "#111",
    office365: "#D83B01",
    outlook: "#0078D4",
    outlook_offline: "#0078D4",
    ical: "#1f6f63",
    teams: "#6264A7",
    yahoo: "#6001D2",
  };
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white"
      style={{ background: colors[id] || "#666" }}
    >
      {id.slice(0, 2).toUpperCase()}
    </span>
  );
}
