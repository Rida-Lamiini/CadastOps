import { getLotDetail } from "./lots";
import { getLotGeometryGeoJSON } from "./geometry";

export async function getLotFeatureCollection(id: string): Promise<GeoJSON.FeatureCollection | null> {
  const [lot, geometry] = await Promise.all([getLotDetail(id), getLotGeometryGeoJSON(id)]);
  if (!lot) return null;

  const features: GeoJSON.Feature[] = [];

  if (geometry) {
    features.push({
      type: "Feature",
      geometry: geometry.polygon,
      properties: { kind: "polygon", id: lot.id, titreFoncier: lot.titreFoncier },
    });
  }

  for (const borne of lot.bornes) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(borne.lng), Number(borne.lat)] },
      properties: {
        kind: "borne",
        name: borne.name,
        xLambert: Number(borne.xLambert),
        yLambert: Number(borne.yLambert),
        lat: Number(borne.lat),
        lng: Number(borne.lng),
      },
    });
  }

  for (const rp of lot.referencePoints) {
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Number(rp.lng), Number(rp.lat)] },
      properties: {
        kind: "reference-point",
        label: rp.label,
        distanceM: Number(rp.distanceM),
        bearingDeg: Number(rp.bearingDeg),
        centroidLat: geometry?.centroid.coordinates[1],
        centroidLng: geometry?.centroid.coordinates[0],
      },
    });
  }

  return { type: "FeatureCollection", features };
}
