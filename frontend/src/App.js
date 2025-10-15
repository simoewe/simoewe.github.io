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
import { DEFAULT_TECHNOLOGY_TERMS, GERMAN_TECHNOLOGY_TERMS } from "./constants/technologies";

const parseKeywordString = (raw) => {
  if (!raw) return [];
  const seen = new Set();
  return raw
    .split(',')
    .map((term) => term.trim())
    .filter((term) => {
      if (!term) return false;
      const lowered = term.toLowerCase();
      if (seen.has(lowered)) return false;
      seen.add(lowered);
      return true;
    });
};

const formatKeywordString = (list) => list.join(', ');

function App() {
  const [keywords, setKeywords] = useState(() => formatKeywordString(DEFAULT_TECHNOLOGY_TERMS));
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
  const [technologyFeedback, setTechnologyFeedback] = useState("");

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

  const handleKeywordsChange = useCallback((input) => {
    const raw =
      typeof input === "string"
        ? input
        : typeof input === "object"
          ? input?.target?.value || ""
          : "";
    const normalized = parseKeywordString(raw);
    setKeywords(formatKeywordString(normalized));
    setTechnologyFeedback("");
  }, []);

  const userKeywordList = useMemo(() => parseKeywordString(keywords), [keywords]);

  const keywordSet = useMemo(
    () => new Set(userKeywordList.map((term) => term.toLowerCase())),
    [userKeywordList]
  );

  const englishDefaultSet = useMemo(
    () => new Set(DEFAULT_TECHNOLOGY_TERMS.map((term) => term.toLowerCase())),
    []
  );

  const germanDefaultSet = useMemo(
    () => new Set(GERMAN_TECHNOLOGY_TERMS.map((term) => term.toLowerCase())),
    []
  );

  const activeEnglishDefaults = useMemo(
    () => DEFAULT_TECHNOLOGY_TERMS.filter((term) => keywordSet.has(term.toLowerCase())),
    [keywordSet]
  );

  const activeGermanDefaults = useMemo(
    () => GERMAN_TECHNOLOGY_TERMS.filter((term) => keywordSet.has(term.toLowerCase())),
    [keywordSet]
  );

  const customKeywordList = useMemo(
    () =>
      userKeywordList.filter((term) => {
        const lowered = term.toLowerCase();
        return !englishDefaultSet.has(lowered) && !germanDefaultSet.has(lowered);
      }),
    [englishDefaultSet, germanDefaultSet, userKeywordList]
  );

  const technologyTerms = useMemo(
    () => ({
      englishDefaultTerms: activeEnglishDefaults,
      germanDefaultTerms: activeGermanDefaults,
      customTerms: customKeywordList,
    }),
    [activeEnglishDefaults, activeGermanDefaults, customKeywordList]
  );

  useEffect(() => {
    if (!technologyFeedback) return;
    const timer = setTimeout(() => setTechnologyFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [technologyFeedback]);

  const modifyKeywords = useCallback((terms, label, mode) => {
    if (!Array.isArray(terms) || terms.length === 0) {
      setTechnologyFeedback(`No ${label.toLowerCase()} available.`);
      return;
    }

    let feedbackMessage = "";
    setKeywords((prev) => {
      const current = parseKeywordString(prev);

      if (mode === "add") {
        const seen = new Set(current.map((term) => term.toLowerCase()));
        const next = [...current];
        let added = 0;
        terms.forEach((term) => {
          const trimmed = term.trim();
          if (!trimmed) return;
          const lowered = trimmed.toLowerCase();
          if (seen.has(lowered)) return;
          seen.add(lowered);
          next.push(trimmed);
          added += 1;
        });

        if (!added) {
          feedbackMessage = `No ${label.toLowerCase()} left to add.`;
          return prev;
        }

        feedbackMessage = `Added ${added} ${label.toLowerCase()}.`;
        return formatKeywordString(next);
      }

      const removalSet = new Set(
        terms.map((term) => term.trim().toLowerCase()).filter(Boolean)
      );
      if (!removalSet.size) {
        feedbackMessage = `No ${label.toLowerCase()} available to remove.`;
        return prev;
      }

      const next = current.filter((term) => !removalSet.has(term.toLowerCase()));
      const removed = current.length - next.length;
      if (!removed) {
        feedbackMessage = `No ${label.toLowerCase()} found to remove.`;
        return prev;
      }

      feedbackMessage = `Removed ${removed} ${label.toLowerCase()}.`;
      return formatKeywordString(next);
    });
    setTechnologyFeedback(feedbackMessage);
  }, []);

  const handleAddGermanTerms = useCallback(
    () => modifyKeywords(GERMAN_TECHNOLOGY_TERMS, "German terms", "add"),
    [modifyKeywords]
  );

  const handleRemoveGermanTerms = useCallback(
    () => modifyKeywords(GERMAN_TECHNOLOGY_TERMS, "German terms", "remove"),
    [modifyKeywords]
  );

  const handleAddEnglishTerms = useCallback(
    () => modifyKeywords(DEFAULT_TECHNOLOGY_TERMS, "English terms", "add"),
    [modifyKeywords]
  );

  const handleRemoveEnglishTerms = useCallback(
    () => modifyKeywords(DEFAULT_TECHNOLOGY_TERMS, "English terms", "remove"),
    [modifyKeywords]
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
                      <div className="technology-management">
                        <section className="technology-keyword-editor">
                          <div className="technology-editor-header">
                            <h3>Keyword editor</h3>
                            <span className="technology-editor-count">Total: {userKeywordList.length}</span>
                          </div>
                          <KeywordInput
                            value={keywords}
                            onChange={handleKeywordsChange}
                          />
                          <div className="technology-actions">
                            <div className="technology-action-group">
                              <span className="technology-action-label">English search terms</span>
                              <div className="technology-action-buttons">
                                <button type="button" onClick={handleAddEnglishTerms}>
                                  Add
                                </button>
                                <button type="button" onClick={handleRemoveEnglishTerms}>
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="technology-action-group">
                              <span className="technology-action-label">German search terms</span>
                              <div className="technology-action-buttons">
                                <button type="button" onClick={handleAddGermanTerms}>
                                  Add
                                </button>
                                <button type="button" onClick={handleRemoveGermanTerms}>
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                          {technologyFeedback && (
                            <p className="technology-feedback">{technologyFeedback}</p>
                          )}
                        </section>

                        <div className="technology-overview">
                          <section className="technology-overview-block">
                            <h4>Active English terms</h4>
                            {technologyTerms.englishDefaultTerms.length ? (
                              <ul className="technology-list">
                                {technologyTerms.englishDefaultTerms.map((term) => (
                                  <li key={`english-${term}`}>{term}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="technology-empty">No English defaults selected.</p>
                            )}
                          </section>
                          <section className="technology-overview-block">
                            <h4>Active German terms</h4>
                            {technologyTerms.germanDefaultTerms.length ? (
                              <ul className="technology-list">
                                {technologyTerms.germanDefaultTerms.map((term) => (
                                  <li key={`german-${term}`}>{term}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="technology-empty">No German defaults selected.</p>
                            )}
                          </section>
                          <section className="technology-overview-block">
                            <h4>Custom keywords</h4>
                            {technologyTerms.customTerms.length ? (
                              <ul className="technology-list">
                                {technologyTerms.customTerms.map((term) => (
                                  <li key={`custom-${term}`}>{term}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="technology-empty">No additional keywords added.</p>
                            )}
                          </section>
                        </div>

                        <section className="analysis-term-card">
                          <div className="analysis-term-header">
                            <h3>All analysis terms</h3>
                            <span className="analysis-term-count">Total: {userKeywordList.length}</span>
                          </div>
                          {userKeywordList.length > 0 ? (
                            <ul className="technology-list columns analysis-term-list">
                              {userKeywordList.map((keyword) => (
                                <li key={`analysis-${keyword}`}>{keyword}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="analysis-term-empty">
                              No analysis terms selected yet.
                            </p>
                          )}
                          <p className="analysis-term-hint">
                            Manage analysis terms with the controls above.
                          </p>
                        </section>
                      </div>
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
