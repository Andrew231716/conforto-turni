"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import type { Gender, Person, PersonRole } from "@/lib/types";

const empty = (): Person => ({
  id: nanoid(10),
  name: "",
  gender: "F",
  role: "giovane",
  phone: "",
  notes: "",
  hospitalized: false,
  isCouple: false,
  active: true,
});

export function PersonForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Person;
  onSave: (p: Person) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<Person>(initial ?? empty());

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        onSave({ ...form, name: form.name.trim(), phone: form.phone?.trim() });
      }}
    >
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Nome</span>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
      </label>
      <label className="grid gap-1">
        <span className="label">Ruolo</span>
        <select
          className="input"
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as PersonRole })
          }
        >
          <option value="giovane">Giovane / incaricato</option>
          <option value="destinatario">Destinatario</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span className="label">Genere</span>
        <select
          className="input"
          value={form.gender}
          onChange={(e) =>
            setForm({ ...form, gender: e.target.value as Gender })
          }
        >
          <option value="F">Femmina</option>
          <option value="M">Maschio</option>
        </select>
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Telefono (WhatsApp)</span>
        <input
          className="input"
          placeholder="3331234567 oppure +39…"
          value={form.phone ?? ""}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="label">Note</span>
        <input
          className="input"
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </label>
      {form.role === "destinatario" && (
        <div className="flex flex-wrap gap-4 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.hospitalized}
              onChange={(e) =>
                setForm({ ...form, hospitalized: e.target.checked })
              }
            />
            Ricoverato/a
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!form.isCouple}
              onChange={(e) =>
                setForm({ ...form, isCouple: e.target.checked })
              }
            />
            Coppia / coniugi
          </label>
        </div>
      )}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Attivo nel programma
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="btn-primary">
          Salva
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Annulla
          </button>
        )}
      </div>
    </form>
  );
}
