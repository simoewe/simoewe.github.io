import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker-Setup (korrekt für pdfjs-dist v5.x)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

function RightPanel() {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const uploadToBackend = async (file) => {
    setUploading(true);
    setUploadStatus('Uploading PDF...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('buzzwords', 'iot,container,logistics,supply,automation,digital,blockchain');
      
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        body: formData,
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

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file); // direkt File an react-pdf übergeben
      uploadToBackend(file); // Upload to backend for analysis
    } else {
      console.error("Keine gültige PDF-Datei hochgeladen.");
      setUploadStatus('❌ Invalid file type');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
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

          {/* PDF Viewer */}
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => {
              console.log("✅ PDF geladen, Seiten:", numPages);
              setNumPages(numPages);
            }}
            onLoadError={(err) =>
              console.error("❌ PDF Ladefehler:", err.message, err)
            }
          >
            {Array.from(new Array(numPages), (el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                width={Math.min(window.innerWidth * 0.4, 600)}
              />
            ))}
          </Document>
        </div>
      )}
    </div>
  );
}

export default RightPanel;
