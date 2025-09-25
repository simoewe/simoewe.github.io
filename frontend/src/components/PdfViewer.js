import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker-Setup for pdfjs-dist v5.x - Production ready
// Use CDN for reliable worker loading in production
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

// Alternative: Use local worker as fallback
// pdfjs.GlobalWorkerOptions.workerSrc = new URL(
//   'pdfjs-dist/build/pdf.worker.min.js',
//   import.meta.url,
// ).toString();

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
              backgroundColor: '#f8f9fa', 
              borderRadius: '8px',
              marginBottom: '10px',
              fontSize: '12px'
            }}>
              <strong>Analysis Summary:</strong>
              <div style={{ marginTop: '5px' }}>
                📊 Buzzwords found: {Object.values(analysisResult.frequencies || {}).reduce((a, b) => a + b, 0)}
              </div>
              <div>📝 Document processed successfully</div>
              <div>🔍 Ready for keyword search</div>
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
                <div style={{ textAlign: 'center', padding: '20px', color: '#dc3545' }}>
                  <div>❌ Failed to load PDF</div>
                  <div style={{ fontSize: '12px', marginTop: '5px' }}>
                    The PDF file could not be displayed
                  </div>
                </div>
              }
              onLoadSuccess={({ numPages }) => {
                console.log("✅ PDF loaded successfully, pages:", numPages);
                setNumPages(numPages);
                setPdfLoading(false);
                setPdfError(null);
              }}
              onLoadError={(error) => {
                console.error("❌ PDF load error:", error);
                setPdfLoading(false);
                setPdfError(`Failed to load PDF: ${error.message || 'Unknown error'}`);
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
