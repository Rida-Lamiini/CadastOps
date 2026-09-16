"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./setup-worker";
import BasemapToggle from "./BasemapToggle";
import { resolveStyle, type BasemapId } from "./styles";
import { bboxOfFeatureCollection } from "./geo-utils";

function addOverviewLayers(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection) {
  const source = map.getSource("all-lots") as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(geojson);
  else map.addSource("all-lots", { type: "geojson", data: geojson });

  if (!map.getLayer("all-lots-fill")) {
    map.addLayer({
      id: "all-lots-fill",
      type: "fill",
      source: "all-lots",
      paint: { "fill-color": "#A65A28", "fill-opacity": 0.18 },
    });
  }
  if (!map.getLayer("all-lots-outline")) {
    map.addLayer({
      id: "all-lots-outline",
      type: "line",
      source: "all-lots",
      paint: { "line-color": "#A65A28", "line-width": 2 },
    });
  }
}

export default function OverviewMap({ geojson }: { geojson: GeoJSON.FeatureCollection }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("streets");
  const router = useRouter();

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle("streets"),
      center: [-7.5, 33.5],
      zoom: 12,
      // needed so the canvas captures correctly in the Playwright PDF export
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      addOverviewLayers(map, geojson);
      const bbox = bboxOfFeatureCollection(geojson);
      if (bbox) map.fitBounds(bbox, { padding: 48, maxZoom: 17, duration: 0 });
    });

    map.on("click", "all-lots-fill", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) router.push(`/lots/${id}`);
    });
    map.on("mouseenter", "all-lots-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "all-lots-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFirstBasemapRender = useRef(true);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // The map is already constructed with this basemap on mount — skip the
    // redundant setStyle() call, which would otherwise interrupt the
    // in-flight initial tile loading and leave the vector source stuck.
    if (isFirstBasemapRender.current) {
      isFirstBasemapRender.current = false;
      return;
    }
    map.setStyle(resolveStyle(basemap));
    map.once("styledata", () => addOverviewLayers(map, geojson));
  }, [basemap, geojson]);

  return (
    <div className="relative">
      <div ref={containerRef} className="h-[70vh] w-full border border-line" />
      <BasemapToggle value={basemap} onChange={setBasemap} />
    </div>
  );
}
