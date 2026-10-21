"use client";

import { useMemo, useState } from "react";
import type { Assignment, Person, WeekSlot, AppSettings } from "@/lib/types";
import {
  buildCalendarLinkUrl,
  buildDirectCalendarTargets,
  buildEventPayload,
} from "@/lib/calendar";

export function CalendarMenu({
  assignment,
  week,
  people,
  settings,
}: {
  assignment: Assignment;
  week: WeekSlot;
  people: Person[];
  settings: AppSettings;
}) {
  const [open, setOpen] = useState(false);
  const payload = useMemo(
    () => buildEventPayload(assignment, week, people),
    [assignment, week, people]
  );

  const ownHref = useMemo(() => {
    if (typeof window === "undefined") return "#";
    return buildCalendarLinkUrl(payload, settings, window.location.origin);
  }, [payload, settings]);

  const targets = useMemo(() => buildDirectCalendarTargets(payload), [payload]);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="btn-calendar"
        onClick={() => setOpen((v) => !v)}
      >
        Aggiungi al calendario ▾
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Chiudi"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 min-w-[220px] rounded-lg border border-[var(--line)] bg-white py-1 shadow-lg">
            <a
              className="block px-3 py-2 text-sm hover:bg-[var(--teal-soft)]"
              href={ownHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              Pagina universale
            </a>
            <div className="my-1 border-t border-[var(--line)]" />
            {targets.map((t) => (
              <a
                key={t.id}
                className="block px-3 py-2 text-sm hover:bg-[var(--teal-soft)]"
                href={t.href}
                target="_blank"
                rel="noreferrer"
                download={t.id === "ical" || t.id === "apple" ? "evento.ics" : undefined}
                onClick={() => setOpen(false)}
              >
                {t.label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
