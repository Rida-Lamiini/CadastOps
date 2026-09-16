"use client";

export interface BorneRow {
  name: string;
  xLambert: string;
  yLambert: string;
  flagged?: boolean;
  flagReason?: string;
}

export function emptyBorneRow(): BorneRow {
  return { name: "", xLambert: "", yLambert: "" };
}

export default function BorneTable({
  rows,
  onChange,
}: {
  rows: BorneRow[];
  onChange: (rows: BorneRow[]) => void;
}) {
  const update = (index: number, patch: Partial<BorneRow>) => {
    onChange(
      rows.map((r, i) =>
        // Editing a flagged row is how the user confirms/corrects it — clear the flag.
        i === index ? { ...r, ...patch, flagged: false, flagReason: undefined } : r,
      ),
    );
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, emptyBorneRow()]);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted border-b border-line">
            <th className="py-1.5 font-normal w-16">#</th>
            <th className="py-1.5 font-normal">Borne</th>
            <th className="py-1.5 font-normal">X (Lambert)</th>
            <th className="py-1.5 font-normal">Y (Lambert)</th>
            <th className="py-1.5 font-normal w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-line/50 ${row.flagged ? "bg-[color-mix(in_srgb,var(--ecart)_10%,transparent)]" : ""}`}
            >
              <td className="py-1 text-ink-muted">{i + 1}</td>
              <td className="py-1 pr-2">
                <input
                  className={`w-full bg-transparent border px-2 py-1 ${row.flagged ? "border-ecart" : "border-line"}`}
                  value={row.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="B3452"
                  title={row.flagReason}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  className={`w-full bg-transparent border px-2 py-1 ${row.flagged ? "border-ecart" : "border-line"}`}
                  value={row.xLambert}
                  onChange={(e) => update(i, { xLambert: e.target.value })}
                  placeholder="245123.456"
                  inputMode="decimal"
                  title={row.flagReason}
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  className={`w-full bg-transparent border px-2 py-1 ${row.flagged ? "border-ecart" : "border-line"}`}
                  value={row.yLambert}
                  onChange={(e) => update(i, { yLambert: e.target.value })}
                  placeholder="187654.321"
                  inputMode="decimal"
                  title={row.flagReason}
                />
              </td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-ecart hover:underline"
                  aria-label="Supprimer la borne"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.some((r) => r.flagged) && (
        <p className="mt-2 text-xs text-ecart">
          Lignes en rouge : valeur suspecte détectée automatiquement (OCR) — vérifiez et corrigez avant d&apos;enregistrer.
        </p>
      )}
      <button
        type="button"
        onClick={add}
        className="mt-2 text-sm text-copper hover:underline"
      >
        + Ajouter une borne
      </button>
    </div>
  );
}
