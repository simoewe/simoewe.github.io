import React, { useState } from 'react';
import Header from "./components/Header";
import RightPanel from "./components/PdfViewer";
import KeywordInput from "./components/Input";
import TextAnalyzer from "./components/TextAnalyzer";
import './App.css';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle
} from 'react-resizable-panels';

function App() {
  const [keywords, setKeywords] = useState("");
  const [file, setFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);

  // File is set from right panel
  const handleFileUpload = (uploadedFile) => {
    setFile(uploadedFile);
  };

  const handleSearch = async () => {
    setLoading(true);
    setError("");
    setAnalysisResult(null);
    if (!file) {
      setError("Please select a file to analyze.");
      setLoading(false);
      return;
    }
    if (!keywords.trim()) {
      setError("Please enter keywords.");
      setLoading(false);
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("buzzwords", keywords);
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
      console.log("API URL used for analyze:", apiUrl); // Debugging line
      const res = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Analysis request failed.");
      const data = await res.json();
      setAnalysisResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Header />

      <div className="body">
        <PanelGroup direction="horizontal" autoSaveId="layout">
          {/* Left panel with vertical splitter */}
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content" style={{ height: '100%' }}>
              <PanelGroup direction="vertical" autoSaveId="layout-vertical">
                <Panel defaultSize={20} minSize={15} maxSize={30}>
                  <div className="inner-container top" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', padding: '8px', overflowY: 'auto' }}>
                    <div style={{ flex: 1, minHeight: '80px', marginBottom: '16px', paddingRight: '2px' }}>
                      <KeywordInput 
                        value={keywords} 
                        onChange={(e) => setKeywords(e.target.value)} 
                      />
                    </div>
                    <div style={{ background: '#fff', zIndex: 2, paddingBottom: '8px', boxShadow: '0 -2px 6px rgba(0,0,0,0.04)' }}>
                      <button 
                        onClick={handleSearch} 
                        style={{ height: '40px', width: '100%' }}
                        disabled={loading}
                      >
                        {loading ? "Analyzing..." : "Analyze"}
                      </button>
                      {error && <div style={{ color: 'red', marginTop: '8px' }}>{error}</div>}
                    </div>
                  </div>
                </Panel>
                <PanelResizeHandle className="custom-handle-vertical" />
                <Panel defaultSize={80} minSize={70}>
                  <div className="inner-container bottom" style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fff' }}>
                    <TextAnalyzer analysisResult={analysisResult} loading={loading} />
                  </div>
                </Panel>
              </PanelGroup>
            </div>
          </Panel>
          {/* Right panel */}
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content">
              <div className="inner-container full">
                {pdfUrl ? (
                  <iframe
                    title="pdf-viewer"
                    src={pdfUrl}
                    style={{ width: "100%", height: "100%", border: "none" }}
                  />
                ) : (
                  <RightPanel onFileUpload={handleFileUpload} />
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default App;
