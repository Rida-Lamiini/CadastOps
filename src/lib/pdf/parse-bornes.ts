import { planarDistanceM } from "../geo/calculations";

/**
 * Parser tuned to the ANCFCC "Calcul de Contenances" layout. These
 * documents are almost always scanned image PDFs (no text layer), so this
 * runs against OCR output as often as it runs against a real text layer —
 * it has to tolerate misread characters, scrambled column spacing, and
 * OCR'd French diacritics, not just clean text. It never assumes a parsed
 * value is correct: bornes get outlier-checked on X/Y (checkBorneOutliers)
 * and cross-checked against the sketch's radiating distances from the
 * first borne when those OCR cleanly (checkDistancesFromReference), and
 * the caller always surfaces titreFoncier for manual confirmation, since
 * it's typically handwritten on the source document.
 */

export interface ParsedHeader {
  proprieteDite: string | null;
  natureAffaire: string | null;
  titreFoncier: string | null;
  lot: string | null;
  systeme: string | null;
  surfaceCalculee_m2: number | null;
  correctionLambert_m2: number | null;
  surfaceCorrigee_m2: number | null;
  contenanceAdoptee_m2: number | null;
  date: string | null;
  geometre: string | null;
}

export interface ParsedBorne {
  name: string;
  sequence: number;
  x: number;
  y: number;
  flagged: boolean;
  flagReason?: string;
}

export interface ParsedDocument {
  header: ParsedHeader;
  bornes: ParsedBorne[];
}

/**
 * French-format decimal: comma separator, optional space as thousands
 * separator. Deliberately [ \t] and not \s — \s matches newlines, which let
 * a number bleed across a line break and concatenate with trailing digits
 * from the previous row (e.g. "...P 56" + "\n300602,65..." parsing as one
 * bogus "56300602,65" number).
 */
const NUMBER = String.raw`\d{1,3}(?:[ \t]?\d{3})*,\d{2,4}`;
/**
 * Loose borne token: any single alnum lead char (OCR often misreads "B"),
 * 3-5 digits, an optional single stray character (OCR noise — e.g. "B345t
 * bis"), then optional bis/ter. The stray-char allowance means garbled
 * suffixes still get captured (and then fail STRICT_BORNE_NAME and get
 * flagged) instead of silently vanishing from the output entirely.
 */
const BORNE_TOKEN = String.raw`[A-Za-z0-9]\d{3,5}[A-Za-z]?(?:bis|ter)?`;
const STRICT_BORNE_NAME = /^B\d{3,5}(?:bis|ter)?$/i;

export function parseFrenchNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s ]/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Strips trailing OCR noise (stray table-border pipes etc.) that a greedy [^\n]+ capture picks up. */
function cleanValue(raw: string): string {
  return raw.trim().replace(/[\s|_~`]+$/, "").trim();
}

function matchFirst(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const cleaned = cleanValue(match[1]);
  return cleaned || null;
}

/** Parses a "1 ha 04 a 98,5310 ca" style value (or a plain m² number) into total m². */
function parseSurfaceValue(raw: string): number | null {
  const ha = raw.match(/(\d+)\s*ha/i);
  const a = raw.match(/(\d+)\s*a\b/i);
  // Tesseract used to emit "?" for a character it couldn't read with any confidence at all —
  // kept defensively (harmless no-op if the current OCR engine never produces it) so a single
  // uncertain trailing digit doesn't lose the whole value; treated as 0, a few-cm² imprecision
  // that's negligible next to what's gained: this value still feeds the correction-Lambert
  // cross-check below.
  const ca = raw.match(/([\d\s]+(?:[.,][\d?]+)?)\s*ca/i);
  if (ha || a || ca) {
    const haVal = ha ? Number(ha[1]) : 0;
    const aVal = a ? Number(a[1]) : 0;
    const caVal = ca ? (parseFrenchNumber(ca[1].trim().replace(/\?/g, "0")) ?? 0) : 0;
    return haVal * 10000 + aVal * 100 + caVal;
  }
  // Fall back to a plain "10 506,00" / "10506.00 m2" style number.
  const plainMatch = raw.match(new RegExp(NUMBER));
  return plainMatch ? parseFrenchNumber(plainMatch[0]) : null;
}

function matchSurfaceLabel(text: string, labelPattern: string): number | null {
  // Separator is optional and unconstrained, not required to be ":"/"=" — different OCR
  // engines misread the "=" sign as different stray characters (seen for real: Tesseract
  // dropped it silently, PaddleOCR read it as "二"), or a reconstructed line may drop it
  // entirely (a stray reference-number token sitting where "=" was). parseSurfaceValue finds
  // the actual ha/a/ca or plain-number pattern anywhere in the captured tail regardless.
  const match = text.match(new RegExp(`${labelPattern}\\s*[^\\n\\d]*([^\\n]+)`, "i"));
  return match ? parseSurfaceValue(match[1]) : null;
}

const FRENCH_MONTHS =
  "janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre";

function parseHeader(text: string): ParsedHeader {
  const proprieteDite = matchFirst(text, /propr?i?[ée]t?[ée]\s+dite\s*:?\s*([^\n]+)/i);
  const natureAffaire = matchFirst(text, /nature\s+de\s+l['’]?affaire\s*:?\s*([^\n]+)/i);
  // Titre is typically handwritten — always surfaced for manual confirmation by the caller
  // regardless of whether this matches, so a loose match here is fine (better a wrong guess
  // to correct than nothing to start from). "titre" -> "tire" covers the OCR dropping the
  // middle "t" (Tesseract) or vowels swapped into "Taure" (PaddleOCR) — different engines
  // mangle this specific word differently, and it's handwritten on the source document in the
  // first place, so chasing every OCR variant of "titre" itself is a losing game. More robust:
  // anchor on "Réquisition", the stable printed label directly above/before it, and take
  // whatever digit run follows — regardless of what garbled word sits in between.
  const titreFoncier =
    matchFirst(text, /tit?re\s*(?:foncier)?\s*(?:n[°o]?)?\s*:?\s*(\S+)/i) ??
    matchFirst(text, /r[ée]qu?isition\s*:?\s*[^\n\d]*(\d{4,6})/i);
  const lot = matchFirst(text, /\blot\s*(?:n[°o]?)?\s*:?\s*(\d+)/i);
  const systeme = matchFirst(text, /syst[eè]me\s*:?\s*(\S+)/i);
  // Month/year separator seen as both a space and a hyphen ("Novembre-2005") on real scans.
  const date = matchFirst(text, new RegExp(`((?:${FRENCH_MONTHS})[-\\s]+\\d{4})`, "i"));

  // "S =" is a single generic letter, frequently misread outright (e.g. "S" -> "8"), and the
  // "=" itself gets misread into all sorts of things (seen for real: PaddleOCR read it as "二").
  // Tolerate common confusables for the letter and don't require any particular separator,
  // anchored to line start so it doesn't match a stray "s" anywhere else in the text.
  const surfaceCalculeeMatch = text.match(/(?:^|\n)\s*[S8$]\b\s*([^\n]+)/i);
  const surfaceCalculee_m2 = surfaceCalculeeMatch ? parseSurfaceValue(surfaceCalculeeMatch[1]) : null;

  // The signatory (géomètre/cabinet) is often its own unlabeled line right after the date, not
  // behind a "Géomètre:" label — prefer that when a date was found, falling back to a label
  // search otherwise.
  let geometre = matchFirst(text, /(?:g[ée]om[èe]tre|cabinet)\s*:?\s*([^\n]+)/i);
  if (date) {
    const dateIndex = text.toLowerCase().indexOf(date.toLowerCase());
    if (dateIndex >= 0) {
      const after = text.slice(dateIndex + date.length).split("\n");
      const nextLine = after.map((l) => cleanValue(l)).find((l) => l.length > 3);
      if (nextLine) geometre = nextLine;
    }
  }

  const surfaceCorrigee_m2 = matchSurfaceLabel(text, "SURFACE\\s+CORRIG[EÉ]E");
  const parsedCorrection = matchSurfaceLabel(text, "CORRECTION\\s+LAMBERT");

  // "Correction Lambert" is usually a small value (a few m²) buried in a single OCR'd ha/a/ca
  // triplet — the most fragile of the three surface figures in practice (confirmed against a
  // real scan: "00 a" misread as "06 a", corrupting 7.75 m² into 607.75 m²). S and Surface
  // corrigée are independently parsed and S + correction = surface corrigée by construction, so
  // when we have both of those and the parsed correction doesn't reconcile, the arithmetic
  // cross-check is more trustworthy than the single fragile label match.
  let correctionLambert_m2 = parsedCorrection;
  if (surfaceCalculee_m2 !== null && surfaceCorrigee_m2 !== null) {
    const crossCheck = Math.round((surfaceCorrigee_m2 - surfaceCalculee_m2) * 10000) / 10000;
    if (parsedCorrection === null || Math.abs(parsedCorrection - crossCheck) > 1) {
      correctionLambert_m2 = crossCheck;
    }
  }

  return {
    proprieteDite,
    natureAffaire,
    titreFoncier,
    lot,
    systeme,
    surfaceCalculee_m2,
    correctionLambert_m2,
    surfaceCorrigee_m2,
    contenanceAdoptee_m2: matchSurfaceLabel(text, "CONTENANCE\\s+ADOPT[EÉ]E"),
    date,
    geometre,
  };
}

// [ \t]+ between captures, not \s+ — keeps a row's X/borne/Y from matching across a line break.
const BORNE_LINE = new RegExp(`(${NUMBER})[ \\t]+(${BORNE_TOKEN})[ \\t]+(${NUMBER})`, "gi");

/**
 * Below this, the OCR engine itself is telling us it wasn't sure what it
 * read — a different kind of signal than the geometric checks
 * (character-level uncertainty vs. downstream arithmetic consequences), so
 * it catches different mistakes. Originally calibrated against a Tesseract
 * scan of this document (the two rows already flagged by name-format sat
 * at confidences 19 and 60; correct values were reliably in the high
 * 70s-90s) — kept as the threshold after moving to PaddleOCR (ocr-service/,
 * see extract.ts), which reports confidence on the same 0-100 scale and,
 * on the same document, put every genuinely correct value above 90. It
 * will NOT catch every wrong value on any engine — a misread digit the OCR
 * is confident about (seen for real with Tesseract: "9"->"6" at 87%
 * confidence) looks exactly like a correct one by this measure alone.
 */
const LOW_CONFIDENCE_THRESHOLD = 70;

function checkTokenConfidence(
  wordConfidence: Map<string, number>,
  tokens: Array<{ label: string; text: string }>,
  threshold: number,
): string | null {
  for (const { label, text } of tokens) {
    const confidence = wordConfidence.get(text.trim());
    if (confidence !== undefined && confidence < threshold) {
      return `Confiance OCR faible sur la valeur ${label} ("${text}", confiance ${confidence}%) — vérifiez contre le document.`;
    }
  }
  return null;
}

function parseBorneRows(text: string, wordConfidence?: Map<string, number>): ParsedBorne[] {
  const bornes: ParsedBorne[] = [];
  let sequence = 0;
  for (const match of text.matchAll(BORNE_LINE)) {
    const x = parseFrenchNumber(match[1]);
    const y = parseFrenchNumber(match[3]);
    if (x === null || y === null) continue;
    const name = match[2];
    const borne: ParsedBorne = { name, sequence: sequence++, x, y, flagged: false };
    if (!STRICT_BORNE_NAME.test(name)) {
      borne.flagged = true;
      borne.flagReason = `Nom de borne suspect (lecture OCR) : "${name}"`;
    } else if (wordConfidence) {
      const reason = checkTokenConfidence(
        wordConfidence,
        [
          { label: "X", text: match[1] },
          { label: "nom", text: match[2] },
          { label: "Y", text: match[3] },
        ],
        LOW_CONFIDENCE_THRESHOLD,
      );
      if (reason) {
        borne.flagged = true;
        borne.flagReason = reason;
      }
    }
    bornes.push(borne);
  }
  return bornes;
}

function median(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const OUTLIER_FACTOR = 50;
const MIN_SPREAD_M = 0.5; // floor so a tight cluster of legitimately-close values doesn't over-flag

/**
 * Flags bornes whose X or Y deviates from the median by more than
 * OUTLIER_FACTOR times the median absolute deviation of the others —
 * catches OCR digit-insertion errors (e.g. 313952,15 misread as
 * 3193952,15, off by ~10x) without needing a hard-coded valid range.
 */
function checkBorneOutliers(bornes: ParsedBorne[]): void {
  if (bornes.length < 3) return;

  const xs = bornes.map((b) => b.x);
  const ys = bornes.map((b) => b.y);
  const medX = median(xs);
  const medY = median(ys);
  const madX = Math.max(median(xs.map((x) => Math.abs(x - medX))), MIN_SPREAD_M);
  const madY = Math.max(median(ys.map((y) => Math.abs(y - medY))), MIN_SPREAD_M);

  for (const borne of bornes) {
    const devX = Math.abs(borne.x - medX);
    const devY = Math.abs(borne.y - medY);
    if (devX > OUTLIER_FACTOR * madX) {
      borne.flagged = true;
      borne.flagReason = `X = ${borne.x} très éloigné de la médiane des autres bornes — vérifiez un chiffre inséré/mal lu par l'OCR.`;
    } else if (devY > OUTLIER_FACTOR * madY) {
      borne.flagged = true;
      borne.flagReason = `Y = ${borne.y} très éloigné de la médiane des autres bornes — vérifiez un chiffre inséré/mal lu par l'OCR.`;
    }
  }
}

/**
 * These documents sketch a fan of straight-line distances from the first
 * borne to each other borne (e.g. "156.1", "165.2", "164.1" ... — see the
 * diagram below the table), each labeled in meters along the line. Those
 * labels are OCR gold when they come through: they're an independent
 * measurement of each borne's position relative to the first, so a borne
 * whose *computed* distance from the first borne doesn't match any sketch
 * label is suspect even when its X/Y are individually unremarkable (no
 * single-axis outlier, but wrong all the same — median/MAD on X/Y alone
 * can miss this). How much of the diagram actually comes through depends
 * heavily on the OCR engine — Tesseract recovered 2 of 6 real sketch
 * labels on this document's diagram (the rest lost to its rotated,
 * hand-placed text), PaddleOCR recovered all 6 — so this only adds flags
 * when there's enough coverage to trust the pairing (see
 * MIN_CANDIDATE_COVERAGE); on a page where too little came through
 * cleanly, it's a no-op, never a false accusation.
 */
const DISTANCE_CANDIDATE = /\b\d{1,3}[.,]\d{1,2}\b/g;
const DISTANCE_TOLERANCE_FACTOR = 0.05; // 5%
const DISTANCE_TOLERANCE_MIN_M = 2;
// A diagram can contain numbers that aren't "distance from the first borne" at all — a
// cross-diagonal between two other bornes, a scale marking, OCR noise — and with decent
// candidate coverage the greedy matcher will still force one of these onto whichever borne
// has no better option left, even though it's a bad fit in absolute terms (confirmed against
// a real scan: a stray "46.5" got assigned to a borne whose real distance was 65.0 m — 28%
// off — purely because it was the least-bad leftover). Past this diff, don't trust the pairing
// enough to assert a mismatch at all; leave that borne unassessed by this check instead.
const MAX_PLAUSIBLE_PAIRING_DIFF_M = 12;
const MAX_PLAUSIBLE_PAIRING_FACTOR = 0.2; // 20%

/** Numbers left over once the borne table rows themselves are stripped out — candidate sketch distances. */
function extractDistanceCandidates(text: string): number[] {
  const withoutBorneRows = text.replace(BORNE_LINE, " ");
  const candidates: number[] = [];
  for (const match of withoutBorneRows.matchAll(DISTANCE_CANDIDATE)) {
    const value = parseFrenchNumber(match[0]);
    if (value !== null && value > 1 && value < 2000) candidates.push(value);
  }
  return candidates;
}

/**
 * Pairs each borne's computed distance-from-the-first-borne with a
 * candidate sketch distance and flags a borne whose paired match is still
 * outside tolerance. Assignment is global smallest-difference-first
 * (across every borne/candidate pair, not processed in table order) —
 * with only a handful of candidates usually recovered, matching bornes in
 * table order would let an early borne grab a candidate that actually
 * belongs to a later one, misassigning the whole rest of the list. Only
 * adds a flag to a borne that isn't already flagged, so it complements
 * checkBorneOutliers rather than overriding its (more specific) reason.
 */
// Below this fraction of recovered labels, a greedy match starts forcing bornes onto
// leftover candidates that don't actually belong to them (confirmed against a real scan: with
// only 2/8 sketch distances recovered, a genuinely correct borne got paired with someone else's
// mismatched label and false-flagged). Below the threshold this check sits out entirely rather
// than risk a wrong accusation.
const MIN_CANDIDATE_COVERAGE = 0.6;

function checkDistancesFromReference(bornes: ParsedBorne[], candidates: number[]): void {
  if (bornes.length < 2 || candidates.length === 0) return;

  const reference = bornes[0];
  // A borne already flagged (e.g. by checkBorneOutliers) has a known-unreliable computed
  // distance — letting it compete for a candidate match can steal the right pairing away from
  // an otherwise-clean borne and produce a false positive on *that* one instead.
  const others = bornes
    .slice(1)
    .filter((borne) => !borne.flagged)
    .map((borne) => ({ borne, computed: planarDistanceM({ x: reference.x, y: reference.y }, { x: borne.x, y: borne.y }) }));

  if (others.length === 0 || candidates.length < others.length * MIN_CANDIDATE_COVERAGE) return;

  const pairs: Array<{ otherIndex: number; candidateIndex: number; diff: number }> = [];
  others.forEach((o, otherIndex) => {
    candidates.forEach((c, candidateIndex) => {
      pairs.push({ otherIndex, candidateIndex, diff: Math.abs(o.computed - c) });
    });
  });
  pairs.sort((a, b) => a.diff - b.diff);

  const usedOther = new Set<number>();
  const usedCandidate = new Set<number>();
  for (const { otherIndex, candidateIndex, diff } of pairs) {
    if (usedOther.has(otherIndex) || usedCandidate.has(candidateIndex)) continue;

    const { borne, computed } = others[otherIndex];
    const matched = candidates[candidateIndex];

    // Not a trustworthy pairing either way — leave both borne and candidate free rather than
    // consuming them, so each still gets a chance to pair with something else below.
    const plausibilityCap = Math.max(MAX_PLAUSIBLE_PAIRING_DIFF_M, matched * MAX_PLAUSIBLE_PAIRING_FACTOR);
    if (diff > plausibilityCap) continue;

    usedOther.add(otherIndex);
    usedCandidate.add(candidateIndex);

    const tolerance = Math.max(DISTANCE_TOLERANCE_MIN_M, matched * DISTANCE_TOLERANCE_FACTOR);
    if (diff > tolerance && !borne.flagged) {
      borne.flagged = true;
      borne.flagReason =
        `Distance depuis ${reference.name} (${computed.toFixed(1)} m calculés) ne correspond à ` +
        `aucune cote du croquis (plus proche : ${matched} m, écart ${diff.toFixed(1)} m) — vérifiez les coordonnées.`;
    }
  }
}

/**
 * @param wordConfidence OCR engine's per-line/word confidence (0-100), keyed by exact text —
 *   only available for the OCR path, not the PDF text-layer path (which has no comparable
 *   per-token confidence signal). See checkTokenConfidence.
 */
export function parseCalculDeContenances(text: string, wordConfidence?: Map<string, number>): ParsedDocument {
  const header = parseHeader(text);
  const bornes = parseBorneRows(text, wordConfidence);
  checkBorneOutliers(bornes);
  checkDistancesFromReference(bornes, extractDistanceCandidates(text));
  return { header, bornes };
}
