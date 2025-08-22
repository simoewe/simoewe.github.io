from flask import Flask, request, jsonify
from flask_cors import CORS

import os
import io
from PyPDF2 import PdfReader
from docx import Document
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import base64
import logging
from textblob import TextBlob
import spacy
from collections import Counter
import re

# Initialize Flask
app = Flask(__name__)
CORS(app, origins=["https://simoewe-github-io-1-cdi0.onrender.com"])
nlp = spacy.load('en_core_web_sm')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def allowed_file(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def get_file_size(file):
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    return size


def extract_text_pdf(file_stream):
    try:
        reader = PdfReader(file_stream)
        return ''.join(page.extract_text() or '' for page in reader.pages)
    except Exception as e:
        logging.error(f"PDF extraction failed: {e}")
        raise


def extract_text_docx(file_stream):
    try:
        doc = Document(file_stream)
        return '\n'.join([p.text for p in doc.paragraphs if p.text.strip()])
    except Exception as e:
        logging.error(f"DOCX extraction failed: {e}")
        raise


def extract_text_txt(file_stream):
    try:
        return file_stream.read().decode('utf-8', errors='ignore')
    except Exception as e:
        logging.error(f"TXT extraction failed: {e}")
        raise


@app.route('/')
def health_check():
    return jsonify({"status": "OK", "message": "Buzzword Analyzer API running"}), 200


@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        filename = file.filename.lower()
        if not allowed_file(filename):
            return jsonify({'error': 'Unsupported file type'}), 400

        if get_file_size(file) > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large (max 5MB)'}), 400
        file.seek(0)

        buzzwords = request.form.get('buzzwords', '')
        buzzwords = [w.strip().lower() for w in buzzwords.split(',') if w.strip()]
        if not buzzwords:
            return jsonify({'error': 'No buzzwords provided'}), 400

        if filename.endswith('.pdf'):
            text = extract_text_pdf(file)
        elif filename.endswith('.docx'):
            text = extract_text_docx(file)
        elif filename.endswith('.txt'):
            text = extract_text_txt(file)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        text_lower = text.lower()
        words = [w.strip(".,!?;:()[]") for w in text_lower.split()]
        total_words = len(words)
        word_counter = Counter(words)

        freq = {w: word_counter[w] for w in buzzwords}
        if all(v == 0 for v in freq.values()):
            return jsonify({'error': 'No buzzwords found in text'}), 400

        density = {w: round((freq[w] / total_words) * 100, 2) if total_words > 0 else 0 for w in buzzwords}

        # KWIC
        kwic_results = {}
        window = 5
        for bw in buzzwords:
            snippets = []
            for i, word in enumerate(words):
                if word == bw:
                    left = " ".join(words[max(0, i - window):i])
                    right = " ".join(words[i + 1:i + 1 + window])
                    snippets.append(f"... {left} {word} {right} ...")
            kwic_results[bw] = snippets[:3]

        # Collocations
        collocations = {}
        for bw in buzzwords:
            left_neighbors, right_neighbors = [], []
            for i, word in enumerate(words):
                if word == bw:
                    if i > 0:
                        left_neighbors.append(words[i - 1])
                    if i < len(words) - 1:
                        right_neighbors.append(words[i + 1])
            collocations[bw] = {
                "left": Counter(left_neighbors).most_common(3),
                "right": Counter(right_neighbors).most_common(3)
            }

        # Sentiment
        blob = TextBlob(text)
        sentiment = {
            'polarity': blob.sentiment.polarity,
            'subjectivity': blob.sentiment.subjectivity
        }

        # Readability
        sentences = re.split(r'(?<=[.!?])\s+', text)
        num_sentences = len([s for s in sentences if s.strip()])
        num_syllables = sum(len(w) // 3 for w in words)
        asl = total_words / max(1, num_sentences)
        asw = num_syllables / max(1, total_words)
        flesch_score = round(206.835 - 1.015 * asl - 84.6 * asw, 2)

        readability = {
            'flesch_reading_ease': flesch_score,
            'total_words': total_words,
            'total_sentences': num_sentences
        }

        # Technological trends
        trends = [
            "Artificial Intelligence", "Blockchain", "Big Data Analytics", "Internet of Things",
            "Digital Twin", "5G Network", "Robotics", "Autonomous Systems", "Virtual Reality",
            "Augmented Reality", "Cloud Computing", "Edge Computing", "Fog Computing"
        ]
        trend_results = []
        for trend in trends:
            trend_lower = trend.lower()
            matches = [s.strip() for s in sentences if trend_lower in s.lower()]
            if matches:
                trend_results.append({
                    'trend': trend,
                    'count': len(matches),
                    'contexts': matches[:3]
                })

        # Word cloud
        nonzero_freq = {k: v for k, v in freq.items() if v > 0}
        img_data_url = None
        if nonzero_freq:
            wc = WordCloud(width=800, height=400, background_color='white')
            wc.generate_from_frequencies(nonzero_freq)
            img_io = io.BytesIO()
            plt.figure(figsize=(10, 5))
            plt.imshow(wc, interpolation='bilinear')
            plt.axis('off')
            plt.tight_layout(pad=0)
            plt.savefig(img_io, format='PNG')
            plt.close()
            img_io.seek(0)
            img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
            img_data_url = f"data:image/png;base64,{img_base64}"

        return jsonify({
            'frequencies': freq,
            'densities': density,
            'kwic': kwic_results,
            'collocations': collocations,
            'image': img_data_url,
            'sentiment': sentiment,
            'readability': readability,
            'trends': trend_results
        })

    except Exception as e:
        logging.error(f"Analysis failed: {e}")
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)