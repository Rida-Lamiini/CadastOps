import { lambertToWgs84, type LambertPoint, type LatLng } from "./proj";
import {
  planarShoelaceAreaM2,
  planarPerimeterM,
  planarDistanceM,
  centroidOfLambertRing,
  distanceAndBearing,
  isDistanceConforme,
} from "./calculations";

export interface BorneInput {
  name: string;
  sequence: number;
  xLambert: number;
  yLambert: number;
}

export interface DistanceCheckInput {
  segmentLabel: string; // "B3452-B3453" — references two borne names
  croquisM: number;
}

export interface ReferencePointInput {
  label: string;
  lat: number;
  lng: number;
}

export interface BuiltBorne extends BorneInput, LatLng {}

export interface BuiltDistanceCheck extends DistanceCheckInput {
  calculeM: number;
  ecartM: number;
  conforme: boolean;
}

export interface BuiltReferencePoint extends ReferencePointInput {
  distanceM: number;
  bearingDeg: number;
}

export interface BuiltLotGeometry {
  bornes: BuiltBorne[];
  polygonRingLatLng: LatLng[];
  centroid: LatLng;
  surfaceCalculeeM2: number;
  perimeterM: number;
  distanceChecks: BuiltDistanceCheck[];
  referencePoints: BuiltReferencePoint[];
}

function findBorne(bornes: BorneInput[], name: string): BorneInput | undefined {
  const normalized = name.trim().toLowerCase();
  return bornes.find((b) => b.name.trim().toLowerCase() === normalized);
}

/**
 * Recomputes a lot's full geometry (area, perimeter, centroid, borne
 * lat/lng, distance-check deltas, reference-point distance/bearing) from
 * its bornes — the single source of truth used by both manual entry and
 * PDF-review submission so every save path verifies the same way.
 */
export function buildLotGeometry(
  bornesInput: BorneInput[],
  distanceChecksInput: DistanceCheckInput[],
  referencePointsInput: ReferencePointInput[],
): BuiltLotGeometry {
  const sorted = [...bornesInput].sort((a, b) => a.sequence - b.sequence);
  const ring: LambertPoint[] = sorted.map((b) => ({ x: b.xLambert, y: b.yLambert }));

  const surfaceCalculeeM2 = planarShoelaceAreaM2(ring);
  const perimeterM = planarPerimeterM(ring);
  const centroid = centroidOfLambertRing(ring);

  const bornes: BuiltBorne[] = sorted.map((b) => ({
    ...b,
    ...lambertToWgs84({ x: b.xLambert, y: b.yLambert }),
  }));
  const polygonRingLatLng = bornes.map((b) => ({ lat: b.lat, lng: b.lng }));

  const distanceChecks: BuiltDistanceCheck[] = distanceChecksInput.map((dc) => {
    const [fromName, toName] = dc.segmentLabel.split("-").map((s) => s.trim());
    const from = findBorne(bornesInput, fromName ?? "");
    const to = findBorne(bornesInput, toName ?? "");
    const calculeM =
      from && to ? planarDistanceM({ x: from.xLambert, y: from.yLambert }, { x: to.xLambert, y: to.yLambert }) : NaN;
    const ecartM = calculeM - dc.croquisM;
    return { ...dc, calculeM, ecartM, conforme: isDistanceConforme(ecartM) };
  });

  const referencePoints: BuiltReferencePoint[] = referencePointsInput.map((rp) => {
    const { distanceM, bearingDeg } = distanceAndBearing(centroid, { lat: rp.lat, lng: rp.lng });
    return { ...rp, distanceM, bearingDeg };
  });

  return { bornes, polygonRingLatLng, centroid, surfaceCalculeeM2, perimeterM, distanceChecks, referencePoints };
}

/**
 * A 1 m² tolerance isn't geometry-independent: how large a single-vertex
 * coordinate error has to be before it moves the shoelace area by 1 m²
 * depends on that vertex's neighbors (shoelaceAreaSensitivity in
 * calculations.ts — ∂Area/∂y_i shrinks toward zero as its neighbors'
 * X values converge, same for ∂Area/∂x_i and neighbor Y). Checked against
 * this app's real 9-borne test lot: worst case ~0.17 m minimum-detectable
 * error (B3453/B3454), comfortably under the ~3 m real OCR error it caught
 * — but a thinner/more degenerate lot shape could have a much larger blind
 * spot at some vertex. Don't assume this tolerance catches every possible
 * single-borne error on every lot shape without checking
 * shoelaceAreaSensitivity for that lot first.
 */
export const SURFACE_CONFORMITY_TOLERANCE_M2 = 1.0;

export function isSurfaceConforme(surfaceCalculeeM2: number, correctionLambertM2: number, surfaceDocumentM2: number): boolean {
  const ecart = surfaceCalculeeM2 + correctionLambertM2 - surfaceDocumentM2;
  return Math.abs(ecart) <= SURFACE_CONFORMITY_TOLERANCE_M2;
}
