from flask import Flask, request, jsonify, render_template
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

# Debug print
print("hehe")

app = Flask(__name__)
CORS(app)
nlp = spacy.load('en_core_web_sm')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)


def get_file_size(file):
    """Get the size of the uploaded file."""
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    return size


def extract_text_pdf(file_stream):
    """Extract text from a PDF file stream."""
    try:
        reader = PdfReader(file_stream)
        text = ''
        for page in reader.pages:
            text += page.extract_text() or ''
        return text
    except Exception as e:
        logging.error(f"PDF extraction failed: {e}")
        raise


def extract_text_docx(file_stream):
    """Extract text from a DOCX file stream."""
    try:
        doc = Document(file_stream)
        return '\n'.join([p.text for p in doc.paragraphs])
    except Exception as e:
        logging.error(f"DOCX extraction failed: {e}")
        raise


def extract_text_txt(file_stream):
    """Extract text from a TXT file stream."""
    try:
        return file_stream.read().decode('utf-8')
    except Exception as e:
        logging.error(f"TXT extraction failed: {e}")
        raise


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze uploaded file for buzzword frequencies, word cloud, and extra metrics."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part in the request'}), 400
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        filename = file.filename.lower()
        if not allowed_file(filename):
            return jsonify({'error': 'Unsupported file type'}), 400
        if get_file_size(file.stream) > MAX_FILE_SIZE:
            return jsonify({'error': 'File too large (max 5MB)'}), 400

        # Get buzzwords
        buzzwords = request.form.get('buzzwords', '')
        buzzwords = [w.strip().lower() for w in buzzwords.split(',') if w.strip()]
        if not buzzwords:
            return jsonify({'error': 'No buzzwords provided'}), 400

        # Extract text
        if filename.endswith('.pdf'):
            text = extract_text_pdf(file.stream)
        elif filename.endswith('.docx'):
            text = extract_text_docx(file.stream)
        elif filename.endswith('.txt'):
            text = extract_text_txt(file.stream)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        text_lower = text.lower()
        words = [w.strip(".,!?;:()[]") for w in text_lower.split()]
        total_words = len(words)

        # Frequency & density
        freq = {w: words.count(w) for w in buzzwords}
        density = {w: round((freq[w] / total_words) * 100, 2) if total_words > 0 else 0 for w in buzzwords}

        # KWIC (Keyword in Context)
        kwic_results = {}
        window = 5
        for bw in buzzwords:
            snippets = []
            for i, word in enumerate(words):
                if word == bw:
                    left = " ".join(words[max(0, i - window):i])
                    right = " ".join(words[i + 1:i + 1 + window])
                    snippets.append(f"... {left} {word} {right} ...")
            kwic_results[bw] = snippets[:3]  # limit to 3 examples per buzzword

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
            left_counts = Counter(left_neighbors).most_common(3)
            right_counts = Counter(right_neighbors).most_common(3)
            collocations[bw] = {
                "left": left_counts,
                "right": right_counts
            }

        # Safeguard: no buzzwords found
        if all(v == 0 for v in freq.values()):
            return jsonify({'error': 'No buzzwords found in text'}), 400

        # Sentiment analysis
        blob = TextBlob(text)
        sentiment = {
            'polarity': blob.sentiment.polarity,
            'subjectivity': blob.sentiment.subjectivity
        }

        # Readability index (Flesch Reading Ease)
        sentences = text.split(".")
        num_sentences = len([s for s in sentences if s.strip()])
        num_words = len(words)
        num_syllables = sum(len(w) // 3 for w in words)  # quick syllable heuristic
        try:
            asl = num_words / num_sentences  # average sentence length
            asw = num_syllables / num_words if num_words > 0 else 0
            flesch_score = round(206.835 - 1.015 * asl - 84.6 * asw, 2)
        except ZeroDivisionError:
            flesch_score = None

        readability = {
            'flesch_reading_ease': flesch_score,
            'total_words': num_words,
            'total_sentences': num_sentences
        }

        # Technological trend detection
        trends = [
            "Artificial Intelligence", "Blockchain", "Big Data Analytics", "Internet of Things",
            "Digital Twin", "5G Network", "Robotics", "Autonomous Systems", "Virtual Reality",
            "Augmented Reality", "Cloud Computing", "Edge Computing", "Fog Computing"
        ]
        trend_results = []
        sentences = re.split(r'(?<=[.!?])\s+', text)
        for trend in trends:
            trend_lower = trend.lower()
            count = text.lower().count(trend_lower)
            if count > 0:
                context_sentences = [s.strip() for s in sentences if trend_lower in s.lower()]
                context_sentences = context_sentences[:3]
                trend_results.append({
                    'trend': trend,
                    'count': count,
                    'contexts': context_sentences
                })

        # Word cloud
        try:
            wc = WordCloud(width=800, height=400, background_color='white')
            wc.generate_from_frequencies(freq)
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
        except Exception as e:
            logging.error(f"Word cloud generation failed: {e}")
            return jsonify({'error': 'Word cloud generation failed'}), 500

        logging.info(f"File '{filename}' analyzed successfully.")
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
    app.run(debug=True)
