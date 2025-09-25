import React, { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";


function RightPanel({ onFileUpload }) {
  const [pdfFile, setPdfFile] = useState(null);
  const [fileTypeError, setFileTypeError] = useState("");
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [scale, setScale] = useState(1.0);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(600);

  useEffect(() => {
    // Set up PDF.js worker synchronously
    const localWorker = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;
    fetch(localWorker, { method: "HEAD" })
      .then((res) => {
        if (res.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = localWorker;
        } else {
          pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        }
      })
      .catch(() => {
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      });

    // ResizeObserver for responsive PDF width
    const observer = new window.ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  const onDrop = (acceptedFiles, rejectedFiles) => {
    setPdfError(null);
    setUploadStatus(null);
    setFileTypeError("");

    if (rejectedFiles && rejectedFiles.length > 0) {
      console.error("Rejected files:", rejectedFiles);
      setUploadStatus("❌ Invalid file type or size");
      return;
    }

    const file = acceptedFiles[0];
    if (!file) {
      setUploadStatus("❌ No file selected");
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (isPdf && file.size <= 5 * 1024 * 1024) {
      const fileUrl = URL.createObjectURL(file);
      setPdfFile(fileUrl);

      if (onFileUpload) {
        onFileUpload(file);
      }

      return () => URL.revokeObjectURL(fileUrl);
    } else {
      const error = !isPdf
        ? "Invalid file type (PDF required)"
        : "File too large (max 5MB)";
      setFileTypeError(`❌ ${error}`);
      setPdfFile(null);
      console.error(error);
      setUploadStatus(`❌ ${error}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/x-pdf": [".pdf"] },
    multiple: false,
    maxSize: 5 * 1024 * 1024,
    onDropRejected: (rejectedFiles) => {
      console.error("Files rejected:", rejectedFiles);
      const reasons = rejectedFiles
        .map((f) => f.errors.map((e) => e.message).join(", "))
        .join("; ");
      setUploadStatus(`❌ Upload failed: ${reasons}`);
    },
  });

  // Zoom controls
  const zoomIn = () => setScale((s) => Math.min(s + 0.2, 3.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.2, 0.5));
  const resetZoom = () => setScale(1.0);

  // Page navigation
  const nextPage = () =>
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev));
  const prevPage = () =>
    setPageNumber((prev) => Math.max(prev - 1, 1));
  const jumpToPage = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= numPages) {
      setPageNumber(val);
    }
  };

  return (
    <div className="right-panel" ref={containerRef}>
      {fileTypeError && (
        <div style={{ color: "#dc3545", fontWeight: "bold", marginBottom: "10px" }}>
          {fileTypeError}
        </div>
      )}
      {!pdfFile ? (
        <div {...getRootProps({ className: "dropzone fullsize" })}>
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Ziehe die PDF hierher…</p>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p>📄 PDF hochladen (Drag & Drop oder klicken)</p>
              <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
                Upload containerlogistics documents for analysis
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="pdf-viewer fullsize">
          {/* Upload status */}
          <div
            style={{
              padding: "10px",
              backgroundColor:
                uploadStatus?.includes("✅")
                  ? "#d4edda"
                  : uploadStatus?.includes("❌")
                  ? "#f8d7da"
                  : "#e9ecef",
              borderRadius: "8px",
              marginBottom: "10px",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            {uploadStatus || "📄 PDF loaded"}
          </div>

          {/* Zoom controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <button onClick={zoomOut}>➖ Zoom Out</button>
            <button onClick={resetZoom}>🔄 Reset</button>
            <button onClick={zoomIn}>➕ Zoom In</button>
          </div>

          {/* Slider */}
          <div style={{ textAlign: "center", marginBottom: "15px" }}>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
            />
            <div style={{ fontSize: "12px", marginTop: "5px" }}>
              Zoom: {(scale * 100).toFixed(0)}%
            </div>
          </div>

          {/* Page navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              marginBottom: "15px",
            }}
          >
            <button onClick={prevPage} disabled={pageNumber <= 1}>
              ⬅ Prev
            </button>
            <span>
              Page{" "}
              <input
                type="number"
                value={pageNumber}
                onChange={jumpToPage}
                min={1}
                max={numPages || 1}
                style={{ width: "50px", textAlign: "center" }}
              />{" "}
              of {numPages || "?"}
            </span>
            <button onClick={nextPage} disabled={pageNumber >= numPages}>
              Next ➡
            </button>
          </div>

          {/* PDF Viewer */}
          {!pdfError && (
            <Document
              file={pdfFile}
              loading={<div style={{ textAlign: "center" }}>🔄 Loading PDF...</div>}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages);
                setPdfError(null);
                setPageNumber(1); // reset to page 1 when new doc loads
              }}
              onLoadError={(error) => {
                console.error("❌ PDF load error:", error);
                setPdfError("PDF preview unavailable");
              }}
            >
              <Page
                pageNumber={pageNumber}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={Math.max(Math.min(containerWidth, 900) * scale, 200)}
              />
            </Document>
          )}
        </div>
      )}
    </div>
  );
}

export default RightPanel;
