from flask import Flask, request, jsonify, send_from_directory
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
from collections import Counter
import re

# Initialize Flask
app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")
CORS(app, origins=[os.environ.get("FRONTEND_URL", "*")])

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

# In-memory storage for uploaded documents (use database in production)
uploaded_documents = {}

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


@app.route('/health')
def health_check():
    return jsonify({
        "status": "OK", 
        "message": "Buzzword Analyzer API running",
        "documents_uploaded": len(uploaded_documents)
    }), 200


@app.route('/documents', methods=['GET'])
def list_documents():
    """List uploaded documents"""
    documents = []
    for doc_id, doc_data in uploaded_documents.items():
        documents.append({
            'id': doc_id,
            'filename': doc_data['filename'],
            'word_count': len(doc_data['words'])
        })
    return jsonify({'documents': documents})


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

        # Store document content for search functionality
        doc_id = f"doc_{len(uploaded_documents) + 1}"
        uploaded_documents[doc_id] = {
            'filename': filename,
            'text': text,
            'words': words,
            'analysis_result': {
                'frequencies': freq,
                'densities': density,
                'kwic': kwic_results,
                'collocations': collocations,
                'sentiment': sentiment,
                'readability': readability,
                'trends': trend_results
            }
        }
        logging.info(f"Stored document {doc_id} with {len(words)} words")

        return jsonify({
            'frequencies': freq,
            'densities': density,
            'kwic': kwic_results,
            'collocations': collocations,
            'image': img_data_url,
            'sentiment': sentiment,
            'readability': readability,
            'trends': trend_results,
            'document_id': doc_id  # Return document ID for reference
        })

    except Exception as e:
        logging.error(f"Analysis failed: {e}")
        return jsonify({'error': 'Internal server error'}), 500


@app.route('/search', methods=['POST'])
def search():
    """
    Search endpoint for keyword-based text analysis
    Expects JSON: {"keywords": "search terms"}
    Returns: {"results": [...], "wordcloud": "...", "kwic": [...]}
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        keywords = data.get('keywords', '').strip()
        if not keywords:
            return jsonify({'error': 'No keywords provided'}), 400
        
        logging.info(f"Search request for keywords: {keywords}")
        
        # Search within uploaded documents first
        search_results = []
        kwic_results = []
        
        if uploaded_documents:
            logging.info(f"Searching within {len(uploaded_documents)} uploaded documents")
            keywords_list = [k.strip().lower() for k in keywords.split(',') if k.strip()]
            if not keywords_list:
                keywords_list = [keywords.lower()]
            
            for doc_id, doc_data in uploaded_documents.items():
                text = doc_data['text'].lower()
                words = doc_data['words']
                
                # Find sentences containing keywords
                sentences = re.split(r'(?<=[.!?])\s+', doc_data['text'])
                
                for keyword in keywords_list:
                    # Find matches in text
                    matches = []
                    for sentence in sentences:
                        if keyword in sentence.lower():
                            matches.append(sentence.strip())
                    
                    if matches:
                        search_results.extend(matches[:3])  # Limit to 3 per keyword
                        
                        # Create KWIC results
                        for i, word in enumerate(words):
                            if keyword in word:
                                window = 5
                                left_context = " ".join(words[max(0, i-window):i])
                                right_context = " ".join(words[i+1:i+1+window])
                                kwic_results.append({
                                    'keyword': keyword,
                                    'context': f"...{left_context} {word} {right_context}..."
                                })
                                if len(kwic_results) >= 5:  # Limit KWIC results
                                    break
                    
                    if len(search_results) >= 10:  # Limit total results
                        break
        
        # If no results from uploaded documents, use mock containerlogistics data
        if not search_results:
            containerlogistics_terms = {
            'iot': ['IoT sensors in containers', 'Smart container monitoring', 'RFID tracking systems'],
            'automation': ['Automated port operations', 'Robotic container handling', 'AI-powered logistics'],
            'supply': ['Supply chain optimization', 'Container supply networks', 'Global supply chains'],
            'digital': ['Digital twin technology', 'Digital transformation in logistics', 'Digital port systems'],
            'sustainability': ['Green container logistics', 'Sustainable shipping', 'Carbon-neutral ports'],
            'blockchain': ['Blockchain in logistics', 'Container tracking with blockchain', 'Decentralized supply chains'],
            'analytics': ['Big data in logistics', 'Predictive analytics for containers', 'Data-driven port operations']
        }
        
        # Generate contextual results based on keywords
        search_results = []
        kwic_results = []
        
        keywords_lower = keywords.lower()
        for category, examples in containerlogistics_terms.items():
            if category in keywords_lower or any(word in keywords_lower for word in category.split()):
                search_results.extend(examples)
                # Create KWIC-style results
                for example in examples[:2]:  # Limit to 2 per category
                    kwic_results.append({
                        'keyword': category,
                        'context': f"...in the context of {example.lower()}, recent developments show..."
                    })
        
            # If no specific matches from containerlogistics terms, provide general results
            if not search_results:
                search_results = [
                    f"Container logistics analysis for: {keywords}",
                    f"IoT applications related to: {keywords}",
                    f"Supply chain implications of: {keywords}",
                    f"Digital transformation aspects of: {keywords}",
                    f"Sustainability considerations for: {keywords}"
                ]
        
        # Generate a simple word cloud data (mock for now)
        wordcloud_data = None
        if keywords:
            # Create basic word frequency for wordcloud
            word_freq = {}
            words = keywords.split()
            for word in words:
                word_freq[word.lower()] = word_freq.get(word.lower(), 0) + 1
            
            # Add some containerlogistics context words
            context_words = ['container', 'logistics', 'iot', 'supply', 'chain', 'port', 'shipping']
            for word in context_words:
                if word in keywords_lower:
                    word_freq[word] = word_freq.get(word, 0) + 2
        
        # Limit results to prevent overwhelming the frontend
        search_results = search_results[:10]
        kwic_results = kwic_results[:5]
        
        response_data = {
            'results': search_results,
            'wordcloud': wordcloud_data,  # Will be null for now
            'kwic': kwic_results
        }
        
        logging.info(f"Search completed. Found {len(search_results)} results")
        return jsonify(response_data)
        
    except Exception as e:
        logging.error(f"Search failed: {e}")
        return jsonify({'error': 'Search request failed'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
