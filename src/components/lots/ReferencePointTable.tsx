"use client";

export interface ReferencePointRow {
  label: string;
  lat: string;
  lng: string;
}

export function emptyReferencePointRow(): ReferencePointRow {
  return { label: "", lat: "", lng: "" };
}

export default function ReferencePointTable({
  rows,
  onChange,
}: {
  rows: ReferencePointRow[];
  onChange: (rows: ReferencePointRow[]) => void;
}) {
  const update = (index: number, patch: Partial<ReferencePointRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, emptyReferencePointRow()]);

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-ink-muted border-b border-line">
            <th className="py-1.5 font-normal">Libellé</th>
            <th className="py-1.5 font-normal">Latitude</th>
            <th className="py-1.5 font-normal">Longitude</th>
            <th className="py-1.5 font-normal w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/50">
              <td className="py-1 pr-2">
                <input
                  className="w-full bg-transparent border border-line px-2 py-1"
                  value={row.label}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Biocodex Maroc"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  className="w-full bg-transparent border border-line px-2 py-1"
                  value={row.lat}
                  onChange={(e) => update(i, { lat: e.target.value })}
                  placeholder="33.3653297"
                  inputMode="decimal"
                />
              </td>
              <td className="py-1 pr-2">
                <input
                  className="w-full bg-transparent border border-line px-2 py-1"
                  value={row.lng}
                  onChange={(e) => update(i, { lng: e.target.value })}
                  placeholder="-7.5719223"
                  inputMode="decimal"
                />
              </td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="text-ecart hover:underline"
                  aria-label="Supprimer le point de référence"
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={add} className="mt-2 text-sm text-copper hover:underline">
        + Ajouter un point de référence
      </button>
    </div>
  );
}
