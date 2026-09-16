export function bboxOfFeatureCollection(
  fc: GeoJSON.FeatureCollection,
): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const visit = (coords: GeoJSON.Position | GeoJSON.Position[] | GeoJSON.Position[][] | GeoJSON.Position[][][]): void => {
    if (typeof coords[0] === "number") {
      const [x, y] = coords as GeoJSON.Position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else {
      for (const c of coords as GeoJSON.Position[]) visit(c);
    }
  };

  for (const feature of fc.features) {
    if (!feature.geometry || !("coordinates" in feature.geometry)) continue;
    visit(feature.geometry.coordinates as GeoJSON.Position[][][]);
  }

  if (minX === Infinity) return null;
  return [minX, minY, maxX, maxY];
}

/** Builds a dashed-line FeatureCollection from each reference-point feature back to the lot centroid. */
export function buildReferenceLines(fc: GeoJSON.FeatureCollection): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const feature of fc.features) {
    if (feature.properties?.kind !== "reference-point") continue;
    if (feature.geometry.type !== "Point") continue;
    const { centroidLat, centroidLng } = feature.properties as {
      centroidLat?: number;
      centroidLng?: number;
    };
    if (centroidLat === undefined || centroidLng === undefined) continue;
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [centroidLng, centroidLat],
          feature.geometry.coordinates,
        ],
      },
      properties: feature.properties,
    });
  }
  return { type: "FeatureCollection", features };
}
