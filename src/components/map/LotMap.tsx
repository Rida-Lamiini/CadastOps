"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./setup-worker";
import BasemapToggle from "./BasemapToggle";
import { resolveStyle, type BasemapId } from "./styles";
import { bboxOfFeatureCollection, buildReferenceLines } from "./geo-utils";

function addLotLayers(map: maplibregl.Map, geojson: GeoJSON.FeatureCollection) {
  const refLines = buildReferenceLines(geojson);

  const lotSource = map.getSource("lot-data") as maplibregl.GeoJSONSource | undefined;
  if (lotSource) lotSource.setData(geojson);
  else map.addSource("lot-data", { type: "geojson", data: geojson });

  const refSource = map.getSource("ref-lines") as maplibregl.GeoJSONSource | undefined;
  if (refSource) refSource.setData(refLines);
  else map.addSource("ref-lines", { type: "geojson", data: refLines });

  if (!map.getLayer("lot-fill")) {
    map.addLayer({
      id: "lot-fill",
      type: "fill",
      source: "lot-data",
      filter: ["==", ["get", "kind"], "polygon"],
      paint: { "fill-color": "#A65A28", "fill-opacity": 0.15 },
    });
  }
  if (!map.getLayer("lot-outline")) {
    map.addLayer({
      id: "lot-outline",
      type: "line",
      source: "lot-data",
      filter: ["==", ["get", "kind"], "polygon"],
      paint: { "line-color": "#A65A28", "line-width": 2 },
    });
  }
  if (!map.getLayer("ref-line")) {
    map.addLayer({
      id: "ref-line",
      type: "line",
      source: "ref-lines",
      paint: { "line-color": "#1E2C3C", "line-width": 1.5, "line-dasharray": [2, 2] },
    });
  }
  if (!map.getLayer("ref-point")) {
    map.addLayer({
      id: "ref-point",
      type: "circle",
      source: "lot-data",
      filter: ["==", ["get", "kind"], "reference-point"],
      paint: { "circle-radius": 5, "circle-color": "#1E2C3C" },
    });
  }
  if (!map.getLayer("borne-point")) {
    map.addLayer({
      id: "borne-point",
      type: "circle",
      source: "lot-data",
      filter: ["==", ["get", "kind"], "borne"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#A65A28",
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#EFEBDE",
      },
    });
  }
}

export default function LotMap({ geojson }: { geojson: GeoJSON.FeatureCollection }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("streets");

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: resolveStyle("streets"),
      center: [-7.5, 33.5],
      zoom: 14,
      // needed so the canvas captures correctly in the Playwright PDF export
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      addLotLayers(map, geojson);
      const bbox = bboxOfFeatureCollection(geojson);
      if (bbox) {
        map.fitBounds(bbox, { padding: 48, maxZoom: 18, duration: 0 });
      }
    });

    map.on("click", "borne-point", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties as Record<string, number | string>;
      new maplibregl.Popup()
        .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div class="font-mono text-xs"><strong>${p.name}</strong><br/>X: ${Number(p.xLambert).toFixed(3)}<br/>Y: ${Number(p.yLambert).toFixed(3)}<br/>Lat: ${Number(p.lat).toFixed(6)}<br/>Lng: ${Number(p.lng).toFixed(6)}</div>`,
        )
        .addTo(map);
    });

    map.on("click", "ref-point", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const p = feature.properties as Record<string, number | string>;
      new maplibregl.Popup()
        .setLngLat((feature.geometry as GeoJSON.Point).coordinates as [number, number])
        .setHTML(
          `<div class="font-mono text-xs"><strong>${p.label}</strong><br/>Distance: ${Number(p.distanceM).toFixed(1)} m<br/>Azimut: ${Number(p.bearingDeg).toFixed(1)}°</div>`,
        )
        .addTo(map);
    });

    for (const layerId of ["borne-point", "ref-point"]) {
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

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
    map.once("styledata", () => addLotLayers(map, geojson));
  }, [basemap, geojson]);

  return (
    <div className="relative" data-map-container>
      <div ref={containerRef} className="h-[480px] w-full border border-line" />
      <BasemapToggle value={basemap} onChange={setBasemap} />
    </div>
  );
}
