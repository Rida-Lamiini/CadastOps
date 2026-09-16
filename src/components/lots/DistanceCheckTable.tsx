"use client";

export interface DistanceCheckRow {
  segmentLabel: string;
  croquisM: string;
}

export function emptyDistanceCheckRow(): DistanceCheckRow {
  return { segmentLabel: "", croquisM: "" };
}

export default function DistanceCheckTable({
  rows,
  onChange,
}: {
  rows: DistanceCheckRow[];
  onChange: (rows: DistanceCheckRow[]) => void;
}) {
  const update = (index: number, patch: Partial<DistanceCheckRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, emptyDistanceCheckRow()]);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted border-b border-line">
            <th className="py-1.5 font-normal">Segment (ex: B3452-B3453)</th>
            <th className="py-1.5 font-normal">Croquis (m)</th>
            <th className="py-1.5 font-normal w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/50">
              <td className="py-1 pr-2">
                <input
                  className="w-full bg-transparent border border-line px-2 py-1"
                  value={row.segmentLabel}
                  onChange={(e) => update(i, { segmentLabel: e.target.value })}
                  placeholder="B3452-B3453"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  className="w-full bg-transparent border border-line px-2 py-1"
                  value={row.croquisM}
                  onChange={(e) => update(i, { croquisM: e.target.value })}
                  placeholder="45.67"
                  inputMode="decimal"
                />
              </td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-ecart hover:underline"
                  aria-label="Supprimer le contrôle"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={add} className="mt-2 text-sm text-copper hover:underline">
        + Ajouter un contrôle de distance
      </button>
    </div>
  );
}
