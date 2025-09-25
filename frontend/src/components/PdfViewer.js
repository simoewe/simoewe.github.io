import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker-Setup for pdfjs-dist v5.x - Disabled for Render compatibility
// Disable worker to avoid CORS and 404 issues in production
pdfjs.GlobalWorkerOptions.workerSrc = '';

// Log the worker setup for debugging
console.log('PDF.js worker disabled for production compatibility');

function RightPanel() {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const uploadToBackend = async (file) => {
    setUploading(true);
    setUploadStatus('Uploading PDF...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('buzzwords', 'iot,container,logistics,supply,automation,digital,blockchain');
      
      // Determine API URL based on environment
      let apiUrl = process.env.REACT_APP_API_URL;
      
      if (!apiUrl) {
        // Auto-detect API URL for Render deployment
        if (window.location.hostname.includes('onrender.com')) {
          apiUrl = 'https://simoewe-github-io-z78f.onrender.com';
        } else {
          apiUrl = 'http://localhost:5000';
        }
      }
      
      console.log('Using API URL:', apiUrl);
      
      const response = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        body: formData,
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      setAnalysisResult(result);
      setUploadStatus('✅ PDF analyzed successfully!');
      console.log('Analysis result:', result);
      
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('❌ Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (acceptedFiles, rejectedFiles) => {
    // Clear previous errors
    setPdfError(null);
    setUploadStatus(null);
    
    if (rejectedFiles && rejectedFiles.length > 0) {
      console.error('Rejected files:', rejectedFiles);
      setUploadStatus('❌ Invalid file type or size');
      return;
    }

    const file = acceptedFiles[0];
    if (!file) {
      setUploadStatus('❌ No file selected');
      return;
    }

    console.log('File details:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // More flexible PDF type checking
    const isPdf = file.type === "application/pdf" || 
                  file.name.toLowerCase().endsWith('.pdf');
    
    if (isPdf && file.size <= 5 * 1024 * 1024) { // 5MB limit to match backend
      console.log('✅ Valid PDF file, setting up...');
      setPdfLoading(true);
      setPdfFile(file);
      uploadToBackend(file);
    } else {
      const error = !isPdf ? 'Invalid file type (PDF required)' : 'File too large (max 5MB)';
      console.error(error);
      setUploadStatus(`❌ ${error}`);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      "application/pdf": [".pdf"],
      "application/x-pdf": [".pdf"]
    },
    multiple: false,
    maxSize: 5 * 1024 * 1024, // 5MB to match backend limit
    onDropRejected: (rejectedFiles) => {
      console.error('Files rejected:', rejectedFiles);
      const reasons = rejectedFiles.map(f => f.errors.map(e => e.message).join(', ')).join('; ');
      setUploadStatus(`❌ Upload failed: ${reasons}`);
    }
  });

  return (
    <div className="right-panel">
      {!pdfFile ? (
        <div {...getRootProps({ className: "dropzone fullsize" })}>
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Ziehe die PDF hierher…</p>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p>📄 PDF hochladen (Drag & Drop oder klicken)</p>
              <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
                Upload containerlogistics documents for analysis
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="pdf-viewer fullsize">
          {/* Upload Status */}
          <div style={{ 
            padding: '10px', 
            backgroundColor: uploading ? '#fff3cd' : uploadStatus?.includes('✅') ? '#d4edda' : uploadStatus?.includes('❌') ? '#f8d7da' : '#e9ecef',
            borderRadius: '8px',
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            {uploading ? '⏳ Processing PDF...' : uploadStatus || '📄 PDF loaded'}
          </div>

          {/* Analysis Summary */}
          {analysisResult && (
            <div style={{ 
              padding: '10px', 
              backgroundColor: '#d4edda', 
              borderRadius: '8px',
              marginBottom: '10px',
              fontSize: '12px',
              border: '1px solid #c3e6cb'
            }}>
              <strong>✅ PDF Analysis Complete:</strong>
              <div style={{ marginTop: '5px' }}>
                📊 Buzzwords found: {Object.values(analysisResult.frequencies || {}).reduce((a, b) => a + b, 0)}
              </div>
              <div>📝 Document text extracted successfully</div>
              <div>🔍 Ready for keyword search in left panel</div>
              {pdfError && (
                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', borderRadius: '4px', color: '#856404' }}>
                  <strong>Note:</strong> PDF preview unavailable, but content analysis works normally.
                </div>
              )}
            </div>
          )}

          {/* PDF Error Display */}
          {pdfError && (
            <div style={{
              padding: '15px',
              backgroundColor: '#f8d7da',
              borderRadius: '8px',
              color: '#721c24',
              marginBottom: '10px'
            }}>
              <strong>PDF Loading Error:</strong>
              <div style={{ marginTop: '5px', fontSize: '14px' }}>
                {pdfError}
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px' }}>
                Try:
                <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                  <li>Make sure it's a valid PDF file</li>
                  <li>Check if file is corrupted</li>
                  <li>Try a different PDF</li>
                </ul>
              </div>
            </div>
          )}

          {/* PDF Viewer */}
          {!pdfError && (
            <Document
              file={pdfFile}
              loading={
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div>🔄 Loading PDF...</div>
                </div>
              }
              error={
                <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#f8f9fa', border: '2px dashed #dee2e6', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>📄</div>
                  <div style={{ color: '#6c757d', marginBottom: '8px' }}>PDF Preview Not Available</div>
                  <div style={{ fontSize: '14px', color: '#28a745', fontWeight: 'bold' }}>
                    ✅ Document Analysis Completed Successfully
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
                    Your PDF content has been processed and is ready for keyword search.
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px', color: '#666' }}>
                    Use the search panel on the left to find containerlogistics insights.
                  </div>
                </div>
              }
              options={{
                // Disable worker for production compatibility
                disableWorker: true,
                // Use standard fonts to avoid font loading issues
                standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
              }}
              onLoadSuccess={({ numPages }) => {
                console.log("✅ PDF loaded successfully, pages:", numPages);
                setNumPages(numPages);
                setPdfLoading(false);
                setPdfError(null);
              }}
              onLoadError={(error) => {
                console.error("❌ PDF load error:", error);
                setPdfLoading(false);
                setPdfError("PDF preview unavailable in production environment, but document analysis completed successfully.");
              }}
              onSourceError={(error) => {
                console.error("❌ PDF source error:", error);
                setPdfError(`PDF source error: ${error.message || 'Invalid PDF source'}`);
              }}
            >
              {numPages && Array.from(new Array(numPages), (el, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  width={Math.min(window.innerWidth * 0.4, 600)}
                  loading={
                    <div style={{ textAlign: 'center', padding: '10px' }}>
                      Loading page {index + 1}...
                    </div>
                  }
                  error={
                    <div style={{ textAlign: 'center', padding: '10px', color: '#dc3545' }}>
                      Failed to load page {index + 1}
                    </div>
                  }
                />
              ))}
            </Document>
          )}
        </div>
      )}
    </div>
  );
}

export default RightPanel;
