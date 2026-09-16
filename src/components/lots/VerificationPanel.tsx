import { planarPerimeterM, isDistanceConforme } from "@/lib/geo/calculations";
import { isSurfaceConforme } from "@/lib/geo/build-lot";
import ConformiteBadge from "./ConformiteBadge";

interface VerificationPanelProps {
  surfaceDocumentM2: number;
  surfaceCalculeeM2: number;
  correctionLambertM2: number;
  bornes: Array<{ xLambert: number; yLambert: number }>;
  distanceChecks: Array<{ segmentLabel: string; croquisM: number; calculeM: number; ecartM: number }>;
}

const fmt = (n: number, digits = 2) => n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function VerificationPanel({
  surfaceDocumentM2,
  surfaceCalculeeM2,
  correctionLambertM2,
  bornes,
  distanceChecks,
}: VerificationPanelProps) {
  const perimeterM = planarPerimeterM(bornes.map((b) => ({ x: b.xLambert, y: b.yLambert })));
  const surfaceEcart = surfaceCalculeeM2 + correctionLambertM2 - surfaceDocumentM2;
  const surfaceOk = isSurfaceConforme(surfaceCalculeeM2, correctionLambertM2, surfaceDocumentM2);

  return (
    <div className="space-y-6">
      <section className="title-block p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-lg">Vérification de surface</h2>
          <ConformiteBadge conforme={surfaceOk} />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-ink-muted">Surface calculée (bornes)</dt>
          <dd className="text-right">{fmt(surfaceCalculeeM2)} m²</dd>
          <dt className="text-ink-muted">Correction Lambert</dt>
          <dd className="text-right">{correctionLambertM2 >= 0 ? "+" : ""}{fmt(correctionLambertM2)} m²</dd>
          <dt className="text-ink-muted">Contenance adoptée (document)</dt>
          <dd className="text-right">{fmt(surfaceDocumentM2)} m²</dd>
          <dt className="text-ink-muted">Écart</dt>
          <dd className={`text-right ${surfaceOk ? "text-conforme" : "text-ecart"}`}>
            {surfaceEcart >= 0 ? "+" : ""}
            {fmt(surfaceEcart)} m²
          </dd>
          <dt className="text-ink-muted">Périmètre calculé</dt>
          <dd className="text-right">{fmt(perimeterM)} m</dd>
        </dl>
      </section>

      <section className="title-block p-4">
        <h2 className="font-heading text-lg mb-3">Contrôle des distances</h2>
        {distanceChecks.length === 0 ? (
          <p className="text-sm text-ink-muted">Aucun contrôle de distance enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted border-b border-line">
                <th className="py-1.5 font-normal">Segment</th>
                <th className="py-1.5 font-normal text-right">Croquis (m)</th>
                <th className="py-1.5 font-normal text-right">Calculé (m)</th>
                <th className="py-1.5 font-normal text-right">Écart (m)</th>
                <th className="py-1.5 font-normal text-right">Statut</th>
              </tr>
            </thead>
            <tbody>
              {distanceChecks.map((dc) => {
                const ok = isDistanceConforme(dc.ecartM);
                return (
                  <tr key={dc.segmentLabel} className="border-b border-line/50">
                    <td className="py-1.5">{dc.segmentLabel}</td>
                    <td className="py-1.5 text-right">{fmt(dc.croquisM, 3)}</td>
                    <td className="py-1.5 text-right">{fmt(dc.calculeM, 3)}</td>
                    <td className={`py-1.5 text-right ${ok ? "text-conforme" : "text-ecart"}`}>
                      {dc.ecartM >= 0 ? "+" : ""}
                      {fmt(dc.ecartM, 3)}
                    </td>
                    <td className="py-1.5 text-right">
                      <ConformiteBadge conforme={ok} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
