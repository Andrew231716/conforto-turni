"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { PersonForm } from "@/components/PersonForm";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { Person } from "@/lib/types";

export default function PersonePage() {
  const { ready, data, upsertPerson, deletePerson } = useStore();
  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"tutti" | "giovane" | "destinatario">(
    "tutti"
  );
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    return data.people
      .filter((p) => (filter === "tutti" ? true : p.role === filter))
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }, [data.people, filter, q]);

  if (!ready) return <p>Caricamento…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Persone</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Elenco modificabile di giovani e destinatari, con numeri per WhatsApp.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          Aggiungi persona
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["tutti", "Tutti"],
            ["giovane", "Giovani"],
            ["destinatario", "Destinatari"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "btn-primary" : "btn-ghost"}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <input
          className="input max-w-xs"
          placeholder="Cerca nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {(creating || editing) && (
        <div className="panel">
          <h2 className="font-display mb-3 text-lg">
            {editing ? "Modifica" : "Nuova persona"}
          </h2>
          <PersonForm
            initial={editing ?? undefined}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSave={(p) => {
              upsertPerson(p);
              setCreating(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ruolo</th>
              <th>Genere</th>
              <th>Telefono</th>
              <th>Flag</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className={!p.active ? "opacity-50" : undefined}>
                <td className="font-medium">{p.name}</td>
                <td>{p.role === "giovane" ? "Giovane" : "Destinatario"}</td>
                <td>{p.gender}</td>
                <td className="font-mono text-xs">{p.phone || "—"}</td>
                <td className="text-xs text-[var(--muted)]">
                  {[
                    p.hospitalized && "ricoverato/a",
                    p.isCouple && "coppia",
                    !p.active && "inattivo",
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="btn-ghost !px-2 !py-1 text-xs"
                      onClick={() => {
                        setEditing(p);
                        setCreating(false);
                      }}
                    >
                      Modifica
                    </button>
                    {p.role === "giovane" && (
                      <WhatsAppButton
                        person={p}
                        countryCode={data.settings.defaultCountryCode}
                        message={`Ciao ${p.name}!`}
                        label="WA"
                        className="btn-wa !px-2 !py-1 text-xs"
                      />
                    )}
                    <button
                      type="button"
                      className="btn-ghost !px-2 !py-1 text-xs text-red-700"
                      onClick={() => {
                        if (confirm(`Eliminare ${p.name}?`)) deletePerson(p.id);
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
