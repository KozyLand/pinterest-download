import type { PinItem } from "../types.js";

/**
 * Déduplique une liste de pins :
 * 1. par pinId (un même pin ne doit apparaître qu'une fois, notamment quand il
 *    est renvoyé à la fois par l'endpoint "pins du tableau" et par une section) ;
 * 2. par URL d'image résolue (deux pins différents qui pointent vers exactement
 *    la même image sont considérés comme des doublons visuels).
 */
export function dedupeItems(items: PinItem[]): { unique: PinItem[]; duplicatesSkipped: number } {
  const seenPinIds = new Set<string>();
  const seenImageUrls = new Set<string>();
  const unique: PinItem[] = [];
  let duplicatesSkipped = 0;

  for (const item of items) {
    if (seenPinIds.has(item.pinId) || seenImageUrls.has(item.imageUrl)) {
      duplicatesSkipped += 1;
      continue;
    }
    seenPinIds.add(item.pinId);
    seenImageUrls.add(item.imageUrl);
    unique.push(item);
  }

  return { unique, duplicatesSkipped };
}
