import Link from "next/link";
import { listLots } from "@/lib/db/lots";
import ConformiteBadge from "@/components/lots/ConformiteBadge";

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d: Date) => new Date(d).toLocaleDateString("fr-FR");

export default async function LotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const lots = await listLots(q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl">Lots</h1>
        <Link
          href="/lots/new"
          className="bg-copper text-paper px-4 py-2 text-sm uppercase tracking-wide hover:opacity-90"
        >
          + Nouveau lot
        </Link>
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Rechercher par titre foncier ou propriété…"
          className="flex-1 bg-transparent border border-line px-3 py-2 text-sm"
        />
        <button type="submit" className="border border-line px-4 py-2 text-sm hover:bg-copper-soft">
          Rechercher
        </button>
      </form>

      <div className="title-block overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-line text-ink-muted">
              <th className="px-4 py-2 font-normal">Titre foncier</th>
              <th className="px-4 py-2 font-normal">Propriété dite</th>
              <th className="px-4 py-2 font-normal text-right">Surface (m²)</th>
              <th className="px-4 py-2 font-normal">Statut</th>
              <th className="px-4 py-2 font-normal">Mis à jour</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-line/50 hover:bg-copper-soft">
                <td className="px-4 py-2">
                  <Link href={`/lots/${lot.id}`} className="hover:text-copper">
                    {lot.titreFoncier}
                  </Link>
                </td>
                <td className="px-4 py-2">{lot.proprieteDite}</td>
                <td className="px-4 py-2 text-right">{fmt(lot.surfaceDocumentM2)}</td>
                <td className="px-4 py-2">
                  <ConformiteBadge conforme={lot.conforme} />
                </td>
                <td className="px-4 py-2 text-ink-muted">{fmtDate(lot.updatedAt)}</td>
              </tr>
            ))}
            {lots.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  Aucun lot trouvé.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
