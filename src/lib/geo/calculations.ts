import turfCentroid from "@turf/centroid";
import turfDistance from "@turf/distance";
import turfBearing from "@turf/bearing";
import { polygon as turfPolygonHelper, point as turfPointHelper } from "@turf/helpers";

import { lambertToWgs84, type LambertPoint, type LatLng } from "./proj";

/**
 * @turf/area computes geodesic area assuming its input is lon/lat degrees.
 * Fed raw Lambert meters (e.g. x≈500000) it would fold through cos/sin as
 * bogus "degrees" and produce garbage, not a scaled planar area. So the
 * planar area/perimeter here are plain shoelace/Euclidean math on the
 * Lambert plane instead — this is what actually matches how the ANCFCC
 * document computes area from bornes, and it's what "shoelace-equivalent"
 * means. Only genuinely geographic ops (distance/bearing to a real-world
 * reference point) go through Turf's haversine functions on WGS84 lat/lng.
 */
function closeRing(ring: LambertPoint[]): LambertPoint[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.x === last.x && first.y === last.y) return ring;
  return [...ring, first];
}

/** Planar shoelace area (m²) of a Lambert-plane polygon ring, in borne sequence order. */
export function planarShoelaceAreaM2(ring: LambertPoint[]): number {
  const closed = closeRing(ring);
  let twiceArea = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    const a = closed[i];
    const b = closed[i + 1];
    twiceArea += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twiceArea) / 2;
}

export interface VertexAreaSensitivity {
  index: number;
  /** m² of area error per meter of X error at this vertex. */
  dAreaPerDx: number;
  /** m² of area error per meter of Y error at this vertex. */
  dAreaPerDy: number;
}

/**
 * Per-vertex partial derivative of the shoelace area with respect to that
 * vertex's own X and Y (∂Area/∂x_i = (y_{i+1}-y_{i-1})/2, ∂Area/∂y_i =
 * (x_{i-1}-x_{i+1})/2 — standard shoelace-formula derivatives). This is
 * what an area cross-check tolerance is implicitly relying on: a vertex
 * whose two neighbors are close together in Y has a near-zero dAreaPerDx,
 * so an X error there can be arbitrarily large and still hide under the
 * tolerance (mirrored for dAreaPerDy and close-together neighbor X). Use
 * this to find those blind spots for a given ring before trusting an area
 * check to catch every possible single-vertex error.
 */
export function shoelaceAreaSensitivity(ring: LambertPoint[]): VertexAreaSensitivity[] {
  const n = ring.length;
  if (n < 3) return [];
  return ring.map((_, i) => {
    const prev = ring[(i - 1 + n) % n];
    const next = ring[(i + 1) % n];
    return {
      index: i,
      dAreaPerDx: (next.y - prev.y) / 2,
      dAreaPerDy: (prev.x - next.x) / 2,
    };
  });
}

/** Euclidean distance (m) between two Lambert-plane points. */
export function planarDistanceM(a: LambertPoint, b: LambertPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Sum of consecutive borne-to-borne planar distances, closing the loop back to the first borne. */
export function planarPerimeterM(ring: LambertPoint[]): number {
  const closed = closeRing(ring);
  let total = 0;
  for (let i = 0; i < closed.length - 1; i++) {
    total += planarDistanceM(closed[i], closed[i + 1]);
  }
  return total;
}

/**
 * Arithmetic-mean centroid of the Lambert-plane ring (Turf's centroid module
 * is just a vertex mean, no geodesic trig, so it's safe on any planar unit),
 * converted to WGS84 for storage/display.
 */
export function centroidOfLambertRing(ring: LambertPoint[]): LatLng {
  const closed = closeRing(ring);
  const feature = turfPolygonHelper([closed.map((p) => [p.x, p.y])]);
  const [x, y] = turfCentroid(feature).geometry.coordinates;
  return lambertToWgs84({ x, y });
}

/** Real-world great-circle distance (m) and bearing (deg) from one WGS84 point to another. */
export function distanceAndBearing(
  from: LatLng,
  to: LatLng,
): { distanceM: number; bearingDeg: number } {
  const fromPoint = turfPointHelper([from.lng, from.lat]);
  const toPoint = turfPointHelper([to.lng, to.lat]);
  const distanceM = turfDistance(fromPoint, toPoint, { units: "meters" });
  const bearingDeg = (turfBearing(fromPoint, toPoint) + 360) % 360;
  return { distanceM, bearingDeg };
}

const CONFORMITY_TOLERANCE_M = 0.1;

export function isDistanceConforme(ecartM: number): boolean {
  return Math.abs(ecartM) <= CONFORMITY_TOLERANCE_M;
}
