from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import os
import io
from PyPDF2 import PdfReader
from docx import Document
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import base64

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def extract_text_pdf(file_stream):
    reader = PdfReader(file_stream)
    text = ''
    for page in reader.pages:
        text += page.extract_text() or ''
    return text

def extract_text_docx(file_stream):
    doc = Document(file_stream)
    return '\n'.join([p.text for p in doc.paragraphs])

def extract_text_txt(file_stream):
    return file_stream.read().decode('utf-8')

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    buzzwords = request.form.get('buzzwords', '')
    buzzwords = [w.strip().lower() for w in buzzwords.split(',') if w.strip()]
    file = request.files['file']
    filename = file.filename.lower()

    if filename.endswith('.pdf'):
        text = extract_text_pdf(file.stream)
    elif filename.endswith('.docx'):
        text = extract_text_docx(file)
    elif filename.endswith('.txt'):
        text = extract_text_txt(file)
    else:
        return jsonify({'error': 'Unsupported file type'}), 400

    text_lower = text.lower()
    freq = {w: text_lower.count(w) for w in buzzwords}

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

    return jsonify({
        'frequencies': freq,
        'image': img_data_url
    })

if __name__ == '__main__':
    app.run(debug=True)
