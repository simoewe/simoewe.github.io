# Backend/app.py
"""
Flask-Backend für das Web-Analyse-Tool.

- Liefert die gebaute SPA aus Frontend/public aus
- /analyze: Analysiert hochgeladene Dateien (PDF/DOCX/TXT)
- /healthz: einfacher Healthcheck für Render
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

import os
import io
import base64
import logging
import re
from collections import Counter

# Drittpakete
from PyPDF2 import PdfReader
from docx import Document
from wordcloud import WordCloud
import matplotlib

# Matplotlib headless & Cache-Verzeichnis (schnellerer Start in Containern)
os.environ["MPLCONFIGDIR"] = os.environ.get("MPLCONFIGDIR", "/tmp/matplotlib")
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from textblob import TextBlob  # noqa: E402


# -----------------------------------------------------------------------------
# App-Grundkonfiguration
# -----------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_PUBLIC = os.path.normpath(os.path.join(BASE_DIR, "../Frontend/public"))

app = Flask(
    __name__,
    static_folder=FRONTEND_PUBLIC,         # statische Assets
    template_folder=FRONTEND_PUBLIC,       # index.html liegt hier
    static_url_path="/static",             # nicht die Root blockieren
)

# CORS für lokale Dev & Deployment
CORS(app)

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Upload-Settings
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# -----------------------------------------------------------------------------
# Hilfsfunktionen
# -----------------------------------------------------------------------------
def allowed_file(filename: str) -> bool:
    """Check if the file has an allowed extension."""
    filename = (filename or "").lower()
    return any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)


def get_file_size(file_storage) -> int:
    """Get size of uploaded file without consuming the stream."""
    stream = file_storage.stream
    pos = stream.tell()
    stream.seek(0, os.SEEK_END)
    size = stream.tell()
    stream.seek(pos)
    return size


def extract_text_pdf(file_stream) -> str:
    """Extract text from a PDF file stream."""
    try:
        file_stream.seek(0)
        reader = PdfReader(file_stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text
    except Exception as e:
        logging.error(f"PDF extraction failed: {e}")
        raise


def extract_text_docx(file_stream) -> str:
    """Extract text from a DOCX file stream."""
    try:
        file_stream.seek(0)
        doc = Document(file_stream)
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        logging.error(f"DOCX extraction failed: {e}")
        raise


def extract_text_txt(file_stream) -> str:
    """Extract text from a TXT file stream (UTF-8)."""
    try:
        file_stream.seek(0)
        return file_stream.read().decode("utf-8", errors="ignore")
    except Exception as e:
        logging.error(f"TXT extraction failed: {e}")
        raise


# -----------------------------------------------------------------------------
# Routen – genau eine Root-Route + optionaler SPA-Fallback
# -----------------------------------------------------------------------------
@app.get("/")
def index():
    """Liefert die gebaute index.html unverändert aus."""
    return send_from_directory(app.template_folder, "index.html")


@app.get("/<path:path>")
def spa_fallback(path: str):
    """
    SPA-Fallback:
    - Wenn die angeforderte Datei im Frontend-Ordner existiert: liefere sie aus
    - Sonst: index.html (für Client-Side-Routing wie /dashboard, /settings, …)
    """
    candidate = os.path.join(app.template_folder, path)
    if os.path.isfile(candidate):
        return send_from_directory(app.template_folder, path)
    return send_from_directory(app.template_folder, "index.html")


@app.get("/healthz")
def healthz():
    """Einfacher Healthcheck (nützlich für Render)."""
    return "ok", 200


# -----------------------------------------------------------------------------
# Analyse-Endpoint
# -----------------------------------------------------------------------------
@app.post("/analyze")
def analyze():
    """Analyze uploaded file for buzzword frequencies, word cloud, and extra metrics."""
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file part in the request"}), 400

        file = request.files["file"]
        if not file or file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        filename = (file.filename or "").lower()
        if not allowed_file(filename):
            return jsonify({"error": "Unsupported file type"}), 400

        if get_file_size(file) > MAX_FILE_SIZE:
            return jsonify({"error": "File too large (max 5MB)"}), 400

        # Buzzwords
        buzzwords_raw = request.form.get("buzzwords", "")
        buzzwords = [w.strip().lower() for w in buzzwords_raw.split(",") if w.strip()]
        if not buzzwords:
            return jsonify({"error": "No buzzwords provided"}), 400

        # Text extrahieren
        ext = os.path.splitext(filename)[1]
        if ext == ".pdf":
            text = extract_text_pdf(file.stream)
        elif ext == ".docx":
            text = extract_text_docx(file.stream)
        elif ext == ".txt":
            text = extract_text_txt(file.stream)
        else:
            return jsonify({"error": "Unsupported file type"}), 400

        text_lower = text.lower()
        words = [w.strip(".,!?;:()[]{}\"'“”‘’\n\t\r") for w in text_lower.split()]
        words = [w for w in words if w]  # leere raus
        total_words = len(words)

        # Frequenzen & Dichte
        freq = {w: words.count(w) for w in buzzwords}
        density = {
            w: round((freq[w] / total_words) * 100, 2) if total_words > 0 else 0 for w in buzzwords
        }

        # KWIC (Keyword in Context)
        kwic_results = {}
        window = 5
        for bw in buzzwords:
            snippets = []
            for i, word in enumerate(words):
                if word == bw:
                    left = " ".join(words[max(0, i - window) : i])
                    right = " ".join(words[i + 1 : i + 1 + window])
                    snippets.append(f"... {left} {word} {right} ...")
            kwic_results[bw] = snippets[:3]  # max 3 Beispiele je Buzzword

        # Kollokationen
        collocations = {}
        for bw in buzzwords:
            left_neighbors, right_neighbors = [], []
            for i, word in enumerate(words):
                if word == bw:
                    if i > 0:
                        left_neighbors.append(words[i - 1])
                    if i < len(words) - 1:
                        right_neighbors.append(words[i + 1])
            left_counts = Counter(left_neighbors).most_common(3)
            right_counts = Counter(right_neighbors).most_common(3)
            collocations[bw] = {"left": left_counts, "right": right_counts}

        # Safeguard: keine Buzzwords gefunden
        if all(v == 0 for v in freq.values()):
            return jsonify({"error": "No buzzwords found in text"}), 400

        # Sentiment (TextBlob)
        blob = TextBlob(text)
        sentiment = {
            "polarity": blob.sentiment.polarity,
            "subjectivity": blob.sentiment.subjectivity,
        }

        # Readability (vereinfachter Flesch Reading Ease)
        sentences = re.split(r"[.!?]+", text)
        num_sentences = len([s for s in sentences if s.strip()])
        num_words = total_words
        # sehr einfache Silben-Heuristik
        num_syllables = sum(max(1, len(re.findall(r"[aeiouy]+", w))) for w in words)

        if num_sentences > 0 and num_words > 0:
            asl = num_words / num_sentences  # avg sentence length
            asw = num_syllables / num_words  # avg syllables per word
            flesch_score = round(206.835 - 1.015 * asl - 84.6 * asw, 2)
        else:
            flesch_score = None

        readability = {
            "flesch_reading_ease": flesch_score,
            "total_words": num_words,
            "total_sentences": num_sentences,
        }

        # Technologietrends (einfache Stichwortsuche mit Kontext)
        trends = [
            "Artificial Intelligence",
            "Blockchain",
            "Big Data Analytics",
            "Internet of Things",
            "Digital Twin",
            "5G Network",
            "Robotics",
            "Autonomous Systems",
            "Virtual Reality",
            "Augmented Reality",
            "Cloud Computing",
            "Edge Computing",
            "Fog Computing",
        ]
        trend_results = []
        sent_split = re.split(r"(?<=[.!?])\s+", text)
        text_lc = text.lower()
        for trend in trends:
            t_lc = trend.lower()
            count = text_lc.count(t_lc)
            if count > 0:
                context_sentences = [s.strip() for s in sent_split if t_lc in s.lower()][:3]
                trend_results.append({"trend": trend, "count": count, "contexts": context_sentences})

        # Wordcloud
        try:
            wc = WordCloud(width=800, height=400, background_color="white")
            wc.generate_from_frequencies(freq)
            img_io = io.BytesIO()
            plt.figure(figsize=(10, 5))
            plt.imshow(wc, interpolation="bilinear")
            plt.axis("off")
            plt.tight_layout(pad=0)
            plt.savefig(img_io, format="PNG")
            plt.close()
            img_io.seek(0)
            img_base64 = base64.b64encode(img_io.getvalue()).decode("utf-8")
            img_data_url = f"data:image/png;base64,{img_base64}"
        except Exception as e:
            logging.error(f"Word cloud generation failed: {e}")
            return jsonify({"error": "Word cloud generation failed"}), 500

        logging.info(f"File '{filename}' analyzed successfully.")
        return jsonify(
            {
                "frequencies": freq,
                "densities": density,
                "kwic": kwic_results,
                "collocations": collocations,
                "image": img_data_url,
                "sentiment": sentiment,
                "readability": readability,
                "trends": trend_results,
            }
        )

    except Exception as e:
        logging.exception(f"Analysis failed: {e}")
        return jsonify({"error": "Internal server error"}), 500


# -----------------------------------------------------------------------------
# Lokaler Start (Gunicorn nutzt nur das 'app'-Objekt)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
