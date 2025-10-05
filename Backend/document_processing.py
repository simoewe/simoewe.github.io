"""Document ingestion and text extraction utilities."""

import io
import logging
import os

from PyPDF2 import PdfReader, PdfWriter

try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
except ImportError:  # pdfminer is optional but preferred for complex PDFs
    pdfminer_extract_text = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

from docx import Document

try:
    from .constants import (
        ALLOWED_EXTENSIONS,
        MAX_PDF_PAGES,
        PDF_OPTIMIZE_THRESHOLD_BYTES,
        PDF_PDFMINER_MAX_BYTES,
        PDF_PDFMINER_MAX_PAGES,
    )
except ImportError:
    from constants import (
        ALLOWED_EXTENSIONS,
        MAX_PDF_PAGES,
        PDF_OPTIMIZE_THRESHOLD_BYTES,
        PDF_PDFMINER_MAX_BYTES,
        PDF_PDFMINER_MAX_PAGES,
    )


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
            except Exception as page_error:
                logging.warning(f"Failed to process PDF page resources: {page_error}")
                writer.add_page(page)

        logging.info(f"Removed {images_removed} images while optimizing PDF")

        output_io = io.BytesIO()
        writer.write(output_io)
        optimized_bytes = output_io.getvalue()
        output_io.close()

        if optimized_bytes and len(optimized_bytes) < original_size:
            return optimized_bytes
    except Exception as optimize_error:
        logging.warning(f"PDF optimization failed: {optimize_error}")

    return file_bytes


def extract_text_pymupdf(file_bytes, reason_label="preferred"):
    """Extract text using PyMuPDF for complex PDFs."""
    if not fitz or not isinstance(file_bytes, (bytes, bytearray)):
        return None, None, None

    doc = None
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page_count = doc.page_count
        text_buffer = io.StringIO()
        page_spans = []
        for page_index, page in enumerate(doc):
            page_text = page.get_text("text") or ""
            start_pos = text_buffer.tell()
            if page_text:
                text_buffer.write(page_text)
            end_pos = text_buffer.tell()
            page_spans.append({
                "number": page_index + 1,
                "start": start_pos,
                "end": end_pos
            })
            if page_index < page_count - 1:
                text_buffer.write("\n")
        extracted = text_buffer.getvalue()
        if extracted:
            logging.info(
                "PyMuPDF extraction (%s) succeeded on %s pages",
                reason_label,
                page_count
            )
            return extracted, page_count, page_spans
        logging.warning("PyMuPDF extraction (%s) returned empty text", reason_label)
        return None, page_count, page_spans
    except Exception as pymupdf_error:
        logging.warning(f"PyMuPDF extraction ({reason_label}) failed: {pymupdf_error}")
        return None, getattr(doc, "page_count", None), None
    finally:
        if doc is not None:
            doc.close()


def extract_text_pdf(file_stream, return_metadata=False):
    try:
        try:
            file_stream.seek(0, os.SEEK_END)
            size = file_stream.tell()
            file_stream.seek(0)
        except Exception:
            size = 'unknown'
        logging.info(f"Starting PDF extraction. File size: {size} bytes")

        file_stream.seek(0)
        file_bytes = file_stream.read()
        if isinstance(file_bytes, str):
            file_bytes = file_bytes.encode('utf-8')

        original_file_bytes = file_bytes

        pymupdf_text = None
        pymupdf_pages = None
        pymupdf_page_spans = None
        if fitz:
            pymupdf_text, pymupdf_pages, pymupdf_page_spans = extract_text_pymupdf(
                original_file_bytes,
                reason_label="initial"
            )
            if pymupdf_pages and pymupdf_pages > MAX_PDF_PAGES:
                logging.info(f"PDF rejected due to page limit (PyMuPDF count): {pymupdf_pages} pages")
                raise ValueError(f"PDF exceeds the page limit of {MAX_PDF_PAGES} pages.")
            if pymupdf_text:
                if return_metadata:
                    return pymupdf_text, {"pages": pymupdf_page_spans or []}
                return pymupdf_text

        file_bytes = optimize_pdf_bytes(file_bytes)

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
            raise ValueError(f"PDF exceeds the page limit of {MAX_PDF_PAGES} pages.")

        text_buffer = io.StringIO()
        page_spans = []
        for page_num, page in enumerate(reader.pages):
            start_pos = text_buffer.tell()
            page_text = ''
            try:
                page_text = page.extract_text() or ''
            except Exception as page_error:
                logging.error(f"PDF page {page_num+1} extraction failed: {page_error}")
            if page_text:
                text_buffer.write(page_text)
            end_pos = text_buffer.tell()
            page_spans.append({
                "number": page_num + 1,
                "start": start_pos,
                "end": end_pos
            })
            if page_num < page_count - 1:
                text_buffer.write('\n')
        text = text_buffer.getvalue()
        if text and text.strip():
            if return_metadata:
                return text, {"pages": page_spans}
            return text

        logging.info("PyPDF2 returned little/no text; attempting pdfminer fallback")

        allow_pdfminer = (
            pdfminer_extract_text is not None
            and len(file_bytes) <= PDF_PDFMINER_MAX_BYTES
            and page_count <= PDF_PDFMINER_MAX_PAGES
        )

        if allow_pdfminer:
            try:
                miner_text = pdfminer_extract_text(io.BytesIO(file_bytes), password="")
                if miner_text and miner_text.strip():
                    logging.info("pdfminer extraction successful")
                    if return_metadata:
                        return miner_text, {"pages": page_spans}
                    return miner_text
                logging.warning("pdfminer extraction yielded empty text")
                result_text = miner_text or text
                if return_metadata:
                    return result_text, {"pages": page_spans}
                return result_text
            except Exception as miner_error:
                logging.error(f"pdfminer extraction failed: {miner_error}")
                if return_metadata:
                    return text, {"pages": page_spans}
                return text

        if not pdfminer_extract_text:
            logging.warning("pdfminer.six not installed; cannot improve extraction result")
        elif not allow_pdfminer:
            logging.info(
                "Skipped pdfminer fallback due to size/page constraints (size=%s bytes, pages=%s)",
                len(file_bytes),
                page_count
            )
        if return_metadata:
            return text, {"pages": page_spans}
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
