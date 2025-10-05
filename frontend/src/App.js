import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from "./components/Header";
import RightPanel from "./components/PdfViewer";
import KeywordInput from "./components/Input";
import TextAnalyzer from "./components/TextAnalyzer";
import { getApiBase } from "./utils/apiBase";
import './App.css';
import {
  PanelGroup,
  Panel,
  PanelResizeHandle
} from 'react-resizable-panels';
import { DEFAULT_TECHNOLOGY_TERMS } from "./constants/technologies";

function App() {
  const [keywords, setKeywords] = useState("");
  const [file, setFile] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [submittedKeywords, setSubmittedKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfViewerSrc, setPdfViewerSrc] = useState(null);
  const localPdfUrlRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const stepTimeoutsRef = useRef([]);

  const DEFAULT_ANALYSIS_STEPS = useMemo(() => ([
    { id: 'upload', label: 'Upload & validation' },
    { id: 'extract', label: 'Text extraction' },
    { id: 'analyze', label: 'Trend analysis' },
    { id: 'finalize', label: 'Result preparation' }
  ]), []);
  const [analysisSteps, setAnalysisSteps] = useState(() =>
    DEFAULT_ANALYSIS_STEPS.map((step) => ({ ...step, status: 'pending' }))
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);

  const clearAnalysisTimers = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (stepTimeoutsRef.current.length) {
      stepTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      stepTimeoutsRef.current = [];
    }
  }, []);

  const advanceStep = useCallback((completedId, nextId) => {
    setAnalysisSteps((prev) =>
      prev.map((step) => {
        if (step.id === completedId) {
          return { ...step, status: 'completed' };
        }
        if (nextId && step.id === nextId && step.status !== 'completed') {
          return { ...step, status: 'active' };
        }
        return step;
      })
    );
  }, []);

  const startAnalysisIndicators = useCallback(() => {
    clearAnalysisTimers();
    setAnalysisProgress(5);
    setAnalysisSteps(
      DEFAULT_ANALYSIS_STEPS.map((step, index) => ({
        ...step,
        status: index === 0 ? 'active' : 'pending'
      }))
    );

    progressIntervalRef.current = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return prev;
        const increment = Math.random() * 5 + 1;
        return Math.min(prev + increment, 90);
      });
    }, 800);

    const schedule = [
      { delay: 1600, complete: 'upload', next: 'extract' },
      { delay: 3800, complete: 'extract', next: 'analyze' },
      { delay: 6200, complete: 'analyze', next: 'finalize' }
    ];

    stepTimeoutsRef.current = schedule.map(({ delay, complete, next }) =>
      setTimeout(() => advanceStep(complete, next), delay)
    );
  }, [DEFAULT_ANALYSIS_STEPS, advanceStep, clearAnalysisTimers]);

  const finishAnalysisIndicators = useCallback(() => {
    clearAnalysisTimers();
    setAnalysisProgress(100);
    setAnalysisSteps((prev) => prev.map((step) => ({ ...step, status: 'completed' })));
  }, [clearAnalysisTimers]);

  const userKeywordList = useMemo(
    () =>
      keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    [keywords]
  );

  useEffect(() => {
    return () => {
      if (localPdfUrlRef.current) {
        URL.revokeObjectURL(localPdfUrlRef.current);
        localPdfUrlRef.current = null;
      }
      clearAnalysisTimers();
    };
  }, [clearAnalysisTimers]);

  // File is set from right panel
  const handleFileUpload = (uploadedFile) => {
    if (localPdfUrlRef.current) {
      URL.revokeObjectURL(localPdfUrlRef.current);
      localPdfUrlRef.current = null;
    }

    if (!uploadedFile) {
      setFile(null);
      setPdfUrl(null);
      setPdfViewerSrc(null);
      return;
    }

    const objectUrl = URL.createObjectURL(uploadedFile);
    localPdfUrlRef.current = objectUrl;

    setPdfUrl(objectUrl);
    setPdfViewerSrc(objectUrl);
    setFile(uploadedFile);
    setAnalysisResult(null);
    setError("");
    setLibraryLoading(false);
  };

  const handleLibraryPick = async (selection) => {
    if (localPdfUrlRef.current) {
      URL.revokeObjectURL(localPdfUrlRef.current);
      localPdfUrlRef.current = null;
    }

    const item = typeof selection === "string" ? { url: selection } : selection;
    const url = item?.url;

    if (!url) {
      setError("Selected library item has no download URL.");
      return;
    }

    setLibraryLoading(true);
    setPdfUrl(url);
    setPdfViewerSrc(url);
    setFile(null);
    setAnalysisResult(null);
    setError("");

    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`Failed to fetch document (${response.status})`);
      }
      const blob = await response.blob();
      const name = item?.name || item?.key?.split("/").pop() || "library-document.pdf";
      const fileFromLibrary = new File([blob], name, {
        type: blob.type || "application/pdf"
      });
      setFile(fileFromLibrary);
    } catch (fetchErr) {
      console.error("Failed to load library document", fetchErr);
      setError("Failed to load document from library. Please try again.");
      setPdfUrl(null);
      setPdfViewerSrc(null);
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleBackToUpload = () => {
    if (localPdfUrlRef.current) {
      URL.revokeObjectURL(localPdfUrlRef.current);
      localPdfUrlRef.current = null;
    }
    setPdfUrl(null);
    setPdfViewerSrc(null);
  };

  const navigateToPdfLocation = useCallback((page, term) => {
    if (!pdfUrl) {
      return null;
    }
    const base = pdfUrl.split('#')[0];
    const params = [];
    if (page) {
      params.push(`page=${page}`);
    }
    if (term) {
      params.push(`search=${encodeURIComponent(term)}`);
    }
    const hash = params.length ? `#${params.join('&')}` : '';
    const nextSrc = `${base}${hash}`;
    setPdfViewerSrc((prev) => {
      if (prev === nextSrc) {
        const separator = nextSrc.includes('#') ? '&' : '#';
        const reloadMarker = `${nextSrc}${separator}_tick=${Date.now()}`;
        return reloadMarker;
      }
      return nextSrc;
    });
    return nextSrc;
  }, [pdfUrl]);

  const handleSearch = async () => {
    if (libraryLoading) {
      setError("Document is still loading. Please wait a moment.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysisResult(null);
    setSubmittedKeywords(userKeywordList);
    if (!file) {
      setError("Please select a file to analyze.");
      setLoading(false);
      return;
    }
    startAnalysisIndicators();
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("buzzwords", keywords);
      const apiUrl = getApiBase();
      console.log("API URL used for analyze:", apiUrl || "(same origin)"); // Debugging line
      const res = await fetch(`${apiUrl ? `${apiUrl}/analyze` : "/analyze"}`, {
        method: "POST",
        body: formData,
      });
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await res.text();
        throw new Error(text || `Unexpected response (${res.status})`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis request failed.");
      if (data.error) throw new Error(data.error);
      setAnalysisResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      finishAnalysisIndicators();
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Header
        onPickFromLibrary={handleLibraryPick}
        technologyTerms={{
          defaultTerms: DEFAULT_TECHNOLOGY_TERMS,
          customTerms: userKeywordList
        }}
      />

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
                    <div className="analyze-footer">
                      <button 
                        onClick={handleSearch} 
                        style={{ height: '40px', width: '100%' }}
                        disabled={loading || libraryLoading}
                      >
                        {libraryLoading ? "Loading document..." : loading ? "Analyzing..." : "Analyze"}
                      </button>
                      {error && <div style={{ color: 'red', marginTop: '8px' }}>{error}</div>}
                    </div>
                  </div>
                </Panel>
                <PanelResizeHandle className="custom-handle-vertical" />
                <Panel defaultSize={80} minSize={70}>
                  <div className="inner-container bottom analysis-panel">
                    <div className="analysis-panel-content">
                      <TextAnalyzer
                        analysisResult={analysisResult}
                        loading={loading}
                        analysisProgress={analysisProgress}
                        analysisSteps={analysisSteps}
                        customKeywords={submittedKeywords}
                        pdfUrl={pdfUrl}
                        onNavigateToPdf={navigateToPdfLocation}
                      />
                    </div>
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
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <button onClick={handleBackToUpload}>Back to upload view</button>
                      <a href={pdfUrl} target="_blank" rel="noreferrer">
                        Open in new tab
                      </a>
                    </div>
                    <iframe
                      title="pdf-viewer"
                      src={pdfViewerSrc || pdfUrl}
                      key={pdfViewerSrc || pdfUrl || 'pdf-viewer'}
                      style={{ flex: 1, width: "100%", border: "none" }}
                    />
                  </div>
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
