import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPairWith,
  continueCycle,
  generateProgramAssignments,
  generateWeeks,
  sortDestinatari,
} from "./schedule";
import { isValidPhoneInput, normalizePhone } from "./whatsapp";
import { stripPersonFromPrograms, validateAssignment } from "./validation";
import { DEFAULT_RULES, type Person, type Program } from "./types";

function giovane(
  id: string,
  name: string,
  gender: "M" | "F",
  duties = { visiteCasa: true, visiteStruttura: true, contatti: true }
): Person {
  return {
    id,
    name,
    gender,
    role: "giovane",
    active: true,
    duties,
  };
}

function destinatario(
  id: string,
  name: string,
  gender: "M" | "F",
  extra: Partial<Person> = {}
): Person {
  return {
    id,
    name,
    gender,
    role: "destinatario",
    active: true,
    duties: { visiteCasa: true, visiteStruttura: true, contatti: true },
    ...extra,
  };
}

describe("schedule rules", () => {
  it("canPairWith blocks female youth with male recipient when rule on", () => {
    const f = giovane("f1", "Anna", "F");
    const m = destinatario("d1", "Mario", "M");
    assert.equal(
      canPairWith(f, m, { ...DEFAULT_RULES, femaleYouthOnlyVisitFemales: true }),
      false
    );
    assert.equal(
      canPairWith(f, m, {
        ...DEFAULT_RULES,
        femaleYouthOnlyVisitFemales: false,
      }),
      true
    );
  });

  it("continueCycle starts after last covered recipient", () => {
    const ordered = [
      destinatario("a", "A", "F", { cycleOrder: 1 }),
      destinatario("b", "B", "F", { cycleOrder: 2 }),
      destinatario("c", "C", "F", { cycleOrder: 3 }),
    ];
    const prev = [
      {
        id: "1",
        weekId: "w",
        kind: "visita" as const,
        assigneeIds: [],
        recipientId: "a",
        visitType: "Visita a casa" as const,
      },
      {
        id: "2",
        weekId: "w",
        kind: "visita" as const,
        assigneeIds: [],
        recipientId: "b",
        visitType: "Visita a casa" as const,
      },
    ];
    const next = continueCycle(ordered, prev);
    assert.equal(next[0].id, "c");
  });

  it("sortDestinatari uses cycleOrder", () => {
    const list = sortDestinatari([
      destinatario("z", "Zeta", "F", { cycleOrder: 2 }),
      destinatario("a", "Alfa", "F", { cycleOrder: 1 }),
    ]);
    assert.equal(list[0].name, "Alfa");
  });

  it("generateWeeks creates consecutive slots", () => {
    const weeks = generateWeeks("2026-11-30", 2, 1);
    assert.equal(weeks.length, 2);
    assert.equal(weeks[0].startDate, "2026-11-30");
    assert.equal(weeks[0].endDate, "2026-12-06");
    assert.equal(weeks[1].startDate, "2026-12-07");
  });

  it("same-gender pairs never mix when rule is on", () => {
    const people = [
      giovane("m1", "Marco", "M"),
      giovane("m2", "Luca", "M"),
      giovane("f1", "Sara", "F"),
      giovane("f2", "Giulia", "F"),
      giovane("c1", "Emma", "F", {
        visiteCasa: false,
        visiteStruttura: false,
        contatti: true,
      }),
      destinatario("d1", "Lucia", "F", { cycleOrder: 1 }),
      destinatario("d2", "Anna", "F", { cycleOrder: 2 }),
    ];
    const weeks = generateWeeks("2026-11-30", 4, 1);
    const { visits } = generateProgramAssignments({
      weeks,
      people,
      rules: { ...DEFAULT_RULES, randomizeYouth: false },
    });
    for (const v of visits) {
      const genders = v.assigneeIds.map(
        (id) => people.find((p) => p.id === id)!.gender
      );
      assert.equal(genders[0], genders[1], `mixed pair in ${v.id}`);
    }
  });
});

describe("phone + validation", () => {
  it("normalizes Italian mobiles", () => {
    assert.equal(normalizePhone("3331234567"), "393331234567");
    assert.equal(normalizePhone("+39 333 123 4567"), "393331234567");
    assert.equal(isValidPhoneInput("333"), false);
    assert.equal(isValidPhoneInput(""), true);
  });

  it("validateAssignment rejects mixed gender pairs", () => {
    const people = [
      giovane("m1", "Marco", "M"),
      giovane("f1", "Sara", "F"),
      destinatario("d1", "Lucia", "F"),
    ];
    const week = {
      id: "w1",
      startDate: "2026-11-30",
      endDate: "2026-12-06",
      label: "test",
    };
    const errs = validateAssignment(
      {
        id: "a1",
        weekId: "w1",
        kind: "visita",
        assigneeIds: ["m1", "f1"],
        recipientId: "d1",
        visitType: "Visita a casa",
      },
      week,
      people,
      { ...DEFAULT_RULES, sameGenderPairs: true },
      []
    );
    assert.ok(errs.some((e) => e.includes("stesso sesso")));
  });

  it("stripPersonFromPrograms removes orphans", () => {
    const program = {
      id: "p1",
      title: "t",
      monthsLabel: "m",
      weeks: [],
      rules: DEFAULT_RULES,
      whatsappTemplates: {
        visita: "",
        contatto: "",
        reminder: "",
      },
      createdAt: "",
      updatedAt: "",
      visits: [
        {
          id: "v1",
          weekId: "w",
          kind: "visita" as const,
          assigneeIds: ["g1", "g2"],
          recipientId: "d1",
          visitType: "Visita a casa" as const,
        },
      ],
      contacts: [
        {
          id: "c1",
          weekId: "w",
          kind: "contatto" as const,
          assigneeIds: ["g1"],
          recipientId: "d2",
          visitType:
            "Telefonata/Messaggio/Conversazione in sala" as const,
        },
      ],
    } satisfies Program;
    const cleaned = stripPersonFromPrograms([program], "g1");
    assert.deepEqual(cleaned[0].visits[0].assigneeIds, ["g2"]);
    assert.equal(cleaned[0].contacts.length, 0);
  });
});
