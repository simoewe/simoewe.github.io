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

app = Flask(__name__)
CORS(app)

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

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze uploaded file for buzzword frequencies and generate a word cloud."""
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
        freq = {w: text_lower.count(w) for w in buzzwords}

        # Safeguard: no buzzwords found
        if all(v == 0 for v in freq.values()):
            return jsonify({'error': 'No buzzwords found in text'}), 400

        # Generate word cloud
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
            'image': img_data_url
        })
    except Exception as e:
        logging.error(f"Analysis failed: {e}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True)
