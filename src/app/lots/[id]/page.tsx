import { notFound } from "next/navigation";
import { getLotDetail } from "@/lib/db/lots";
import { getLotFeatureCollection } from "@/lib/db/lot-features";
import LotMap from "@/components/map/LotMap";
import VerificationPanel from "@/components/lots/VerificationPanel";

const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [lot, geojson] = await Promise.all([getLotDetail(id), getLotFeatureCollection(id)]);

  if (!lot || !geojson) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl">{lot.proprieteDite}</h1>
          <p className="text-ink-muted text-sm">
            Titre foncier {lot.titreFoncier}
            {lot.lotNumber ? ` · Lot ${lot.lotNumber}` : ""}
          </p>
        </div>
        <a
          href={`/api/lots/${lot.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="no-print border border-line px-4 py-2 text-sm uppercase tracking-wide hover:bg-copper-soft"
        >
          Export PDF
        </a>
      </div>

      <section className="title-block p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-ink-muted">Géomètre</div>
          <div>{lot.geometre ?? "—"}</div>
        </div>
        <div>
          <div className="text-ink-muted">Date de levé</div>
          <div>{fmtDate(lot.dateLeve)}</div>
        </div>
        <div>
          <div className="text-ink-muted">Service du cadastre</div>
          <div>{lot.serviceCadastre ?? "—"}</div>
        </div>
        <div>
          <div className="text-ink-muted">Affaire</div>
          <div>{lot.affaireRef ?? "—"}</div>
        </div>
      </section>

      <LotMap geojson={geojson} />

      <VerificationPanel
        surfaceDocumentM2={Number(lot.surfaceDocumentM2)}
        surfaceCalculeeM2={Number(lot.surfaceCalculeeM2)}
        correctionLambertM2={Number(lot.correctionLambertM2)}
        bornes={lot.bornes.map((b) => ({ xLambert: Number(b.xLambert), yLambert: Number(b.yLambert) }))}
        distanceChecks={lot.distanceChecks.map((dc) => ({
          segmentLabel: dc.segmentLabel,
          croquisM: Number(dc.croquisM),
          calculeM: Number(dc.calculeM),
          ecartM: Number(dc.ecartM),
        }))}
      />

      <section className="title-block p-4">
        <h2 className="font-heading text-lg mb-3">Bornes</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-muted border-b border-line">
              <th className="py-1.5 font-normal">Borne</th>
              <th className="py-1.5 font-normal text-right">X (Lambert)</th>
              <th className="py-1.5 font-normal text-right">Y (Lambert)</th>
              <th className="py-1.5 font-normal text-right">Latitude</th>
              <th className="py-1.5 font-normal text-right">Longitude</th>
            </tr>
          </thead>
          <tbody>
            {lot.bornes.map((b) => (
              <tr key={b.id} className="border-b border-line/50">
                <td className="py-1.5">{b.name}</td>
                <td className="py-1.5 text-right">{Number(b.xLambert).toFixed(3)}</td>
                <td className="py-1.5 text-right">{Number(b.yLambert).toFixed(3)}</td>
                <td className="py-1.5 text-right">{Number(b.lat).toFixed(7)}</td>
                <td className="py-1.5 text-right">{Number(b.lng).toFixed(7)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
