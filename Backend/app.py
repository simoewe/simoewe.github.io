from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import io
from PyPDF2 import PdfReader, PdfWriter
try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
except ImportError:  # pdfminer is optional but preferred for complex PDFs
    pdfminer_extract_text = None
from docx import Document
from wordcloud import WordCloud
import matplotlib.pyplot as plt
import base64
import logging
from textblob import TextBlob
from collections import Counter
import re
import boto3
from botocore.config import Config
from urllib.parse import quote

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

ALLOWED_EXTENSIONS = {'.pdf', '.docx', '.txt'}
MAX_PDF_PAGES = 300
MAX_WORDS_ANALYSIS = 120_000
PDF_OPTIMIZE_THRESHOLD_BYTES = 8 * 1024 * 1024  # 8 MB

DEFAULT_TREND_KEYWORDS = [
    "Artificial Intelligence",
    "AI",
    "Machine Learning",
    "Blockchain",
    "Internet of Things",
    "IoT",
    "Digital Twin",
    "5G",
    "Robotics",
    "Autonomous Systems",
    "Automation",
    "Virtual Reality",
    "Augmented Reality",
    "Cloud Computing",
    "Edge Computing",
    "Fog Computing",
    "Big Data Analytics"
]

STRIP_CHARS = ".,!?:()[]'\""


def tokenize_keyword(keyword):
    return [
        part.strip(STRIP_CHARS)
        for part in re.split(r'[-_/\s]+', keyword.lower())
        if part.strip(STRIP_CHARS)
    ]


def compile_keyword_pattern(tokens):
    if not tokens:
        return None
    separator = r'(?:\s+|[-_/]+)'
    pattern = r'(?<!\w)' + separator.join(re.escape(token) for token in tokens) + r'(?!\w)'
    return re.compile(pattern, re.IGNORECASE)


def build_snippet(text, start, end, word_spans, window=5):
    def index_at_or_after(position):
        for idx, match in enumerate(word_spans):
            if match.start() <= position < match.end():
                return idx
            if match.start() > position:
                return idx
        return len(word_spans)

    start_idx = index_at_or_after(start)
    end_idx = index_at_or_after(end)

    left_start = max(0, start_idx - window)
    left_words = [m.group(0) for m in word_spans[left_start:start_idx]]
    right_words = [m.group(0) for m in word_spans[end_idx:end_idx + window]]

    keyword_text = text[start:end].strip()
    snippet_parts = []
    if left_words:
        snippet_parts.append(" ".join(left_words))
    if keyword_text:
        snippet_parts.append(keyword_text)
    if right_words:
        snippet_parts.append(" ".join(right_words))

    snippet = " ".join(snippet_parts).strip()
    snippet = re.sub(r'\s+', ' ', snippet)
    return f"... {snippet} ..." if snippet else ""


def allowed_file(filename):
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def optimize_pdf_bytes(file_bytes):
    """Attempt to shrink heavy PDFs by stripping embedded images."""
    if not isinstance(file_bytes, (bytes, bytearray)):
        return file_bytes

    original_size = len(file_bytes)
    if original_size < PDF_OPTIMIZE_THRESHOLD_BYTES:
        return file_bytes

    try:
        pdf_io = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_io, strict=False)
        writer = PdfWriter()

        images_removed = 0
        for page in reader.pages:
            try:
                resources = page.get("/Resources")
                if resources is None:
                    writer.add_page(page)
                    continue

                try:
                    resources = resources.get_object()
                except AttributeError:
                    pass

                xobjects = resources.get("/XObject") if isinstance(resources, dict) else None
                if xobjects is not None:
                    try:
                        xobjects = xobjects.get_object()
                    except AttributeError:
                        pass

                    if isinstance(xobjects, dict):
                        keys_to_remove = []
                        for name, candidate in list(xobjects.items()):
                            try:
                                candidate_obj = candidate.get_object()
                            except AttributeError:
                                candidate_obj = candidate

                            subtype = candidate_obj.get("/Subtype") if isinstance(candidate_obj, dict) else None
                            if subtype == "/Image":
                                keys_to_remove.append(name)

                        for key in keys_to_remove:
                            xobjects.pop(key, None)
                            images_removed += 1

                writer.add_page(page)
            except Exception:
                writer.add_page(page)

        optimized_io = io.BytesIO()
        writer.write(optimized_io)
        optimized_bytes = optimized_io.getvalue()
        try:
            writer.close()
        except Exception:
            pass

        if images_removed:
            logging.info(
                "Optimized PDF by removing %s images. Size reduced from %s to %s bytes",
                images_removed,
                original_size,
                len(optimized_bytes)
            )

        if optimized_bytes and len(optimized_bytes) < original_size:
            return optimized_bytes
    except Exception as optimize_error:
        logging.warning(f"PDF optimization failed: {optimize_error}")

    return file_bytes


def extract_text_pdf(file_stream):
    try:
        # Log file details for debugging
        try:
            file_stream.seek(0, os.SEEK_END)
            size = file_stream.tell()
            file_stream.seek(0)
        except Exception:
            size = 'unknown'
        logging.info(f"Starting PDF extraction. File size: {size} bytes")

        # Read file into memory
        file_stream.seek(0)
        file_bytes = file_stream.read()
        if isinstance(file_bytes, str):
            file_bytes = file_bytes.encode('utf-8')

        file_bytes = optimize_pdf_bytes(file_bytes)

        # Use BytesIO for PyPDF2
        from io import BytesIO
        pdf_io = BytesIO(file_bytes)
        reader = PdfReader(pdf_io, strict=False)

        if reader.is_encrypted:
            try:
                decrypt_result = reader.decrypt("")
                if decrypt_result == 0:
                    decrypt_result = reader.decrypt(None)
                if decrypt_result == 0:
                    logging.error("Encrypted PDF requires a password")
                    raise ValueError("PDF is encrypted and requires a password")
                logging.info("Encrypted PDF decrypted with an empty password")
            except Exception as decrypt_error:
                logging.error(f"Failed to decrypt PDF: {decrypt_error}")
                raise ValueError("Failed to decrypt encrypted PDF")

        page_count = len(reader.pages)
        if page_count > MAX_PDF_PAGES:
            logging.info(f"PDF rejected due to page limit: {page_count} pages")
            raise ValueError(f"PDF überschreitet das Seitenlimit von {MAX_PDF_PAGES} Seiten.")
        text = ''
        for page_num, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text()
                text += page_text or ''
            except Exception as page_error:
                logging.error(f"PDF page {page_num+1} extraction failed: {page_error}")
                continue
        if text and text.strip():
            return text

        logging.info("PyPDF2 returned little/no text; attempting pdfminer fallback")

        if not pdfminer_extract_text:
            logging.warning("pdfminer.six not installed; cannot improve extraction result")
            return text

        pdf_io.seek(0)
        try:
            miner_text = pdfminer_extract_text(pdf_io, password="")
            if miner_text and miner_text.strip():
                logging.info("pdfminer extraction successful")
                return miner_text
            logging.warning("pdfminer extraction yielded empty text")
            return miner_text or text
        except Exception as miner_error:
            logging.error(f"pdfminer extraction failed: {miner_error}")
            return text
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

        raw_keywords = request.form.get('buzzwords', '')
        user_keywords = [w.strip() for w in raw_keywords.split(',') if w.strip()]

        keyword_candidates = user_keywords + DEFAULT_TREND_KEYWORDS
        keyword_specs = []
        seen_keyword_tokens = set()
        for candidate in keyword_candidates:
            label = candidate.strip()
            tokens = tokenize_keyword(label)
            if not tokens:
                continue
            token_key = tuple(tokens)
            if token_key in seen_keyword_tokens:
                continue
            seen_keyword_tokens.add(token_key)
            keyword_specs.append({
                'label': label,
                'tokens': tokens
            })

        if filename.endswith('.pdf'):
            try:
                text = extract_text_pdf(file)
            except ValueError as pdf_error:
                logging.warning(f"PDF validation error: {pdf_error}")
                return jsonify({'error': str(pdf_error)}), 400
            except Exception as pdf_error:
                logging.error(f"PDF extraction error: {pdf_error}")
                return jsonify({'error': 'Failed to extract text from PDF. The file may be corrupted or too complex.'}), 400
        elif filename.endswith('.docx'):
            try:
                text = extract_text_docx(file)
            except ValueError as docx_error:
                logging.warning(f"DOCX validation error: {docx_error}")
                return jsonify({'error': str(docx_error)}), 400
            except Exception as docx_error:
                logging.error(f"DOCX extraction error: {docx_error}")
                return jsonify({'error': 'Failed to extract text from DOCX.'}), 400
        elif filename.endswith('.txt'):
            try:
                text = extract_text_txt(file)
            except ValueError as txt_error:
                logging.warning(f"TXT validation error: {txt_error}")
                return jsonify({'error': str(txt_error)}), 400
            except Exception as txt_error:
                logging.error(f"TXT extraction error: {txt_error}")
                return jsonify({'error': 'Failed to extract text from TXT.'}), 400
        else:
            return jsonify({'error': 'Unsupported file type'}), 400

        text_lower = text.lower()
        words = [w.strip(".,!?;:()[]") for w in text_lower.split() if w.strip(".,!?;:()[]")]
        total_words = len(words)

        if total_words > MAX_WORDS_ANALYSIS:
            logging.info(f"Document rejected due to length: {total_words} words")
            return jsonify({'error': f'Dokument zu umfangreich (Limit {MAX_WORDS_ANALYSIS:,} Wörter). Bitte kürzere Datei wählen.'}), 400

        token_index = {}

        def add_token(token, index):
            if not token:
                return
            token_index.setdefault(token, []).append(index)

        for idx, word in enumerate(words):
            tokens = {word}
            for part in re.split(r'[-_/\s]+', word):
                part = part.strip()
                if part:
                    tokens.add(part)
            for token in tokens:
                add_token(token, idx)

        word_pattern = re.compile(r'\b\w[\w\-_/]*\b')
        word_spans = list(word_pattern.finditer(text))

        freq = {}
        kwic_results = {}
        collocations = {}
        window = 5

        for spec in keyword_specs:
            label = spec['label']
            tokens = spec['tokens']
            pattern = compile_keyword_pattern(tokens)
            matches = list(pattern.finditer(text_lower)) if pattern else []

            freq[label] = len(matches)

            snippets = []
            for match in matches:
                snippet = build_snippet(text, match.start(), match.end(), word_spans, window=window)
                if snippet:
                    snippets.append(snippet)
                if len(snippets) >= 3:
                    break
            kwic_results[label] = snippets

            if len(tokens) == 1:
                token = tokens[0]
                indices = token_index.get(token, [])
                left_neighbors, right_neighbors = [], []
                for i in indices:
                    if i > 0:
                        left_neighbors.append(words[i - 1])
                    if i < len(words) - 1:
                        right_neighbors.append(words[i + 1])
                collocations[label] = {
                    "left": Counter(left_neighbors).most_common(3),
                    "right": Counter(right_neighbors).most_common(3)
                }
            else:
                collocations[label] = {"left": [], "right": []}

        density = {
            label: round((freq[label] / total_words) * 100, 2) if total_words > 0 else 0
            for label in freq
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
