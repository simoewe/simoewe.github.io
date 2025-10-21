import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from "./components/Header";
import RightPanel from "./components/PdfViewer";
import KeywordInput from "./components/Input";
import TextAnalyzer from "./components/TextAnalyzer";
import { getApiBase } from "./utils/apiBase";
import './App.css';
import {
  PanelGroup,
  Panel
} from 'react-resizable-panels';
import {
  DEFAULT_TECHNOLOGY_TERMS,
  GERMAN_TECHNOLOGY_TERMS,
  SPECIALIZED_TECHNOLOGY_TERMS,
} from "./constants/technologies";

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
  const [submittedKeywords, setSubmittedKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const objectUrlMapRef = useRef(new Map());
  const analysisTimersRef = useRef(new Map());
  const [technologyFeedback, setTechnologyFeedback] = useState("");
  const [showKeywordModal, setShowKeywordModal] = useState(false);

  const DEFAULT_ANALYSIS_STEPS = useMemo(() => ([
    { id: 'upload', label: 'Upload & validation' },
    { id: 'extract', label: 'Text extraction' },
    { id: 'analyze', label: 'Trend analysis' },
    { id: 'finalize', label: 'Result preparation' }
  ]), []);

  const createInitialSteps = useCallback(() => (
    DEFAULT_ANALYSIS_STEPS.map((step) => ({ ...step, status: 'pending' }))
  ), [DEFAULT_ANALYSIS_STEPS]);

  const updateDocument = useCallback((docId, updater) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id !== docId) {
          return doc;
        }
        const patch =
          typeof updater === "function"
            ? updater(doc) || {}
            : updater || {};
        if (!patch || Object.keys(patch).length === 0) {
          return doc;
        }
        return { ...doc, ...patch };
      })
    );
  }, []);

  const clearDocumentAnalysisTimers = useCallback((docId) => {
    const timers = analysisTimersRef.current.get(docId);
    if (!timers) {
      return;
    }
    if (timers.interval) {
      clearInterval(timers.interval);
    }
    if (timers.timeouts && timers.timeouts.length) {
      timers.timeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    }
    analysisTimersRef.current.delete(docId);
  }, []);

  const clearAllDocumentTimers = useCallback(() => {
    analysisTimersRef.current.forEach((_, docId) => {
      clearDocumentAnalysisTimers(docId);
    });
  }, [clearDocumentAnalysisTimers]);

  const startDocumentAnalysisIndicators = useCallback((docId) => {
    clearDocumentAnalysisTimers(docId);
    updateDocument(docId, (doc) => ({
      analysisProgress: 5,
      analysisSteps: DEFAULT_ANALYSIS_STEPS.map((step, index) => ({
        ...step,
        status: index === 0 ? "active" : "pending",
      })),
    }));

    const intervalId = setInterval(() => {
      updateDocument(docId, (doc) => {
        const nextProgress = Math.min((doc.analysisProgress || 0) + Math.random() * 5 + 1, 90);
        if (nextProgress === doc.analysisProgress) {
          return null;
        }
        return { analysisProgress: nextProgress };
      });
    }, 800);

    const schedule = [
      { delay: 1600, complete: 'upload', next: 'extract' },
      { delay: 3800, complete: 'extract', next: 'analyze' },
      { delay: 6200, complete: 'analyze', next: 'finalize' }
    ];

    const timeouts = schedule.map(({ delay, complete, next }) =>
      setTimeout(() => {
        updateDocument(docId, (doc) => {
          const steps = (doc.analysisSteps || []).map((step) => {
            if (step.id === complete) {
              return { ...step, status: "completed" };
            }
            if (next && step.id === next && step.status !== "completed") {
              return { ...step, status: "active" };
            }
            return step;
          });
          return { analysisSteps: steps };
        });
      }, delay)
    );

    analysisTimersRef.current.set(docId, {
      interval: intervalId,
      timeouts,
    });
  }, [DEFAULT_ANALYSIS_STEPS, clearDocumentAnalysisTimers, updateDocument]);

  const finishDocumentAnalysisIndicators = useCallback((docId) => {
    clearDocumentAnalysisTimers(docId);
    updateDocument(docId, (doc) => ({
      analysisProgress: 100,
      analysisSteps: (doc.analysisSteps || createInitialSteps()).map((step) => ({
        ...step,
        status: "completed",
      })),
    }));
  }, [clearDocumentAnalysisTimers, createInitialSteps, updateDocument]);

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

  useEffect(() => {
    if (!technologyFeedback) return;
    const timer = setTimeout(() => setTechnologyFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [technologyFeedback]);

  const openKeywordModal = useCallback(() => setShowKeywordModal(true), []);
  const closeKeywordModal = useCallback(() => setShowKeywordModal(false), []);

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

  const handleAddSpecializedTerms = useCallback(
    () => modifyKeywords(SPECIALIZED_TECHNOLOGY_TERMS, "specialized technologies", "add"),
    [modifyKeywords]
  );

  const handleRemoveSpecializedTerms = useCallback(
    () => modifyKeywords(SPECIALIZED_TECHNOLOGY_TERMS, "specialized technologies", "remove"),
    [modifyKeywords]
  );

  useEffect(() => {
    return () => {
      clearAllDocumentTimers();
      objectUrlMapRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      objectUrlMapRef.current.clear();
    };
  }, [clearAllDocumentTimers]);
  const generateDocumentId = useCallback(
    () => `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const handleFilesUpload = useCallback((incomingFiles = []) => {
    const files = Array.from(incomingFiles).filter((file) => file && file.name);
    if (!files.length) {
      return;
    }

    const newDocs = files.map((file) => {
      const id = generateDocumentId();
      const objectUrl = URL.createObjectURL(file);
      objectUrlMapRef.current.set(id, objectUrl);
      return {
        id,
        name: file.name || "document.pdf",
        file,
        sourceType: "local",
        baseViewerUrl: objectUrl,
        viewerSrc: objectUrl,
        downloadUrl: objectUrl,
        objectUrl,
        status: "idle",
        analysisResult: null,
        analysisError: "",
        analysisProgress: 0,
        analysisSteps: createInitialSteps(),
        backendDocumentId: null,
      };
    });

    setDocuments((prev) => [...prev, ...newDocs]);
    setActiveDocumentId(newDocs[newDocs.length - 1].id);
    setError("");
  }, [createInitialSteps, generateDocumentId]);

  const handleRemoveDocument = useCallback((docId) => {
    if (!docId) {
      return;
    }
    setDocuments((prev) => {
      const next = prev.filter((doc) => doc.id !== docId);
      const objectUrl = objectUrlMapRef.current.get(docId);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrlMapRef.current.delete(docId);
      }
      clearDocumentAnalysisTimers(docId);
      setActiveDocumentId((prevActive) => {
        if (prevActive && prevActive !== docId) {
          return prevActive;
        }
        return next.length ? next[next.length - 1].id : null;
      });
      return next;
    });
  }, [clearDocumentAnalysisTimers]);

  const handleDocumentSelection = useCallback((docId) => {
    if (!docId) {
      return;
    }
    setActiveDocumentId(docId);
  }, []);

  const handleLibraryPick = useCallback(async (selection) => {
    const item = typeof selection === "string" ? { url: selection } : selection;
    const url = item?.url;

    if (!url) {
      setError("Selected library item has no download URL.");
      return;
    }

    setLibraryLoading(true);
    setError("");

    try {
      const response = await fetch(url, { mode: "cors" });
      if (!response.ok) {
        throw new Error(`Failed to fetch document (${response.status})`);
      }
      const blob = await response.blob();
      const name =
        item?.name || item?.key?.split("/").pop() || "library-document.pdf";
      const fileFromLibrary = new File([blob], name, {
        type: blob.type || "application/pdf",
      });

      const id = generateDocumentId();
      const libraryDoc = {
        id,
        name,
        file: fileFromLibrary,
        sourceType: "library",
        baseViewerUrl: url,
        viewerSrc: url,
        downloadUrl: url,
        objectUrl: null,
        status: "idle",
        analysisResult: null,
        analysisError: "",
        analysisProgress: 0,
        analysisSteps: createInitialSteps(),
        backendDocumentId: null,
      };

      setDocuments((prev) => [...prev, libraryDoc]);
      setActiveDocumentId(id);
    } catch (fetchErr) {
      console.error("Failed to load library document", fetchErr);
      setError("Failed to load document from library. Please try again.");
    } finally {
      setLibraryLoading(false);
    }
  }, [createInitialSteps, generateDocumentId]);

  const navigateToPdfLocation = useCallback((docIdentifier, page, term) => {
    if (!docIdentifier) {
      return null;
    }

    const targetDoc = documents.find(
      (doc) =>
        doc.backendDocumentId === docIdentifier || doc.id === docIdentifier
    );

    if (!targetDoc) {
      return null;
    }

    const base = (targetDoc.baseViewerUrl || targetDoc.viewerSrc || "").split(
      "#"
    )[0];
    if (!base) {
      return null;
    }

    const params = [];
    if (page) {
      params.push(`page=${page}`);
    }
    if (term) {
      params.push(`search=${encodeURIComponent(term)}`);
    }
    const hash = params.length ? `#${params.join("&")}` : "";
    const nextSrc = `${base}${hash}`;

    updateDocument(targetDoc.id, (doc) => {
      const previousSrc = doc.viewerSrc || base;
      if (previousSrc === nextSrc) {
        const separator = nextSrc.includes("#") ? "&" : "#";
        return { viewerSrc: `${nextSrc}${separator}_tick=${Date.now()}` };
      }
      return { viewerSrc: nextSrc };
    });

    setActiveDocumentId(targetDoc.id);
    return nextSrc;
  }, [documents, updateDocument]);

  const handleSearch = useCallback(async () => {
    if (libraryLoading) {
      setError("Document is still loading. Please wait a moment.");
      return;
    }

    if (!documents.length) {
      setError("Please add at least one PDF to analyze.");
      return;
    }

    const docsReadyForAnalysis = documents.filter((doc) => doc.file);
    if (!docsReadyForAnalysis.length) {
      setError("No analyzable documents found. Upload PDFs again.");
      return;
    }

    setLoading(true);
    setError("");
    setSubmittedKeywords(userKeywordList);

    docsReadyForAnalysis.forEach((doc) => {
      updateDocument(doc.id, {
        status: "loading",
        analysisResult: null,
        analysisError: "",
        analysisProgress: 0,
        analysisSteps: createInitialSteps(),
      });
      startDocumentAnalysisIndicators(doc.id);
    });

    const apiUrl = getApiBase();
    const endpoint = apiUrl ? `${apiUrl}/analyze` : "/analyze";

    const errors = [];

    await Promise.all(
      docsReadyForAnalysis.map(async (doc) => {
        try {
          const formData = new FormData();
          formData.append("file", doc.file);
          formData.append("buzzwords", keywords);

          const res = await fetch(endpoint, {
            method: "POST",
            body: formData,
          });

          const contentType = res.headers.get("content-type") || "";
          if (!contentType.includes("application/json")) {
            const text = await res.text();
            throw new Error(text || `Unexpected response (${res.status})`);
          }
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error || "Analysis request failed.");
          }

          updateDocument(doc.id, {
            status: "success",
            analysisResult: data,
            analysisError: "",
            backendDocumentId: data.document_id || doc.backendDocumentId,
          });
        } catch (err) {
          errors.push(`${doc.name}: ${err.message}`);
          updateDocument(doc.id, {
            status: "error",
            analysisResult: null,
            analysisError: err.message,
          });
        } finally {
          finishDocumentAnalysisIndicators(doc.id);
        }
      })
    );

    if (errors.length) {
      setError(
        `Analysis failed for ${errors.length} document${errors.length === 1 ? "" : "s"}`
      );
    } else {
      setError("");
    }
    setLoading(false);
  }, [
    createInitialSteps,
    documents,
    finishDocumentAnalysisIndicators,
    keywords,
    libraryLoading,
    startDocumentAnalysisIndicators,
    updateDocument,
    userKeywordList,
  ]);

  const totalDocuments = documents.length;
  const analyzingCount = documents.filter((doc) => doc.status === "loading").length;
  const analyzeButtonDisabled = loading || libraryLoading || totalDocuments === 0;
  const analyzeButtonLabel = libraryLoading
    ? "Loading document..."
    : loading
      ? `Analyzing${totalDocuments > 1 ? ` (${analyzingCount}/${totalDocuments})` : "..."}`
      : totalDocuments > 1
        ? "Analyze all"
        : "Analyze";

  return (
    <div className="app">
      <Header
        onPickFromLibrary={handleLibraryPick}
        onOpenKeywords={openKeywordModal}
      />

      {showKeywordModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeKeywordModal}
        >
          <div
            className="modal-card keyword-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="keyword-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header keyword-modal-header">
              <div>
                <h2 id="keyword-modal-title">Keywords</h2>
                <p className="keyword-modal-subtitle">
                  Manage the search terms that steer the document analysis.
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeKeywordModal}
                aria-label="Close keyword manager"
              >
                ×
              </button>
            </div>

            <div className="keyword-modal-body">
              <div className="keyword-modal-grid">
                <section className="keyword-modal-editor">
                  <KeywordInput
                    value={keywords}
                    onChange={handleKeywordsChange}
                  />
                  {technologyFeedback && (
                    <p className="technology-feedback">{technologyFeedback}</p>
                  )}
                </section>

                <aside className="keyword-modal-actions">
                  <h3 className="keyword-modal-actions-title">Quick actions</h3>
                  <p className="keyword-modal-actions-hint">
                    Add curated keyword sets to jump-start your analysis.
                  </p>
                  <div className="technology-action-row">
                    <div className="technology-action-column">
                      <span className="technology-action-label">English search terms</span>
                      <button type="button" onClick={handleAddEnglishTerms}>
                        Add
                      </button>
                      <button type="button" onClick={handleRemoveEnglishTerms}>
                        Remove
                      </button>
                    </div>
                    <div className="technology-action-column">
                      <span className="technology-action-label">German search terms</span>
                      <button type="button" onClick={handleAddGermanTerms}>
                        Add
                      </button>
                      <button type="button" onClick={handleRemoveGermanTerms}>
                        Remove
                      </button>
                    </div>
                    <div className="technology-action-column">
                      <span className="technology-action-label">Specialized technologies</span>
                      <button type="button" onClick={handleAddSpecializedTerms}>
                        Add
                      </button>
                      <button type="button" onClick={handleRemoveSpecializedTerms}>
                        Remove
                      </button>
                    </div>
                  </div>
                </aside>
              </div>

              {error && <div className="keyword-error">{error}</div>}
            </div>
            <div className="keyword-modal-footer">
              <div className="keyword-modal-summary">
                <span>
                  {userKeywordList.length} keyword
                  {userKeywordList.length === 1 ? "" : "s"} selected
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="body">
        <PanelGroup direction="horizontal" autoSaveId="layout">
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content" style={{ height: '100%' }}>
              <div className="inner-container full analysis-panel">
                <div className="analysis-panel-content">
                  <div className="analysis-toolbar">
                    <div className="analysis-toolbar-copy">
                      <h2>Analysis overview</h2>
                      <p>
                        {userKeywordList.length} keyword
                        {userKeywordList.length === 1 ? "" : "s"} active • Manage your focus terms via the Keywords panel.
                      </p>
                    </div>
                    <div className="analysis-toolbar-actions">
                      <button
                        type="button"
                        className="analysis-keyword-button"
                        onClick={openKeywordModal}
                      >
                        Manage keywords
                      </button>
                      <button
                        className="analyze-button"
                        onClick={handleSearch}
                        disabled={analyzeButtonDisabled}
                        title={totalDocuments === 0 ? "Add at least one PDF to run the analysis" : undefined}
                      >
                        {analyzeButtonLabel}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="analysis-error">
                      {error}
                    </div>
                  )}

                  {totalDocuments === 0 ? (
                    <TextAnalyzer
                      analysisResult={null}
                      loading={false}
                      analysisProgress={0}
                      analysisSteps={createInitialSteps()}
                      customKeywords={submittedKeywords}
                      onNavigateToPdf={navigateToPdfLocation}
                    />
                  ) : (
                    <div className="analysis-multi-container">
                      {documents.map((doc) => {
                        const documentIdentifier = doc.backendDocumentId || doc.id;
                        const effectiveResult =
                          doc.status === "success"
                            ? doc.analysisResult
                            : doc.status === "error"
                              ? { error: doc.analysisError }
                              : doc.analysisResult;
                        return (
                          <div
                            key={doc.id}
                            className={`analysis-card${doc.id === activeDocumentId ? " analysis-card-active" : ""}`}
                          >
                            <div className="analysis-card-header">
                              <div>
                                <h3 className="analysis-card-title">{doc.name}</h3>
                                <div className="analysis-card-meta">
                                  <span className="analysis-card-badge">
                                    {doc.sourceType === "library" ? "Library" : "Upload"}
                                  </span>
                                  {doc.status === "loading" && (
                                    <span className="analysis-card-status analysis-card-status-loading">
                                      Analyzing…
                                    </span>
                                  )}
                                  {doc.status === "success" && (
                                    <span className="analysis-card-status analysis-card-status-success">
                                      Ready
                                    </span>
                                  )}
                                  {doc.status === "error" && (
                                    <span className="analysis-card-status analysis-card-status-error">
                                      Failed
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="analysis-card-actions">
                                <button
                                  type="button"
                                  onClick={() => handleDocumentSelection(doc.id)}
                                  className="analysis-card-action"
                                >
                                  Open in viewer
                                </button>
                              </div>
                            </div>
                            <TextAnalyzer
                              analysisResult={effectiveResult}
                              loading={doc.status === "loading"}
                              analysisProgress={doc.analysisProgress || 0}
                              analysisSteps={doc.analysisSteps || []}
                              customKeywords={submittedKeywords}
                              onNavigateToPdf={navigateToPdfLocation}
                              documentId={documentIdentifier}
                              title={doc.name}
                            />
                            {doc.status === "error" && doc.analysisError && (
                              <div className="analysis-card-error">
                                {doc.analysisError}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
          <Panel defaultSize={50} minSize={10}>
            <div className="pane-content">
              <div className="inner-container full">
                <RightPanel
                  documents={documents}
                  activeDocumentId={activeDocumentId}
                  onFilesUpload={handleFilesUpload}
                  onRemoveDocument={handleRemoveDocument}
                  onSelectDocument={handleDocumentSelection}
                  libraryLoading={libraryLoading}
                />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

export default App;
