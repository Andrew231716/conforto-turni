import { nanoid } from "nanoid";
import { addDays, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import type {
  Assignment,
  Person,
  Program,
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

export interface GenerateOptions {
  weeks: WeekSlot[];
  people: Person[];
  rules: ScheduleRules;
  /** Destinatari da ruotare nelle visite (ordine preferito) */
  visitRecipientIds?: string[];
  /** Destinatari per contatti alternativi */
  contactRecipientIds?: string[];
  /** Programma precedente da cui continuare il ciclo */
  previousProgram?: Program | null;
}

export function generateProgramAssignments(
  options: GenerateOptions
): { visits: Assignment[]; contacts: Assignment[]; warnings: string[] } {
  const warnings: string[] = [];
  const rules = options.rules;

  const giovaniVisitaCasa = options.people.filter(
    (p) => p.role === "giovane" && p.active && p.duties?.visiteCasa
  );
  const giovaniVisitaStruttura = options.people.filter(
    (p) => p.role === "giovane" && p.active && p.duties?.visiteStruttura
  );
  const giovaniContatto = options.people.filter(
    (p) => p.role === "giovane" && p.active && p.duties?.contatti
  );

  const destinatari = options.people.filter(
    (p) => p.role === "destinatario" && p.active
  );

  if (giovaniVisitaCasa.length + giovaniVisitaStruttura.length < 2) {
    warnings.push(
      "Servono almeno 2 giovani abilitati alle visite (casa o struttura)."
    );
  }
  if (!giovaniContatto.length) {
    warnings.push("Nessun giovane abilitato ai contatti alternativi.");
  }

  let visitRecipients = sortDestinatari(
    resolveList(
      options.visitRecipientIds,
      destinatari.filter(
        (d) => d.duties?.visiteCasa || d.duties?.visiteStruttura
      )
    )
  );
  let contactRecipients = sortDestinatari(
    resolveList(
      options.contactRecipientIds,
      destinatari.filter((d) => d.duties?.contatti)
    )
  );

  if (rules.continueRecipientCycle && options.previousProgram) {
    visitRecipients = continueCycle(
      visitRecipients,
      options.previousProgram.visits
    );
    contactRecipients = continueCycle(
      contactRecipients,
      options.previousProgram.contacts
    );
  }

  const load = new Map<string, number>();
  for (const g of options.people.filter((p) => p.role === "giovane")) {
    load.set(g.id, 0);
  }

  const visits: Assignment[] = [];
  const contacts: Assignment[] = [];

  options.weeks.forEach((week, wi) => {
    const recipient =
      visitRecipients[wi % Math.max(visitRecipients.length, 1)];
    if (!recipient) {
      warnings.push(
        `Settimana ${week.label}: nessun destinatario per la visita.`
      );
    } else {
      const visitType: "Visita a casa" | "Visita in struttura" =
        recipient.hospitalized ? "Visita in struttura" : "Visita a casa";
      const pool =
        visitType === "Visita in struttura"
          ? giovaniVisitaStruttura
          : giovaniVisitaCasa;

      const pair = pickPair(pool, recipient, rules, load);
      if (!pair) {
        warnings.push(
          `Settimana ${week.label}: impossibile formare una coppia valida per ${recipient.name} (${visitType}).`
        );
      } else {
        pair.forEach((id) => load.set(id, (load.get(id) ?? 0) + 1));
        visits.push({
          id: nanoid(10),
          weekId: week.id,
          kind: "visita",
          assigneeIds: pair,
          recipientId: recipient.id,
          visitType,
        });
      }
    }

    const contactRecipient =
      contactRecipients[wi % Math.max(contactRecipients.length, 1)];
    if (contactRecipient) {
      const usedThisWeek = visits.find((v) => v.weekId === week.id)?.assigneeIds ?? [];
      const solo = pickSolo(
        giovaniContatto,
        contactRecipient,
        rules,
        load,
        usedThisWeek
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
      } else {
        warnings.push(
          `Settimana ${week.label}: nessun giovane disponibile per il contatto.`
        );
      }
    }
  });

  return { visits, contacts, warnings };
}

/** Ordina destinatari per cycleOrder poi nome */
export function sortDestinatari(list: Person[]): Person[] {
  return [...list].sort((a, b) => {
    const oa = a.cycleOrder ?? 9999;
    const ob = b.cycleOrder ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, "it");
  });
}

/**
 * Continua il ciclo: dal primo non ancora presente nel programma precedente;
 * se tutti sono stati coperti, riparte dal successivo all'ultimo assegnato.
 */
export function continueCycle(
  ordered: Person[],
  previous: Assignment[]
): Person[] {
  if (!ordered.length || !previous.length) return ordered;

  const chronological = [...previous];
  const visitedSet = new Set(chronological.map((a) => a.recipientId));
  const firstMissing = ordered.findIndex((p) => !visitedSet.has(p.id));

  if (firstMissing >= 0) {
    return [...ordered.slice(firstMissing), ...ordered.slice(0, firstMissing)];
  }

  const lastId = chronological[chronological.length - 1]?.recipientId;
  const lastIdx = ordered.findIndex((p) => p.id === lastId);
  const start = lastIdx >= 0 ? (lastIdx + 1) % ordered.length : 0;
  return [...ordered.slice(start), ...ordered.slice(0, start)];
}

function resolveList(
  preferred: string[] | undefined,
  fallback: Person[]
): Person[] {
  if (preferred && preferred.length) {
    const byId = new Map(fallback.map((p) => [p.id, p]));
    // also allow ids from preferred even if filtered — look in preferred only from fallback
    return preferred.map((id) => byId.get(id)).filter(Boolean) as Person[];
  }
  return fallback;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rankPool(
  pool: Person[],
  load: Map<string, number>,
  randomize: boolean,
  balance: boolean
): Person[] {
  let list = [...pool];
  if (randomize) list = shuffle(list);
  if (balance) {
    list.sort((a, b) => {
      const diff = (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0);
      if (diff !== 0) return diff;
      return randomize ? 0 : a.name.localeCompare(b.name, "it");
    });
  }
  return list;
}

function pickPair(
  giovani: Person[],
  recipient: Person,
  rules: ScheduleRules,
  load: Map<string, number>
): string[] | null {
  const eligible = giovani.filter((g) => canPairWith(g, recipient, rules));
  if (eligible.length < rules.visitPairSize) return null;

  const genders: Array<"M" | "F"> =
    recipient.isCouple && rules.malePairsForCoupleRecipients
      ? ["M", "F"]
      : recipient.gender === "F"
        ? ["F", "M"]
        : ["M", "F"];

  for (const gender of genders) {
    let pool = rules.sameGenderPairs
      ? eligible.filter((g) => g.gender === gender)
      : eligible;
    if (pool.length < 2) continue;

    const ranked = rankPool(
      pool,
      load,
      rules.randomizeYouth,
      rules.balanceWorkload
    );

    if (rules.sameGenderPairs) {
      // pick two of same gender; if randomize, shuffle among lowest-load band
      if (rules.randomizeYouth && rules.balanceWorkload) {
        const minLoad = load.get(ranked[0].id) ?? 0;
        const band = ranked.filter((p) => (load.get(p.id) ?? 0) <= minLoad + 1);
        const picked = shuffle(band).slice(0, 2);
        if (picked.length >= 2) return [picked[0].id, picked[1].id];
      }
      return [ranked[0].id, ranked[1].id];
    }
  }

  if (!rules.sameGenderPairs && eligible.length >= 2) {
    const ranked = rankPool(
      eligible,
      load,
      rules.randomizeYouth,
      rules.balanceWorkload
    );
    return [ranked[0].id, ranked[1].id];
  }

  const ranked = rankPool(
    eligible,
    load,
    rules.randomizeYouth,
    rules.balanceWorkload
  );
  if (ranked.length >= 2) return [ranked[0].id, ranked[1].id];
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
    .filter((g) => canPairWith(g, recipient, rules));

  const pool = eligible.length
    ? eligible
    : giovani.filter((g) => !excludeIds.includes(g.id));

  if (!pool.length) return null;

  const ranked = rankPool(
    pool,
    load,
    rules.randomizeYouth,
    rules.balanceWorkload
  );

  if (rules.randomizeYouth && rules.balanceWorkload) {
    const minLoad = load.get(ranked[0].id) ?? 0;
    const band = ranked.filter((p) => (load.get(p.id) ?? 0) <= minLoad + 1);
    return shuffle(band)[0]?.id ?? ranked[0].id;
  }
  return ranked[0]?.id ?? null;
}

function canPairWith(
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

export function monthGroups(
  weeks: WeekSlot[]
): { label: string; weeks: WeekSlot[] }[] {
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

/** Anteprima testuale di chi partirà nel ciclo */
export function describeCycleStart(
  ordered: Person[],
  previous: Assignment[] | undefined,
  continueCycleFlag: boolean
): string {
  if (!ordered.length) return "Nessun destinatario";
  const list =
    continueCycleFlag && previous?.length
      ? continueCycle(ordered, previous)
      : ordered;
  return list[0]?.name ?? "—";
}
