from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import re

import boto3
from botocore.config import Config
from urllib.parse import quote

try:  # Prefer package-relative imports when available
    from .analysis_service import analyze_document
    from .document_processing import (
        allowed_file,
        extract_text_docx,
        extract_text_pdf,
        extract_text_txt,
    )
except ImportError:  # Fallback for environments running from the backend folder root
    from analysis_service import analyze_document
    from document_processing import (
        allowed_file,
        extract_text_docx,
        extract_text_pdf,
        extract_text_txt,
    )

# S3-kompatible OCI-API - Für Oracle Anbindung
def get_s3_client():
    region = os.environ["OCI_REGION"]
    namespace = os.environ["OCI_NAMESPACE"]
    access_key = os.environ["OCI_S3_ACCESS_KEY"]
    secret_key = os.environ["OCI_S3_SECRET_KEY"]
    endpoint = f"https://{namespace}.compat.objectstorage.{region}.oraclecloud.com"
    return boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url=endpoint,
        config=Config(signature_version="s3v4")
    )


# Initialize Flask
app = Flask(__name__, static_folder="../frontend/build", static_url_path="/")

# Configure CORS for Render deployment
allowed_origins = [
    "https://simoewe-github-io-1-cdi0.onrender.com",  # legacy Render deployment
    "http://localhost:3000",  # Local development
    "https://simoewe.github.io",  # GitHub Pages if used
]

# Add environment variable support (accept both FRONTEND_URL and FRONTEND_ORIGIN)
for env_key in ["FRONTEND_URL", "FRONTEND_ORIGIN"]:
    env_value = os.environ.get(env_key)
    if env_value:
        allowed_origins.append(env_value)

CORS(app, 
    origins=allowed_origins,
    methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allow_headers=['Content-Type', 'Authorization'],
    supports_credentials=True)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

# In-memory storage for uploaded documents (use database in production)
uploaded_documents = {}


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

        raw_keywords = request.form.get('buzzwords', '')
        user_keywords = [w.strip() for w in raw_keywords.split(',') if w.strip()]

        try:
            if filename.endswith('.pdf'):
                text = extract_text_pdf(file)
            elif filename.endswith('.docx'):
                text = extract_text_docx(file)
            elif filename.endswith('.txt'):
                text = extract_text_txt(file)
            else:
                return jsonify({'error': 'Unsupported file type'}), 400
        except ValueError as extraction_error:
            logging.warning(f"Document validation error: {extraction_error}")
            return jsonify({'error': str(extraction_error)}), 400
        except Exception as extraction_error:
            logging.error(f"Document extraction error: {extraction_error}")
            return jsonify({'error': 'Failed to extract text from the document.'}), 400

        try:
            analysis_payload, img_data_url, words = analyze_document(text, user_keywords)
        except ValueError as analysis_error:
            logging.warning(f"Analysis validation error: {analysis_error}")
            return jsonify({'error': str(analysis_error)}), 400

        # Store document content for search functionality
        doc_id = f"doc_{len(uploaded_documents) + 1}"
        uploaded_documents[doc_id] = {
            'filename': filename,
            'text': text,
            'words': words,
            'analysis_result': analysis_payload
        }
        logging.info(f"Stored document {doc_id} with {len(words)} words")

        response_payload = dict(analysis_payload)
        response_payload.update({
            'image': img_data_url,
            'document_id': doc_id
        })

        return jsonify(response_payload)

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
        
        try:
            if uploaded_documents:
                logging.info(f"Searching within {len(uploaded_documents)} uploaded documents")
                keywords_list = [k.strip().lower() for k in keywords.split(',') if k.strip()]
                if not keywords_list:
                    keywords_list = [keywords.lower()]
                
                for doc_id, doc_data in uploaded_documents.items():
                    try:
                        text = doc_data.get('text', '')
                        words = doc_data.get('words', [])
                        
                        if not text or not words:
                            logging.warning(f"Document {doc_id} has no text or words")
                            continue
                        
                        # Find sentences containing keywords
                        sentences = re.split(r'(?<=[.!?])\s+', text)
                        
                        for keyword in keywords_list:
                            # Find matches in text
                            matches = []
                            for sentence in sentences:
                                if sentence and keyword in sentence.lower():
                                    matches.append(sentence.strip())
                            
                            if matches:
                                search_results.extend(matches[:3])  # Limit to 3 per keyword
                                
                                # Create KWIC results - simplified version
                                kwic_results.append({
                                    'keyword': keyword,
                                    'context': f"Found '{keyword}' in document {doc_id}"
                                })
                                
                                if len(kwic_results) >= 5:  # Limit KWIC results
                                    break
                            
                            if len(search_results) >= 10:  # Limit total results
                                break
                    except Exception as doc_error:
                        logging.error(f"Error processing document {doc_id}: {doc_error}")
                        continue
            else:
                logging.info("No uploaded documents found for search")
        except Exception as search_error:
            logging.error(f"Error in document search: {search_error}")
            # Continue with fallback results
        
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
        
        # Ensure we have results (fallback to mock data if needed)
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
        try:
            if keywords:
                # Create basic word frequency for wordcloud
                word_freq = {}
                words_in_keywords = keywords.split()
                for word in words_in_keywords:
                    word_freq[word.lower()] = word_freq.get(word.lower(), 0) + 1
                
                # Add some containerlogistics context words
                keywords_lower = keywords.lower()
                context_words = ['container', 'logistics', 'iot', 'supply', 'chain', 'port', 'shipping']
                for word in context_words:
                    if word in keywords_lower:
                        word_freq[word] = word_freq.get(word, 0) + 2
        except Exception as wc_error:
            logging.error(f"Wordcloud generation error: {wc_error}")
        
        # Limit results to prevent overwhelming the frontend
        search_results = search_results[:10] if search_results else []
        kwic_results = kwic_results[:5] if kwic_results else []
        
        response_data = {
            'results': search_results,
            'wordcloud': wordcloud_data,  # Will be null for now
            'kwic': kwic_results
        }
        
        logging.info(f"Search completed. Found {len(search_results)} results, {len(kwic_results)} KWIC results")
        return jsonify(response_data)
        
    except Exception as e:
        logging.error(f"Search failed: {e}")
        return jsonify({'error': 'Search request failed'}), 500


@app.route('/verify-visibility-code', methods=['POST'])
def verify_visibility_code():
    try:
        data = request.get_json() or {}
        provided = str(data.get('code', '')).strip()
        if not provided:
            return jsonify({'error': 'No code provided'}), 400

        expected = os.environ.get('VISIBILITY_CODE')
        if not expected:
            logging.warning("Visibility code check attempted without VISIBILITY_CODE configured")
            return jsonify({'error': 'Verification unavailable'}), 500

        if provided == expected:
            logging.info("Visibility code accepted")
            return jsonify({'valid': True}), 200

        logging.info("Visibility code rejected")
        return jsonify({'valid': False}), 403

    except Exception as e:
        logging.error(f"Visibility code verification failed: {e}")
        return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)


@app.route('/library', methods=['GET'])
def library():
    try:
        required_env = [
            "OCI_BUCKET",
            "PAR_BASE_URL",
            "OCI_REGION",
            "OCI_NAMESPACE",
            "OCI_S3_ACCESS_KEY",
            "OCI_S3_SECRET_KEY"
        ]
        missing = [var for var in required_env if not os.environ.get(var)]
        if missing:
            logging.warning("Library requested but missing environment variables: %s", missing)
            return jsonify({
                "items": [],
                "warning": "Library storage is not configured."
            })

        bucket = os.environ["OCI_BUCKET"]
        par_base = os.environ["PAR_BASE_URL"].rstrip('/')
        prefix = request.args.get('prefix', '')  # optional: Ordner/prefix
        s3 = get_s3_client()

        objects = []
        kwargs = {
            "Bucket": bucket,
            "Prefix": prefix
        }

        while True:
            resp = s3.list_objects_v2(**kwargs)
            for item in resp.get("Contents", []):
                key = item["Key"]
                if not key.lower().endswith(".pdf"):
                    continue
                # URL über den Bucket-PAR bauen
                url = f"{par_base}/{quote(key)}"
                objects.append({
                    "key": key,
                    "name": key.split('/')[-1],
                    "size": item.get("Size", 0),
                    "last_modified": item.get("LastModified").isoformat() if item.get("LastModified") else None,
                    "url": url
                })

            if resp.get("IsTruncated"):
                kwargs["ContinuationToken"] = resp.get("NextContinuationToken")
            else:
                break

        # Sortiere optional nach Name (oder last_modified)
        objects.sort(key=lambda x: x["name"].lower())

        return jsonify({"items": objects})
    except Exception as e:
        logging.exception("Failed to list bucket contents")
        return jsonify({"error": "Failed to list library"}), 500
