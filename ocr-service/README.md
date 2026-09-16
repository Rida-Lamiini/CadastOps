# ocr-service

FastAPI microservice wrapping the official [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)
pipeline (onnxruntime inference engine, CPU, French model). Called by the
Next.js app's PDF ingestion pipeline (`src/lib/pdf/extract.ts`) over HTTP —
there's no official PaddleOCR runtime for Node, so this can't run
in-process the way the earlier Tesseract.js setup did.

## Run it

Via Docker Compose (from the repo root):

```bash
docker compose up -d ocr
```

For local iteration without rebuilding the image each time:

```bash
python -m venv .venv
./.venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Model weights (PP-OCRv6, ONNX variant) download on the first `/ocr` request
and get cached under `~/.paddlex/official_models/` — that first request
will be noticeably slower than the rest.

## API

- `GET /health` → `{"status": "ok"}`
- `POST /ocr` (multipart form, field `file`: a PNG page image) →
  ```json
  {
    "text": "row-grouped plain text, one table row per line",
    "lines": [{ "text": "...", "confidence": 0.98, "box": [x1, y1, x2, y2] }]
  }
  ```

PaddleOCR's detection model returns one entry per detected text region —
each table cell is its own entry, not a full row. `reconstruct_text()` in
`main.py` rebuilds row-grouped text by clustering entries whose bounding
boxes are vertically close together (tuned against this app's real ANCFCC
sample) and joining each cluster left-to-right with spaces. This is what
lets the Node-side line parser (`X <space> borne-name <space> Y` per line,
`src/lib/pdf/parse-bornes.ts`) keep working unchanged against PaddleOCR
output the same way it did against Tesseract's own line reconstruction.
