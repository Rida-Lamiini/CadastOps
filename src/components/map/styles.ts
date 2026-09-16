import type { StyleSpecification } from "@maplibre/maplibre-gl-style-spec";

export const STREETS_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: "esri-imagery", type: "raster", source: "esri" }],
};

export type BasemapId = "streets" | "satellite";

export function resolveStyle(basemap: BasemapId): string | StyleSpecification {
  return basemap === "streets" ? STREETS_STYLE_URL : SATELLITE_STYLE;
}
