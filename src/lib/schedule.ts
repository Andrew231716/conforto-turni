import { nanoid } from "nanoid";
import { addDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type {
  Assignment,
  Person,
  ScheduleRules,
  WeekSlot,
} from "./types";

export function generateWeeks(
  startDate: string,
  weekCount: number
): WeekSlot[] {
  const weeks: WeekSlot[] = [];
  let cursor = parseISO(startDate);
  for (let i = 0; i < weekCount; i++) {
    const start = cursor;
    const end = addDays(start, 6);
    weeks.push({
      id: nanoid(8),
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      label: formatWeekLabel(start, end),
    });
    cursor = addDays(end, 1);
  }
  return weeks;
}

function formatWeekLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${format(start, "d", { locale: it })}-${format(end, "d MMMM", { locale: it })}`;
  }
  return `${format(start, "d MMMM", { locale: it })} - ${format(end, "d MMMM", { locale: it })}`;
}

interface GenerateOptions {
  weeks: WeekSlot[];
  people: Person[];
  rules: ScheduleRules;
  /** Destinatari da ruotare nelle visite (ordine preferito) */
  visitRecipientIds?: string[];
  /** Destinatari per contatti alternativi */
  contactRecipientIds?: string[];
}

export function generateProgramAssignments(
  options: GenerateOptions
): { visits: Assignment[]; contacts: Assignment[]; warnings: string[] } {
  const warnings: string[] = [];
  const giovani = options.people.filter(
    (p) => p.role === "giovane" && p.active
  );
  const destinatari = options.people.filter(
    (p) => p.role === "destinatario" && p.active
  );

  if (giovani.length < 2) {
    warnings.push("Servono almeno 2 giovani attivi per generare le visite.");
  }

  const visitRecipients = resolveList(
    options.visitRecipientIds,
    destinatari
  );
  const contactRecipients = resolveList(
    options.contactRecipientIds,
    destinatari
  );

  const load = new Map<string, number>();
  for (const g of giovani) load.set(g.id, 0);

  const visits: Assignment[] = [];
  const contacts: Assignment[] = [];

  options.weeks.forEach((week, wi) => {
    const recipient =
      visitRecipients[wi % Math.max(visitRecipients.length, 1)];
    if (!recipient) {
      warnings.push(`Settimana ${week.label}: nessun destinatario per la visita.`);
      return;
    }

    const pair = pickPair(giovani, recipient, options.rules, load);
    if (!pair) {
      warnings.push(
        `Settimana ${week.label}: impossibile formare una coppia valida per ${recipient.name}.`
      );
    } else {
      pair.forEach((id) => load.set(id, (load.get(id) ?? 0) + 1));
      visits.push({
        id: nanoid(10),
        weekId: week.id,
        kind: "visita",
        assigneeIds: pair,
        recipientId: recipient.id,
        visitType: recipient.hospitalized
          ? "Visita in struttura"
          : "Visita a casa",
      });
    }

    const contactRecipient =
      contactRecipients[(wi + 3) % Math.max(contactRecipients.length, 1)];
    if (contactRecipient) {
      const solo = pickSolo(
        giovani,
        contactRecipient,
        options.rules,
        load,
        pair ?? []
      );
      if (solo) {
        load.set(solo, (load.get(solo) ?? 0) + 1);
        contacts.push({
          id: nanoid(10),
          weekId: week.id,
          kind: "contatto",
          assigneeIds: [solo],
          recipientId: contactRecipient.id,
          visitType: "Telefonata/Messaggio/Conversazione in sala",
        });
      }
    }
  });

  return { visits, contacts, warnings };
}

function resolveList(
  preferred: string[] | undefined,
  fallback: Person[]
): Person[] {
  if (preferred && preferred.length) {
    const map = new Map(fallback.map((p) => [p.id, p]));
    // include preferred even if filtered oddly
    const all = new Map(fallback.map((p) => [p.id, p]));
    preferred.forEach((id) => {
      const p = all.get(id) ?? map.get(id);
      if (p) map.set(id, p);
    });
    return preferred
      .map((id) => fallback.find((p) => p.id === id) || all.get(id))
      .filter(Boolean) as Person[];
  }
  return fallback;
}

function pickPair(
  giovani: Person[],
  recipient: Person,
  rules: ScheduleRules,
  load: Map<string, number>
): string[] | null {
  const eligible = giovani.filter((g) =>
    canVisit(g, recipient, rules)
  );

  if (eligible.length < rules.visitPairSize) return null;

  // Prefer same-gender pairs
  const genders: Array<"M" | "F"> =
    recipient.isCouple && rules.malePairsForCoupleRecipients
      ? ["M", "F"]
      : recipient.gender === "F"
        ? ["F", "M"]
        : ["M", "F"];

  for (const gender of genders) {
    let pool = eligible.filter((g) => g.gender === gender);
    if (!rules.sameGenderPairs) pool = eligible;
    if (pool.length < 2) continue;

    const sorted = [...pool].sort(
      (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
    );
    if (rules.sameGenderPairs) {
      return [sorted[0].id, sorted[1].id];
    }
  }

  // Mixed fallback if allowed
  if (!rules.sameGenderPairs && eligible.length >= 2) {
    const sorted = [...eligible].sort(
      (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
    );
    return [sorted[0].id, sorted[1].id];
  }

  // Last resort: any two eligible of preferred gender then any
  const sorted = [...eligible].sort(
    (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
  );
  if (sorted.length >= 2) return [sorted[0].id, sorted[1].id];
  return null;
}

function pickSolo(
  giovani: Person[],
  recipient: Person,
  rules: ScheduleRules,
  load: Map<string, number>,
  excludeIds: string[]
): string | null {
  const eligible = giovani
    .filter((g) => !excludeIds.includes(g.id))
    .filter((g) => canVisit(g, recipient, rules));
  if (!eligible.length) {
    const any = giovani
      .filter((g) => !excludeIds.includes(g.id))
      .sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0));
    return any[0]?.id ?? null;
  }
  const sorted = [...eligible].sort(
    (a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)
  );
  return sorted[0]?.id ?? null;
}

function canVisit(
  giovane: Person,
  recipient: Person,
  rules: ScheduleRules
): boolean {
  if (recipient.isCouple) return true;
  if (
    rules.femaleYouthOnlyVisitFemales &&
    giovane.gender === "F" &&
    recipient.gender === "M"
  ) {
    return false;
  }
  if (
    rules.maleYouthOnlyVisitMales &&
    giovane.gender === "M" &&
    recipient.gender === "F" &&
    !recipient.isCouple
  ) {
    return false;
  }
  return true;
}

export function monthGroups(weeks: WeekSlot[]): { label: string; weeks: WeekSlot[] }[] {
  const groups = new Map<string, WeekSlot[]>();
  for (const w of weeks) {
    const mid = addDays(parseISO(w.startDate), 3);
    const key = format(mid, "yyyy-MM");
    const arr = groups.get(key) ?? [];
    arr.push(w);
    groups.set(key, arr);
  }
  return [...groups.entries()].map(([, ws]) => {
    const mid = addDays(parseISO(ws[0].startDate), 3);
    const label = format(mid, "MMMM yyyy", { locale: it });
    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      weeks: ws,
    };
  });
}
