"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { nanoid } from "nanoid";
import type {
  AppData,
  AppSettings,
  Assignment,
  Person,
  Program,
  ScheduleRules,
  WhatsAppTemplates,
} from "./types";
import { DEFAULT_RULES, DEFAULT_WHATSAPP, normalizePerson } from "./types";
import {
  exportAppDataJson,
  importAppDataJson,
  loadAppData,
  resetToSeed,
  saveAppData,
} from "./storage";
import { generateProgramAssignments, generateWeeks } from "./schedule";

interface StoreValue {
  ready: boolean;
  data: AppData;
  activeProgram: Program | null;
  setSettings: (s: Partial<AppSettings>) => void;
  upsertPerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  setActiveProgram: (id: string) => void;
  updateProgram: (id: string, patch: Partial<Program>) => void;
  upsertAssignment: (
    programId: string,
    list: "visits" | "contacts",
    assignment: Assignment
  ) => void;
  deleteAssignment: (
    programId: string,
    list: "visits" | "contacts",
    assignmentId: string
  ) => void;
  createProgramFromGenerator: (opts: {
    title: string;
    monthsLabel: string;
    startDate: string;
    weekCount: number;
    rules: ScheduleRules;
    visitRecipientIds?: string[];
    contactRecipientIds?: string[];
    previousProgramId?: string | null;
  }) => { program: Program; warnings: string[] };
  regenerateAssignments: (
    programId: string,
    rules?: ScheduleRules,
    extra?: {
      visitRecipientIds?: string[];
      contactRecipientIds?: string[];
      previousProgramId?: string | null;
    }
  ) => string[];
  updateWhatsAppTemplates: (
    programId: string,
    templates: Partial<WhatsAppTemplates>
  ) => void;
  exportJson: () => string;
  importJson: (json: string) => void;
  resetSeed: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    setData(loadAppData());
  }, []);

  const persist = useCallback((next: AppData) => {
    setData(next);
    saveAppData(next);
  }, []);

  const activeProgram = useMemo(() => {
    if (!data) return null;
    return (
      data.programs.find((p) => p.id === data.activeProgramId) ??
      data.programs[0] ??
      null
    );
  }, [data]);

  const value = useMemo<StoreValue>(() => {
    const empty: AppData = {
      version: 1,
      people: [],
      programs: [],
      activeProgramId: null,
      settings: {
        timezone: "Europe/Rome",
        calendarMode: "own",
        calendarlinkCollectionId: "3b8e59b7-0bcf-4e38-a8cc-a42d5a555cc4",
        defaultCountryCode: "39",
      },
    };
    const d = data ?? empty;

    return {
      ready: !!data,
      data: d,
      activeProgram,
      setSettings: (s) => {
        persist({ ...d, settings: { ...d.settings, ...s } });
      },
      upsertPerson: (person) => {
        const normalized = normalizePerson(person);
        const exists = d.people.some((p) => p.id === normalized.id);
        const people = exists
          ? d.people.map((p) => (p.id === normalized.id ? normalized : p))
          : [...d.people, normalized];
        persist({ ...d, people });
      },
      deletePerson: (id) => {
        persist({ ...d, people: d.people.filter((p) => p.id !== id) });
      },
      setActiveProgram: (id) => persist({ ...d, activeProgramId: id }),
      updateProgram: (id, patch) => {
        persist({
          ...d,
          programs: d.programs.map((p) =>
            p.id === id
              ? { ...p, ...patch, updatedAt: new Date().toISOString() }
              : p
          ),
        });
      },
      upsertAssignment: (programId, list, assignment) => {
        persist({
          ...d,
          programs: d.programs.map((p) => {
            if (p.id !== programId) return p;
            const arr = p[list];
            const exists = arr.some((a) => a.id === assignment.id);
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              [list]: exists
                ? arr.map((a) => (a.id === assignment.id ? assignment : a))
                : [...arr, assignment],
            };
          }),
        });
      },
      deleteAssignment: (programId, list, assignmentId) => {
        persist({
          ...d,
          programs: d.programs.map((p) =>
            p.id !== programId
              ? p
              : {
                  ...p,
                  updatedAt: new Date().toISOString(),
                  [list]: p[list].filter((a) => a.id !== assignmentId),
                }
          ),
        });
      },
      createProgramFromGenerator: (opts) => {
        const weeks = generateWeeks(opts.startDate, opts.weekCount);
        const previousProgram =
          (opts.previousProgramId
            ? d.programs.find((p) => p.id === opts.previousProgramId)
            : d.programs.find((p) => p.id === d.activeProgramId)) ?? null;
        const { visits, contacts, warnings } = generateProgramAssignments({
          weeks,
          people: d.people,
          rules: opts.rules,
          visitRecipientIds: opts.visitRecipientIds,
          contactRecipientIds: opts.contactRecipientIds,
          previousProgram,
        });
        const now = new Date().toISOString();
        const program: Program = {
          id: nanoid(12),
          title: opts.title,
          monthsLabel: opts.monthsLabel,
          weeks,
          visits,
          contacts,
          rules: opts.rules,
          whatsappTemplates: { ...DEFAULT_WHATSAPP },
          createdAt: now,
          updatedAt: now,
        };
        persist({
          ...d,
          programs: [...d.programs, program],
          activeProgramId: program.id,
        });
        return { program, warnings };
      },
      regenerateAssignments: (programId, rules, extra) => {
        const program = d.programs.find((p) => p.id === programId);
        if (!program) return ["Programma non trovato"];
        const usedRules = rules ?? program.rules ?? DEFAULT_RULES;
        const previousProgram =
          (extra?.previousProgramId
            ? d.programs.find((p) => p.id === extra.previousProgramId)
            : d.programs.filter((p) => p.id !== programId).at(-1)) ?? null;
        const { visits, contacts, warnings } = generateProgramAssignments({
          weeks: program.weeks,
          people: d.people,
          rules: usedRules,
          visitRecipientIds: extra?.visitRecipientIds,
          contactRecipientIds: extra?.contactRecipientIds,
          previousProgram,
        });
        persist({
          ...d,
          programs: d.programs.map((p) =>
            p.id === programId
              ? {
                  ...p,
                  rules: usedRules,
                  visits,
                  contacts,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        });
        return warnings;
      },
      updateWhatsAppTemplates: (programId, templates) => {
        persist({
          ...d,
          programs: d.programs.map((p) =>
            p.id === programId
              ? {
                  ...p,
                  whatsappTemplates: { ...p.whatsappTemplates, ...templates },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        });
      },
      exportJson: () => exportAppDataJson(d),
      importJson: (json) => {
        const imported = importAppDataJson(json);
        persist(imported);
      },
      resetSeed: () => persist(resetToSeed()),
    };
  }, [data, activeProgram, persist]);

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore fuori da StoreProvider");
  return ctx;
}
