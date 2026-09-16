import { listAllLotPolygonsGeoJSON } from "@/lib/db/geometry";
import OverviewMap from "@/components/map/OverviewMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const lots = await listAllLotPolygonsGeoJSON();

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: lots.map((lot) => ({
      type: "Feature",
      geometry: lot.polygon,
      properties: { id: lot.id, titreFoncier: lot.titreFoncier, proprieteDite: lot.proprieteDite },
    })),
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl">Carte des lots</h1>
      <p className="text-sm text-ink-muted">
        {lots.length} lot{lots.length > 1 ? "s" : ""} — cliquez sur un polygone pour ouvrir sa fiche.
      </p>
      <OverviewMap geojson={geojson} />
    </div>
  );
}
