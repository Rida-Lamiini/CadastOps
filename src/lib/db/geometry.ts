import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { LatLng } from "../geo/proj";

/**
 * Prisma models PostGIS columns as `Unsupported(...)`, so all reads/writes
 * of `lots.polygon` / `lots.centroid` go through raw SQL here. Values are
 * passed as tagged-template parameters, which Prisma parameterizes — never
 * string-concatenate untrusted input into these queries.
 */

function closeLatLngRing(ring: LatLng[]): LatLng[] {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.lat === last.lat && first.lng === last.lng) return ring;
  return [...ring, first];
}

function ringToWkt(ring: LatLng[]): string {
  const closed = closeLatLngRing(ring);
  const pairs = closed.map((p) => `${p.lng} ${p.lat}`).join(", ");
  return `POLYGON((${pairs}))`;
}

function pointToWkt(p: LatLng): string {
  return `POINT(${p.lng} ${p.lat})`;
}

export async function setLotGeometry(
  lotId: string,
  ringLatLng: LatLng[],
  centroidLatLng: LatLng,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  const polygonWkt = ringToWkt(ringLatLng);
  const centroidWkt = pointToWkt(centroidLatLng);
  await client.$executeRaw`
    UPDATE lots
    SET polygon = ST_SetSRID(ST_GeomFromText(${polygonWkt}), 4326),
        centroid = ST_SetSRID(ST_GeomFromText(${centroidWkt}), 4326)
    WHERE id = ${lotId}
  `;
}

interface LotGeometryRow {
  polygon: string | null;
  centroid: string | null;
}

export async function getLotGeometryGeoJSON(
  lotId: string,
): Promise<{ polygon: GeoJSON.Polygon; centroid: GeoJSON.Point } | null> {
  const rows = await prisma.$queryRaw<LotGeometryRow[]>`
    SELECT ST_AsGeoJSON(polygon) AS polygon, ST_AsGeoJSON(centroid) AS centroid
    FROM lots
    WHERE id = ${lotId}
  `;
  const row = rows[0];
  if (!row || !row.polygon || !row.centroid) return null;
  return {
    polygon: JSON.parse(row.polygon) as GeoJSON.Polygon,
    centroid: JSON.parse(row.centroid) as GeoJSON.Point,
  };
}

interface LotPolygonListRow {
  id: string;
  titre_foncier: string;
  propriete_dite: string;
  polygon: string | null;
}

export interface LotPolygonSummary {
  id: string;
  titreFoncier: string;
  proprieteDite: string;
  polygon: GeoJSON.Polygon;
}

export async function listAllLotPolygonsGeoJSON(): Promise<LotPolygonSummary[]> {
  const rows = await prisma.$queryRaw<LotPolygonListRow[]>`
    SELECT id, titre_foncier, propriete_dite, ST_AsGeoJSON(polygon) AS polygon
    FROM lots
    WHERE polygon IS NOT NULL
    ORDER BY created_at DESC
  `;
  return rows
    .filter((r) => r.polygon !== null)
    .map((r) => ({
      id: r.id,
      titreFoncier: r.titre_foncier,
      proprieteDite: r.propriete_dite,
      polygon: JSON.parse(r.polygon as string) as GeoJSON.Polygon,
    }));
}
