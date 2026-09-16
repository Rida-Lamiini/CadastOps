# CadastOps

Internal tool for storing cadastral lots ("Calcul de Contenances" documents,
ANCFCC/Morocco), verifying surface/distance calculations against the
underlying borne coordinates, and browsing them on a map. No authentication.

## Stack

Next.js (App Router) · PostgreSQL + PostGIS · Prisma · MapLibre GL JS
(OpenFreeMap + Esri World Imagery) · proj4js (Lambert Nord Maroc → WGS84) ·
Turf.js · pdf-parse + PaddleOCR (official, onnxruntime engine, run as a
separate Python microservice — primary extraction path, not a fallback, see
Notes) · Playwright (PDF export).

## Local development

```bash
docker compose up -d db ocr      # PostGIS 16 + the PaddleOCR service
npx prisma migrate dev           # create tables
npm run db:seed                  # seed Lot 533 (Titre 49539)
npx playwright install chromium  # needed once, for PDF export
npm run dev
```

Open http://localhost:3000 — redirects to `/lots`.

`DATABASE_URL` and `OCR_SERVICE_URL` are read from `.env` (already pointed
at the compose `db`/`ocr` services on `localhost:5432`/`localhost:8000`).

The `ocr` service downloads its ONNX model weights on first request and
caches them in the container — the first PDF upload after a fresh
`docker compose up` will be noticeably slower than subsequent ones.

## Structure

- `src/lib/geo/` — Lambert Nord Maroc (EPSG:26191) ⇄ WGS84 conversion
  (`proj.ts`), planar shoelace area/perimeter + geodesic distance/bearing +
  per-vertex area-sensitivity (`calculations.ts`), and the single
  geometry-build pipeline shared by manual entry and PDF review
  (`build-lot.ts`).
- `src/lib/pdf/` — PDF text-layer extraction with an OCR path for scanned
  documents (`extract.ts`, 300 DPI rasterization + a call to the `ocr-service`
  microservice), and the regex parser + outlier/distance/confidence
  flagging tuned to the ANCFCC layout (`parse-bornes.ts`).
- `ocr-service/` — standalone Python/FastAPI microservice wrapping the
  official PaddleOCR pipeline (onnxruntime inference engine, CPU, French
  model). Own Dockerfile; run via `docker compose up -d ocr` or directly
  with `uvicorn main:app` from a `pip install -r requirements.txt`
  virtualenv for local iteration. See `ocr-service/main.py` for why it
  reconstructs table rows from PaddleOCR's per-cell detections itself
  (row-grouping by Y-position) rather than returning raw per-cell output.
- `src/lib/db/` — Prisma client, raw-SQL helpers for the PostGIS
  `geometry(...)` columns (which Prisma models as `Unsupported`), and lot
  read/write queries.
- `src/components/map/` — MapLibre wrappers (`LotMap`, `OverviewMap`,
  basemap toggle between OpenFreeMap Liberty and Esri World Imagery).
- `src/components/lots/` — verification panel, editable borne/distance/
  reference-point tables, PDF upload panel.

## Notes

- `docker-compose.yml` uses `postgis/postgis:16-3.4-alpine` rather than the
  `-alpine`-less tag — this dev machine's Docker Desktop had a corrupted
  containerd snapshot on the Debian-based layer; the Alpine image sidesteps
  it. Either works against Postgres/PostGIS itself.
- PDF page rendering for OCR uses `pdf-parse`'s own `getScreenshot()`
  (it already wraps `pdfjs-dist` internally), so `pdfjs-dist` isn't a
  direct dependency despite being mentioned in the original spec. It's
  called with `scale: 300/72` for real 300 DPI output, not the ~1x default.
- ANCFCC "Calcul de Contenances" scans are almost always image-only PDFs
  with no text layer at all — OCR is the primary path for this document
  type in practice, triggered whenever the PDF's own text layer has fewer
  than 50 non-whitespace characters (an empty text layer is the normal
  case here, not an error).
- OCR moved from Tesseract.js (in-process) to official PaddleOCR (a
  separate Python service, `ocr-service/`) partway through this project.
  There's no official PaddleOCR runtime for Node, so it can't run
  in-process the way Tesseract did — the Next.js app rasterizes the PDF
  page and posts the PNG over HTTP; `extract.ts` fails loudly (with a
  clear error naming the unreachable URL) rather than silently degrading
  if the service is down. The swap was a large, measured accuracy win on
  this project's real test document: Tesseract misread 2 of 9 borne
  coordinates and 3 of 9 borne names; PaddleOCR read all 9 rows correctly.
- Parsed bornes get outlier-flagged (median absolute deviation on X/Y,
  borne-name format check, computed-vs-sketch distance from the first
  borne when enough sketch labels OCR cleanly, low OCR confidence on any
  of a row's three values) rather than trusted outright — flagged rows
  render in red in the manual-entry table on `/lots/new` and clear once
  edited. None of these catch everything on their own (a misread digit the
  OCR is confident about looks correct to the confidence check; a small
  enough coordinate error can dodge the outlier check) — see the review
  page's live surface-recompute-vs-document-S cross-check and area
  sensitivity indicator for a check that doesn't depend on any individual
  borne being flagged. `titreFoncier` is always shown as needing manual
  confirmation after a PDF import, since it's typically handwritten on the
  source document.
