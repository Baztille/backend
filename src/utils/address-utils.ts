// Définir les types pour les points et les polygones
type Point = [number, number];
type Polygon = Point[];

/**
 * Vérifie si un point est à l'intérieur d'un polygone en utilisant l'algorithme du rayon.
 * @param point Le point à vérifier [x, y].
 * @param polygon Les sommets du polygone [[x1, y1], [x2, y2], ...].
 * @returns true si le point est à l'intérieur du polygone, sinon false.
 */
export function inside(point: Point, polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;

  // Parcourir chaque segment du polygone
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    // Vérifier si le point intersecte le segment du polygone
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}
/**
 * Récupère le numéro de circonscription électorale (circo) en fonction des coordonnées géographiques (latitude, longitude) et du département.
 * @param lat Latitude du point.
 * @param lon Longitude du point.
 * @param dep Code départemental (ex: '75' pour Paris).
 * @returns Le numéro de la circonscription électorale si le point se trouve à l'intérieur, sinon undefined.
 */
/*
export async function getCirco(lat: number, lon: number, dep: string): Promise<string | undefined> {
  const point: [number, number] = [lon, lat];
  const code3_dep: string = getCode3Dep(Number(dep));
  const circos: string[] = DICT_CIRCO_PAR_DEP[code3_dep].split(';');

  if (circos.length === 1) return circos[0];

  for (const c of circos) {
    const num: number = parseInt(c.split('-')[1], 10);
    const url_c = `https://assets-decodeurs.lemonde.fr/assets-legacy/pol/legislatives/moteur_circo/geojson/${dep}_${num}.json`;

    try {
      const response = await fetch(url_c);
      const list_poly_c = await response.json();

      for (const poly_dict of list_poly_c.features) {
        const ref: string = poly_dict.properties.REF;
        const poly: Polygon = poly_dict.geometry.coordinates[0];

        if (inside(point, poly)) return ref;
      }
    } catch (error) {
      // Gérer l'erreur de requête
      logError('Erreur lors de la récupération des données:', error);
    }
  }

  return undefined;
}*/

/**
 * Renvoie l'ordinal d'un nombre.
 * @param i Le nombre à convertir en ordinal.
 * @returns L'ordinal du nombre.
 */
export function ordinal(i: number): string {
  if (i === 1) {
    return "1re";
  }
  return `${i}e`;
}

/**
 * Renvoie le code départemental formaté sur 3 caractères.
 * @param x Le code départemental à formater.
 * @returns Le code départemental formaté sur 3 caractères.
 */
export function getCode3Dep(x: number): string {
  const strx: string = x.toString();
  if (strx.length === 3) return strx;
  else return "0" + strx;
}

/**
 * Nettoie une chaîne de caractères en retirant les accents et en remplaçant certains caractères spéciaux.
 * @param input La chaîne de caractères à nettoyer.
 * @returns La chaîne de caractères nettoyée.
 */
export function sanitizeInput(input: string): string {
  const returnValue: string = input
    .toLowerCase()
    .replace(/[àâä]/g, "a")
    .replace(/[æ]/g, "ae")
    .replace(/[ç]/g, "c")
    .replace(/[éèêë]/g, "e")
    .replace(/[îï]/g, "i")
    .replace(/[ô]/g, "o")
    .replace(/[œ]/g, "oe")
    .replace(/[ùûü]/g, "u")
    .replace(/-/g, " ")
    .replace(/'/g, " ");
  return returnValue;
}
