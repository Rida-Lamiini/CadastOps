"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PdfUploadPanel from "@/components/lots/PdfUploadPanel";
import BorneTable, { type BorneRow, emptyBorneRow } from "@/components/lots/BorneTable";
import DistanceCheckTable, { type DistanceCheckRow } from "@/components/lots/DistanceCheckTable";
import ReferencePointTable, { type ReferencePointRow } from "@/components/lots/ReferencePointTable";
import type { ExtractionResult } from "@/lib/pdf/extract";
import { planarShoelaceAreaM2, shoelaceAreaSensitivity } from "@/lib/geo/calculations";
import { SURFACE_CONFORMITY_TOLERANCE_M2 } from "@/lib/geo/build-lot";

interface HeaderFields {
  titreFoncier: string;
  proprieteDite: string;
  lotNumber: string;
  affaireRef: string;
  geometre: string;
  dateLeve: string;
  serviceCadastre: string;
  surfaceDocumentM2: string;
  correctionLambertM2: string;
}

const emptyHeader: HeaderFields = {
  titreFoncier: "",
  proprieteDite: "",
  lotNumber: "",
  affaireRef: "",
  geometre: "",
  dateLeve: "",
  serviceCadastre: "",
  surfaceDocumentM2: "",
  correctionLambertM2: "0",
};

interface ExtractionInfo {
  method: ExtractionResult["extractionMethod"];
  rawText: string;
  systeme: string | null;
  surfaceCalculeeDoc: number | null;
  surfaceCorrigeeDoc: number | null;
  dateDoc: string | null;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function NewLotPage() {
  const router = useRouter();
  const [header, setHeader] = useState<HeaderFields>(emptyHeader);
  const [bornes, setBornes] = useState<BorneRow[]>([emptyBorneRow(), emptyBorneRow(), emptyBorneRow()]);
  const [distanceChecks, setDistanceChecks] = useState<DistanceCheckRow[]>([]);
  const [referencePoints, setReferencePoints] = useState<ReferencePointRow[]>([]);
  const [extraction, setExtraction] = useState<ExtractionInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function applyParsed(result: ExtractionResult) {
    setHeader((prev) => ({
      ...prev,
      titreFoncier: result.header.titreFoncier ?? prev.titreFoncier,
      proprieteDite: result.header.proprieteDite ?? prev.proprieteDite,
      lotNumber: result.header.lot ?? prev.lotNumber,
      affaireRef: result.header.natureAffaire ?? prev.affaireRef,
      geometre: result.header.geometre ?? prev.geometre,
      surfaceDocumentM2:
        result.header.contenanceAdoptee_m2 !== null
          ? String(result.header.contenanceAdoptee_m2)
          : prev.surfaceDocumentM2,
      correctionLambertM2:
        result.header.correctionLambert_m2 !== null
          ? String(result.header.correctionLambert_m2)
          : prev.correctionLambertM2,
    }));

    if (result.bornes.length > 0) {
      setBornes(
        result.bornes.map((b) => ({
          name: b.name,
          xLambert: String(b.x),
          yLambert: String(b.y),
          flagged: b.flagged,
          flagReason: b.flagReason,
        })),
      );
    }

    setExtraction({
      method: result.extractionMethod,
      rawText: result.rawOcrText,
      systeme: result.header.systeme,
      surfaceCalculeeDoc: result.header.surfaceCalculee_m2,
      surfaceCorrigeeDoc: result.header.surfaceCorrigee_m2,
      dateDoc: result.header.date,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const parsedBornes = bornes
      .filter((b) => b.name.trim() && b.xLambert.trim() && b.yLambert.trim())
      .map((b, i) => ({
        name: b.name.trim(),
        sequence: i,
        xLambert: Number(b.xLambert),
        yLambert: Number(b.yLambert),
      }));

    if (parsedBornes.length < 3) {
      setSubmitError("Un polygone nécessite au moins 3 bornes valides.");
      return;
    }
    if (!header.titreFoncier.trim() || !header.proprieteDite.trim()) {
      setSubmitError("Le titre foncier et la propriété dite sont obligatoires.");
      return;
    }

    const payload = {
      titreFoncier: header.titreFoncier.trim(),
      proprieteDite: header.proprieteDite.trim(),
      lotNumber: header.lotNumber.trim() || undefined,
      affaireRef: header.affaireRef.trim() || undefined,
      geometre: header.geometre.trim() || undefined,
      dateLeve: header.dateLeve || undefined,
      serviceCadastre: header.serviceCadastre.trim() || undefined,
      surfaceDocumentM2: Number(header.surfaceDocumentM2 || 0),
      correctionLambertM2: Number(header.correctionLambertM2 || 0),
      bornes: parsedBornes,
      distanceChecks: distanceChecks
        .filter((dc) => dc.segmentLabel.trim() && dc.croquisM.trim())
        .map((dc) => ({ segmentLabel: dc.segmentLabel.trim(), croquisM: Number(dc.croquisM) })),
      referencePoints: referencePoints
        .filter((rp) => rp.label.trim() && rp.lat.trim() && rp.lng.trim())
        .map((rp) => ({ label: rp.label.trim(), lat: Number(rp.lat), lng: Number(rp.lng) })),
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/lots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ? JSON.stringify(data.error) : "Échec de l'enregistrement.");
        return;
      }
      router.push(`/lots/${data.id}`);
    } catch {
      setSubmitError("Échec de l'enregistrement. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  const flaggedCount = bornes.filter((b) => b.flagged).length;
  const systemeWarning = extraction?.systeme && !/lambert/i.test(extraction.systeme);

  // Recomputed live from whatever's currently in the borne table (including in-progress
  // corrections), independent of which individual rows got flagged — a small per-borne
  // coordinate error can be too small to trip the X/Y outlier check or the distance
  // cross-check (which needs several sketch distances to have OCR'd cleanly to say anything
  // at all), but it still throws off the shoelace area, and the document's own "S" value is
  // already sitting right there to compare against.
  const validBornePoints = useMemo(
    () =>
      bornes
        .filter((b) => b.xLambert.trim() && b.yLambert.trim())
        .map((b) => ({ name: b.name || "?", x: Number(b.xLambert), y: Number(b.yLambert) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
    [bornes],
  );
  const computedAreaM2 = validBornePoints.length >= 3 ? planarShoelaceAreaM2(validBornePoints) : null;
  const surfaceCrossCheck =
    computedAreaM2 !== null && extraction?.surfaceCalculeeDoc != null
      ? {
          computed: computedAreaM2,
          document: extraction.surfaceCalculeeDoc,
          delta: computedAreaM2 - extraction.surfaceCalculeeDoc,
        }
      : null;
  const surfaceMismatch = surfaceCrossCheck ? Math.abs(surfaceCrossCheck.delta) > SURFACE_CONFORMITY_TOLERANCE_M2 : false;

  // A 1 m² area tolerance isn't equally sensitive at every vertex — how large a coordinate
  // error at a given borne has to be before it moves the area by 1 m² depends on how close
  // that borne's two neighbors are on the other axis (see shoelaceAreaSensitivity). Surface
  // the worst case for THIS lot's actual shape so a thin/degenerate polygon with a real blind
  // spot is visible, rather than silently assuming the area check above catches everything.
  const SENSITIVITY_WARNING_THRESHOLD_M = 2;
  const worstSensitivity = useMemo(() => {
    if (validBornePoints.length < 3) return null;
    let worst = { minDetectableM: 0, borneName: "" };
    shoelaceAreaSensitivity(validBornePoints).forEach((s) => {
      const minDetX =
        Math.abs(s.dAreaPerDx) > 0 ? SURFACE_CONFORMITY_TOLERANCE_M2 / Math.abs(s.dAreaPerDx) : Infinity;
      const minDetY =
        Math.abs(s.dAreaPerDy) > 0 ? SURFACE_CONFORMITY_TOLERANCE_M2 / Math.abs(s.dAreaPerDy) : Infinity;
      const weakest = Math.max(minDetX, minDetY);
      if (weakest > worst.minDetectableM) {
        worst = { minDetectableM: weakest, borneName: validBornePoints[s.index].name };
      }
    });
    return worst;
  }, [validBornePoints]);
  const sensitivityGap = worstSensitivity && worstSensitivity.minDetectableM > SENSITIVITY_WARNING_THRESHOLD_M;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl">Nouveau lot</h1>

      <PdfUploadPanel onParsed={applyParsed} />

      {extraction && (
        <div className="title-block p-4 text-sm space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-ink-muted">Méthode d&apos;extraction :</span>
            <span className={extraction.method === "ocr" ? "text-ecart" : "text-conforme"}>
              {extraction.method === "ocr" ? "OCR (document scanné)" : "Texte natif du PDF"}
            </span>
          </div>
          {extraction.method === "ocr" && (
            <p className="text-ecart">
              Document scanné — toutes les valeurs ci-dessous sont issues d&apos;une reconnaissance
              automatique et doivent être vérifiées avant d&apos;enregistrer.
            </p>
          )}
          {flaggedCount > 0 && (
            <p className="text-ecart">
              {flaggedCount} borne{flaggedCount > 1 ? "s" : ""} signalée{flaggedCount > 1 ? "s" : ""} comme
              suspecte{flaggedCount > 1 ? "s" : ""} dans le tableau ci-dessous.
            </p>
          )}
          {systemeWarning && (
            <p className="text-ecart">
              Système lu sur le document : « {extraction.systeme} » — attendu « LAMBERT ». Vérifiez la
              projection.
            </p>
          )}
          {(extraction.surfaceCalculeeDoc !== null || extraction.surfaceCorrigeeDoc !== null) && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-ink-muted">
              {extraction.surfaceCalculeeDoc !== null && (
                <>
                  <dt>S (document)</dt>
                  <dd className="text-ink">{fmt(extraction.surfaceCalculeeDoc)} m²</dd>
                </>
              )}
              {extraction.surfaceCorrigeeDoc !== null && (
                <>
                  <dt>Surface corrigée (document)</dt>
                  <dd className="text-ink">{fmt(extraction.surfaceCorrigeeDoc)} m²</dd>
                </>
              )}
            </dl>
          )}
          {surfaceCrossCheck && (
            <p
              className={`border px-3 py-2 ${surfaceMismatch ? "border-ecart bg-[color-mix(in_srgb,var(--ecart)_8%,transparent)] text-ecart" : "border-conforme bg-[color-mix(in_srgb,var(--conforme)_8%,transparent)] text-conforme"}`}
            >
              {surfaceMismatch ? (
                <>
                  <strong>Surface recalculée ne correspond pas au document :</strong> {fmt(surfaceCrossCheck.computed)} m²
                  calculés à partir des bornes ci-dessous vs {fmt(surfaceCrossCheck.document)} m² sur le document (écart{" "}
                  {surfaceCrossCheck.delta >= 0 ? "+" : ""}
                  {fmt(surfaceCrossCheck.delta)} m²). Au moins une coordonnée est probablement erronée, même si aucune
                  ligne n&apos;est signalée ci-dessous — comparez avec le texte OCR brut ou le document original.
                </>
              ) : (
                <>
                  Surface recalculée conforme au document (écart {surfaceCrossCheck.delta >= 0 ? "+" : ""}
                  {fmt(surfaceCrossCheck.delta)} m²).
                </>
              )}
            </p>
          )}
          {worstSensitivity &&
            (sensitivityGap ? (
              <p className="border border-ecart bg-[color-mix(in_srgb,var(--ecart)_8%,transparent)] px-3 py-2 text-ecart">
                <strong>Contrôle de surface peu sensible pour {worstSensitivity.borneName} :</strong> sur la
                géométrie actuelle, une erreur de coordonnée inférieure à {worstSensitivity.minDetectableM.toFixed(1)}{" "}
                m sur cette borne ne changerait pas la surface recalculée de plus d&apos;{SURFACE_CONFORMITY_TOLERANCE_M2}{" "}
                m² — le contrôle ci-dessus ne la détecterait pas. Vérifiez cette borne plus attentivement.
              </p>
            ) : (
              <p className="text-ink-muted">
                Sensibilité du contrôle de surface : toute erreur ≥ {worstSensitivity.minDetectableM.toFixed(2)} m sur
                n&apos;importe quelle borne serait détectée ci-dessus.
              </p>
            ))}
          {extraction.dateDoc && (
            <p className="text-ink-muted">
              Date lue sur le document : <span className="text-ink">{extraction.dateDoc}</span> — à reporter
              manuellement dans le champ « Date de levé » ci-dessous (jour non lisible automatiquement).
            </p>
          )}
          <details className="pt-1">
            <summary className="cursor-pointer text-copper">Texte brut extrait (pour vérification)</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap border border-line bg-paper p-2 text-xs">
              {extraction.rawText || "(vide)"}
            </pre>
          </details>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="title-block p-4">
          <h2 className="font-heading text-lg mb-3">Informations générales</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <label className="block">
              <span className="text-ink-muted">Titre foncier *</span>
              <input
                className={`mt-1 w-full bg-transparent border px-2 py-1 ${extraction ? "border-ecart" : "border-line"}`}
                value={header.titreFoncier}
                onChange={(e) => setHeader({ ...header, titreFoncier: e.target.value })}
                required
              />
              {extraction && (
                <span className="mt-1 block text-xs text-ecart">
                  À confirmer manuellement — ce champ est généralement manuscrit sur le document.
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-ink-muted">Propriété dite *</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.proprieteDite}
                onChange={(e) => setHeader({ ...header, proprieteDite: e.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Lot n°</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.lotNumber}
                onChange={(e) => setHeader({ ...header, lotNumber: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Affaire</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.affaireRef}
                onChange={(e) => setHeader({ ...header, affaireRef: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Géomètre</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.geometre}
                onChange={(e) => setHeader({ ...header, geometre: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Date de levé</span>
              <input
                type="date"
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.dateLeve}
                onChange={(e) => setHeader({ ...header, dateLeve: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Service du cadastre</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.serviceCadastre}
                onChange={(e) => setHeader({ ...header, serviceCadastre: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Contenance adoptée (m²) *</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.surfaceDocumentM2}
                onChange={(e) => setHeader({ ...header, surfaceDocumentM2: e.target.value })}
                inputMode="decimal"
                required
              />
            </label>
            <label className="block">
              <span className="text-ink-muted">Correction Lambert (m²)</span>
              <input
                className="mt-1 w-full bg-transparent border border-line px-2 py-1"
                value={header.correctionLambertM2}
                onChange={(e) => setHeader({ ...header, correctionLambertM2: e.target.value })}
                inputMode="decimal"
              />
            </label>
          </div>
        </section>

        <section className="title-block p-4">
          <h2 className="font-heading text-lg mb-3">Bornes (ordre du périmètre)</h2>
          <BorneTable rows={bornes} onChange={setBornes} />
        </section>

        <section className="title-block p-4">
          <h2 className="font-heading text-lg mb-3">Contrôles de distance</h2>
          <DistanceCheckTable rows={distanceChecks} onChange={setDistanceChecks} />
        </section>

        <section className="title-block p-4">
          <h2 className="font-heading text-lg mb-3">Points de référence</h2>
          <ReferencePointTable rows={referencePoints} onChange={setReferencePoints} />
        </section>

        {submitError && <p className="text-sm text-ecart">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-copper text-paper px-5 py-2 text-sm uppercase tracking-wide hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Enregistrement…" : "Enregistrer le lot"}
        </button>
      </form>
    </div>
  );
}
