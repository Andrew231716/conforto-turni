"use client";

import { useMemo } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { it } from "date-fns/locale";
import type { Assignment, Person, Program, WeekSlot } from "@/lib/types";
import { recipientDisplayName } from "@/lib/calendar";

export function MonthGrid({
  program,
  people,
  monthKey,
}: {
  program: Program;
  people: Person[];
  /** yyyy-MM */
  monthKey: string;
}) {
  const { days, label, eventsByDay } = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const anchor = new Date(y, m - 1, 1);
    const monthStart = startOfMonth(anchor);
    const monthEnd = endOfMonth(anchor);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

    const byId = new Map(people.map((p) => [p.id, p]));
    const weekById = new Map(program.weeks.map((w) => [w.id, w]));
    const eventsByDay = new Map<string, string[]>();

    const push = (a: Assignment) => {
      const week = weekById.get(a.weekId);
      if (!week) return;
      const names = a.assigneeIds
        .map((id) => byId.get(id)?.name?.split(" ")[0] ?? "")
        .filter(Boolean)
        .join("+");
      const dest = recipientDisplayName(byId.get(a.recipientId));
      const kind = a.kind === "visita" ? "V" : "C";
      const text = `${kind}: ${names} → ${dest}`;
      const start = parseISO(week.startDate);
      const end = parseISO(week.endDate);
      for (
        let d = start;
        d <= end;
        d = addDays(d, 1)
      ) {
        const key = format(d, "yyyy-MM-dd");
        if (!key.startsWith(monthKey)) continue;
        const arr = eventsByDay.get(key) ?? [];
        if (!arr.includes(text)) arr.push(text);
        eventsByDay.set(key, arr);
      }
    };

    program.visits.forEach(push);
    program.contacts.forEach(push);

    return {
      days,
      label: format(anchor, "MMMM yyyy", { locale: it }),
      eventsByDay,
    };
  }, [monthKey, program, people]);

  return (
    <div className="panel !p-0 overflow-hidden">
      <div className="border-b border-[var(--line)] bg-[var(--teal-soft)] px-4 py-2 font-display text-lg capitalize">
        {label}
      </div>
      <div className="grid grid-cols-7 border-b border-[var(--line)] bg-[var(--sand)] text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
          <div key={d} className="px-1 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, parseISO(`${monthKey}-01`));
          const events = eventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[5.5rem] border-b border-r border-[var(--line)] p-1.5 text-xs ${
                inMonth ? "bg-white" : "bg-[var(--sand)]/60 text-[var(--muted)]"
              }`}
            >
              <div className="mb-1 font-semibold">{format(day, "d")}</div>
              <ul className="space-y-0.5">
                {events.slice(0, 3).map((e) => (
                  <li
                    key={e}
                    className="truncate rounded bg-[var(--teal-soft)] px-1 py-0.5"
                    title={e}
                  >
                    {e}
                  </li>
                ))}
                {events.length > 3 && (
                  <li className="text-[var(--muted)]">+{events.length - 3}</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function monthKeysFromProgram(weeks: WeekSlot[]): string[] {
  const keys = new Set<string>();
  for (const w of weeks) {
    keys.add(w.startDate.slice(0, 7));
    keys.add(w.endDate.slice(0, 7));
  }
  return [...keys].sort();
}
