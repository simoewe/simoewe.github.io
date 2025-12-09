# Trendalyze – Document Analysis for Trend and Sustainability Topics

Trendalyze combines a React frontend with a Flask backend to quickly scan PDF, DOCX, and TXT documents for technology and sustainability signals. The tool extracts text, applies optional word/page budgets, detects keywords, produces KWIC/context snippets, calculates sentiment and readability scores, and classifies trend technologies by usage status. Deployments run on Render; the code is managed on GitHub.


## Key capabilities
- Document upload (PDF, DOCX, TXT) with configurable word and page budgets to keep large analyses stable.
- Document library (OCI Object Storage) gated by an access code, with recursive multi-file selection.
- Analysis results: frequencies/densities, KWIC snippets with page references, left/right collocations, word cloud (when the term count is moderate), sentiment (TextBlob), Flesch readability, trend status (using / evaluating / discontinued).
- Trend insights and processing summary (sampling, word budget, page selection) for traceability.
- PDF viewer with a tab per document, drag & drop, upload status, remove/switch documents.
- Footer modals for About/Terms/Legal/Contact, including the repo link and a PR invitation.


## Architecture
- **Frontend:** React (Create React App), React 19, react-resizable-panels, react-pdf, react-dropzone.
- **Backend:** Flask + flask-cors, TextBlob, spaCy (en_core_web_sm), PyMuPDF/PyPDF2/pdfminer for extraction, WordCloud/Matplotlib, boto3 for OCI-S3.
- **Deployment:** Render (static site for the frontend, Python Web Service for the backend); `render.yaml` holds the build/start commands.


## Project structure
- `frontend/` – React app, build scripts, styles, and components (Header, Library, PdfViewer, modals, etc.).
- `Backend/` – Flask app, analysis pipeline, extraction and trend logic.
  - `app.py` – API routes (`/analyze`, `/search`, `/library`, `/settings/word-limit`, `/verify-visibility-code`, `/health`).
  - `analysis_service.py` – Keyword matching, KWIC, collocations, sentiment, readability, trend status, word cloud.
  - `document_processing.py` – PDF/DOCX/TXT extraction, page sampling, PDF optimization (image strip), limits.
  - `constants.py` – Allowed types, limits, trend keywords/status patterns, default word budget.
  - `trend_analysis.py`, `keyword_utils.py`, `sampling_utils.py` – Helpers for trends, regex building, sampling.
  - `requirements.txt` – Python dependencies including the spaCy model.
- `app.py` (repo root) – WSGI entrypoint for Render (`from backend.app import app`).
- `render.yaml` – Render services (backend/frontend) with environment variables.


## Local development

### Prerequisites
- Python 3.10+
- Node 18+ / npm

### Run the backend
```bash
cd Backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install --upgrade pip
pip install -r requirements.txt
python -m spacy download en_core_web_sm

# Example variables (adjust as needed)
export MAX_PDF_PAGES=500
export MAX_WORDS_ANALYSIS=120000   # None/<=0 disables the word budget
export VISIBILITY_CODE=changeme    # Optional: access code for the library
# For the OCI library (optional, otherwise returns an empty list)
# export OCI_REGION=...
# export OCI_NAMESPACE=...
# export OCI_S3_ACCESS_KEY=...
# export OCI_S3_SECRET_KEY=...
# export OCI_BUCKET=...
# export PAR_BASE_URL=...

FLASK_APP=app.py flask run --port 5000
# or: gunicorn app:app --timeout 600 --graceful-timeout 630 --max-requests 20
```

### Run the frontend
```bash
cd frontend
npm install
# Set backend URL (default: /, or e.g. http://localhost:5000)
export REACT_APP_API_URL=http://localhost:5000
npm start
```

### Build
```bash
cd frontend
npm run build
```


## API overview (backend)
- `GET /health` – Status and count of uploaded documents.
- `POST /analyze` – Multipart upload (`file`, `buzzwords`, optional `wordBudgetMode=disabled`). Returns frequencies, KWIC, collocations, sentiment, readability, trend insights, word cloud (base64), page map, sampling/word-budget summary.
- `POST /search` – `{ "keywords": "foo, bar" }`; searches uploaded documents, otherwise falls back to container-logistics examples.
- `GET/POST /settings/word-limit` – Inspect/update the word budget (`{ "limit": <int|null>, "disabled": true }` or `{ "useDefault": true }`).
- `POST /verify-visibility-code` – `{ "code": "<string>" }`; unlocks the library in the frontend.
- `GET /library` – Lists PDF files from the OCI bucket (requires `OCI_*` and `PAR_BASE_URL`).


## Deployment (Render)
- Backend: Python Web Service (`rootDir: Backend`, build installs requirements + spaCy model, start `gunicorn app:app`).
- Frontend: Static Site (`rootDir: frontend`, build `npm install && npm run build`, `publishPath: build`).
- Example API URL in the frontend: `https://trendalyze-services.onrender.com`.


## Usage & license
The project is intended for research and teaching within the master project (University of Hamburg, Information Systems). Commercial use is excluded. Pull requests with improvements are welcome — we review every contribution.
