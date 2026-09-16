import proj4 from "proj4";

/**
 * Lambert Nord Maroc / Merchich (EPSG:26191).
 * Clarke 1880 (IGN) ellipsoid, Lambert Conformal Conic, false origin at
 * Ain Sebaa. This is the projection used on ANCFCC "Calcul de Contenances"
 * documents for lots north of the Merchich datum's southern boundary.
 */
const LAMBERT_NORD_MAROC =
  "+proj=lcc +lat_1=33.3 +lat_0=33.3 +lon_0=-5.4 +k_0=0.999625769 " +
  "+x_0=500000 +y_0=300000 +a=6378249.2 +b=6356515 " +
  "+towgs84=31,146,47,0,0,0,0 +units=m +no_defs";

const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

proj4.defs("EPSG:26191", LAMBERT_NORD_MAROC);
proj4.defs("EPSG:4326", WGS84);

export interface LambertPoint {
  x: number;
  y: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Convert a Lambert Nord Maroc (Merchich) X,Y pair to WGS84 lat/lng. */
export function lambertToWgs84({ x, y }: LambertPoint): LatLng {
  const [lng, lat] = proj4("EPSG:26191", "EPSG:4326", [x, y]);
  return { lat, lng };
}

/** Convert a WGS84 lat/lng back to Lambert Nord Maroc (Merchich) X,Y. */
export function wgs84ToLambert({ lat, lng }: LatLng): LambertPoint {
  const [x, y] = proj4("EPSG:4326", "EPSG:26191", [lng, lat]);
  return { x, y };
}
