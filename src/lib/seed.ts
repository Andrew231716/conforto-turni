import { nanoid } from "nanoid";
import type { AppData, Assignment, Person, Program, WeekSlot } from "./types";
import { DEFAULT_RULES, DEFAULT_SETTINGS, DEFAULT_WHATSAPP } from "./types";

function p(
  name: string,
  gender: "M" | "F",
  role: "giovane" | "destinatario",
  extra: Partial<Person> = {}
): Person {
  return {
    id: nanoid(10),
    name,
    gender,
    role,
    active: true,
    ...extra,
  };
}

export function createSeedPeople(): Person[] {
  const giovani: Person[] = [
    p("Andrea Petrelli", "M", "giovane"),
    p("Andrea Pozzi", "M", "giovane"),
    p("Maurizio Prota", "M", "giovane"),
    p("Valeria Gandini", "F", "giovane"),
    p("Ilaria Marras", "F", "giovane"),
    p("Serena Prota", "F", "giovane"),
    p("Alice Petrelli", "F", "giovane"),
    p("Emma Battaglia", "F", "giovane"),
    p("Francesca Calvio", "F", "giovane"),
  ];

  const destinatari: Person[] = [
    p("Lorenzo Russo", "M", "destinatario", { hospitalized: true }),
    p("Monopoli Lucia", "F", "destinatario"),
    p("Streparola Teresa", "F", "destinatario"),
    p("Nesci Adelina", "F", "destinatario"),
    p("De Rinaldis Ornella", "F", "destinatario"),
    p("Coniugi Calabrese", "M", "destinatario", { isCouple: true }),
    p("Germanò Angela", "F", "destinatario"),
    p("De Lisi Anna Maria", "F", "destinatario"),
    p("Leccardi Fiorella", "F", "destinatario"),
    p("Angela Suzzani", "F", "destinatario", { hospitalized: true }),
    p("Cristini Giuliana", "F", "destinatario"),
    p("Lapenna Antonietta", "F", "destinatario"),
    p("Bettera Carmen", "F", "destinatario"),
    p("Vignola Rosanna", "F", "destinatario"),
    p("Belivacqua Michelina", "F", "destinatario"),
    p("La Gona Lina", "F", "destinatario"),
    p("Battiato Stella", "F", "destinatario"),
  ];

  return [...giovani, ...destinatari];
}

function byName(people: Person[], name: string): string {
  const found = people.find((x) => x.name === name);
  if (!found) throw new Error(`Persona non trovata nel seed: ${name}`);
  return found.id;
}

function week(start: string, end: string, label: string): WeekSlot {
  return { id: nanoid(8), startDate: start, endDate: end, label };
}

function visita(
  weekId: string,
  assignees: string[],
  recipientId: string,
  visitType: "Visita a casa" | "Visita in struttura"
): Assignment {
  return {
    id: nanoid(10),
    weekId,
    kind: "visita",
    assigneeIds: assignees,
    recipientId,
    visitType,
  };
}

function contatto(
  weekId: string,
  assigneeId: string,
  recipientId: string
): Assignment {
  return {
    id: nanoid(10),
    weekId,
    kind: "contatto",
    assigneeIds: [assigneeId],
    recipientId,
    visitType: "Telefonata/Messaggio/Conversazione in sala",
  };
}

export function createSeedProgram(people: Person[]): Program {
  const w = {
    s1: week("2026-08-31", "2026-09-06", "31 agosto - 6 settembre"),
    s2: week("2026-09-07", "2026-09-13", "7-13 settembre"),
    s3: week("2026-09-14", "2026-09-20", "14-20 settembre"),
    s4: week("2026-09-21", "2026-09-27", "21-27 settembre"),
    o1: week("2026-09-28", "2026-10-04", "28 settembre - 4 ottobre"),
    o2: week("2026-10-05", "2026-10-11", "5-11 ottobre"),
    o3: week("2026-10-12", "2026-10-18", "12-18 ottobre"),
    o4: week("2026-10-19", "2026-10-25", "19-25 ottobre"),
    n1: week("2026-10-26", "2026-11-01", "26 ottobre - 1 novembre"),
    n2: week("2026-11-02", "2026-11-08", "2-8 novembre"),
    n3: week("2026-11-09", "2026-11-15", "9-15 novembre"),
    n4: week("2026-11-16", "2026-11-22", "16-22 novembre"),
    n5: week("2026-11-23", "2026-11-29", "23-29 novembre"),
  };

  const id = (n: string) => byName(people, n);
  const now = new Date().toISOString();

  return {
    id: nanoid(12),
    title: "Programma di Visite e Incoraggiamento",
    monthsLabel: "Settembre - Ottobre - Novembre 2026",
    weeks: Object.values(w),
    rules: { ...DEFAULT_RULES },
    whatsappTemplates: { ...DEFAULT_WHATSAPP },
    createdAt: now,
    updatedAt: now,
    visits: [
      visita(w.s1.id, [id("Andrea Petrelli"), id("Maurizio Prota")], id("Lorenzo Russo"), "Visita in struttura"),
      visita(w.s2.id, [id("Valeria Gandini"), id("Ilaria Marras")], id("Monopoli Lucia"), "Visita a casa"),
      visita(w.s3.id, [id("Serena Prota"), id("Ilaria Marras")], id("Streparola Teresa"), "Visita a casa"),
      visita(w.s4.id, [id("Andrea Petrelli"), id("Andrea Pozzi")], id("Nesci Adelina"), "Visita a casa"),
      visita(w.o1.id, [id("Ilaria Marras"), id("Serena Prota")], id("De Rinaldis Ornella"), "Visita a casa"),
      visita(w.o2.id, [id("Andrea Petrelli"), id("Maurizio Prota")], id("Coniugi Calabrese"), "Visita a casa"),
      visita(w.o3.id, [id("Valeria Gandini"), id("Serena Prota")], id("Germanò Angela"), "Visita a casa"),
      visita(w.o4.id, [id("Ilaria Marras"), id("Valeria Gandini")], id("De Lisi Anna Maria"), "Visita a casa"),
      visita(w.n1.id, [id("Andrea Pozzi"), id("Maurizio Prota")], id("Leccardi Fiorella"), "Visita a casa"),
      visita(w.n2.id, [id("Valeria Gandini"), id("Ilaria Marras")], id("Angela Suzzani"), "Visita in struttura"),
      visita(w.n3.id, [id("Andrea Pozzi"), id("Maurizio Prota")], id("Lorenzo Russo"), "Visita in struttura"),
      visita(w.n4.id, [id("Serena Prota"), id("Valeria Gandini")], id("Monopoli Lucia"), "Visita a casa"),
      visita(w.n5.id, [id("Ilaria Marras"), id("Serena Prota")], id("Streparola Teresa"), "Visita a casa"),
    ],
    contacts: [
      contatto(w.s1.id, id("Alice Petrelli"), id("De Rinaldis Ornella")),
      contatto(w.s2.id, id("Emma Battaglia"), id("Cristini Giuliana")),
      contatto(w.s3.id, id("Francesca Calvio"), id("Lapenna Antonietta")),
      contatto(w.s4.id, id("Maurizio Prota"), id("Bettera Carmen")),
      contatto(w.o1.id, id("Serena Prota"), id("Vignola Rosanna")),
      contatto(w.o2.id, id("Francesca Calvio"), id("Belivacqua Michelina")),
      contatto(w.o3.id, id("Alice Petrelli"), id("La Gona Lina")),
      contatto(w.o4.id, id("Emma Battaglia"), id("Battiato Stella")),
      contatto(w.n1.id, id("Alice Petrelli"), id("Cristini Giuliana")),
      contatto(w.n2.id, id("Emma Battaglia"), id("Lapenna Antonietta")),
      contatto(w.n3.id, id("Francesca Calvio"), id("Bettera Carmen")),
      contatto(w.n4.id, id("Serena Prota"), id("Vignola Rosanna")),
      contatto(w.n5.id, id("Maurizio Prota"), id("De Rinaldis Ornella")),
    ],
  };
}

export function createSeedData(): AppData {
  const people = createSeedPeople();
  const program = createSeedProgram(people);
  return {
    version: 1,
    people,
    programs: [program],
    activeProgramId: program.id,
    settings: { ...DEFAULT_SETTINGS },
  };
}
