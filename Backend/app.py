import base64, io, logging, os
from flask import Flask, request, jsonify
from flask_cors import CORS
import matplotlib
matplotlib.use(os.environ.get("MPLBACKEND", "Agg"))  # headless
import matplotlib.pyplot as plt
from wordcloud import WordCloud
from textblob import TextBlob
import spacy
from docx import Document as DocxDocument
from PyPDF2 import PdfReader

MAX_CONTENT_MB = int(os.environ.get("MAX_CONTENT_MB", "20"))
MAX_CONTENT_LENGTH = MAX_CONTENT_MB * 1024 * 1024

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

# CORS: standardmäßig nur die Frontend-Origin erlauben
frontend_origin = os.environ.get("FRONTEND_ORIGIN", "*")
CORS(app, resources={r"/*": {"origins": frontend_origin}})

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

# spaCy laden (deutsch); bei Bedarf auf en_core_web_sm wechseln
try:
    nlp = spacy.load("de_core_news_md")
except Exception as e:
    log.exception("spaCy model missing. Did you download de_core_news_md?")
    raise

def _extract_text_from_pdf(file_stream) -> str:
    reader = PdfReader(file_stream)
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")
    return "\n".join(pages)

def _extract_text_from_docx(file_stream) -> str:
    doc = DocxDocument(file_stream)
    return "\n".join(p.text for p in doc.paragraphs)

def _make_wordcloud_png(text: str) -> str | None:
    if not text or not text.strip():
        return None
    wc = WordCloud(width=1024, height=512, background_color="white",
                   collocations=False, max_words=200)
    img = wc.generate(text).to_image()
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def _analyze_text_core(text: str) -> dict:
    # Sentiment (TextBlob primär für EN; für DE okay als einfache Heuristik)
    tb = TextBlob(text)
    sentiment = {
        "polarity": float(tb.sentiment.polarity),
        "subjectivity": float(tb.sentiment.subjectivity),
    }

    # Entities via spaCy
    doc = nlp(text)
    entities = [{"text": ent.text, "label": ent.label_} for ent in doc.ents]

    # Wordcloud
    wc_dataurl = _make_wordcloud_png(text)

    return {
        "sentiment": sentiment,
        "entities": entities,
        "wordcloud_png": wc_dataurl,
    }

@app.get("/healthz")
def healthz():
    return jsonify({"ok": True})

@app.post("/analyze")
def analyze():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided."}), 400
    try:
        result = _analyze_text_core(text)
        return jsonify(result)
    except Exception as e:
        log.exception("Analyze failed")
        return jsonify({"error": "Analyze failed", "detail": str(e)}), 500

@app.post("/analyze-file")
def analyze_file():
    if "file" not in request.files:
        return jsonify({"error": "No file part."}), 400
    f = request.files["file"]
    if not f or not f.filename:
        return jsonify({"error": "No file provided."}), 400

    filename = f.filename.lower()
    try:
        if filename.endswith(".pdf"):
            text = _extract_text_from_pdf(f.stream)
        elif filename.endswith(".docx"):
            text = _extract_text_from_docx(f.stream)
        elif filename.endswith(".txt"):
            text = f.stream.read().decode("utf-8", errors="ignore")
        else:
            return jsonify({"error": "Unsupported file type. Use PDF, DOCX or TXT."}), 415

        text = (text or "").strip()
        if not text:
            return jsonify({"error": "File did not contain readable text."}), 422

        result = _analyze_text_core(text)
        # Optional: debug zurückgeben
        result["debug"] = {"chars": len(text)}
        return jsonify(result)
    except Exception as e:
        log.exception("Analyze file failed")
        return jsonify({"error": "Analyze file failed", "detail": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")))
