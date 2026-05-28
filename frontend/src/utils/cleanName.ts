/**
 * Fixes UTF-8 double-encoding artifacts in doctor names from ChromaDB.
 * Non-breaking spaces ( ) encoded as UTF-8 (\xc2\xa0) get misread
 * as Latin-1, producing "Â " sequences. This cleans them out.
 */
export function cleanDoctorName(name: string): string {
  if (!name) return name;
  return name
    .replace(/Â /g, " ")   // \xc2\xa0 misread as Â + nbsp
    .replace(/Â /g, " ")         // \xc2\xa0 misread as Â + space
    .replace(/ /g, " ")     // raw non-breaking space
    .replace(/​/g, "")      // zero-width space
    .replace(/\s+/g, " ")        // collapse multiple spaces
    .trim();
}
