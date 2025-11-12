import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from "./components/Header";
import RightPanel from "./components/PdfViewer";
import KeywordInput from "./components/Input";
import TextAnalyzer from "./components/TextAnalyzer";
import LegalNoticeModal from "./components/LegalNoticeModal";
import Footer from "./components/Footer";
import InfoModal from "./components/InfoModal";
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

const KEYWORD_SPLIT_REGEX = /[-_/\s.,!?:()\[\]'"]+/;

const canonicalizeKeyword = (term = "") => {
  if (typeof term !== "string") {
    return "";
  }
  return term
    .toLowerCase()
    .split(KEYWORD_SPLIT_REGEX)
    .filter(Boolean)
    .join(' ')
    .trim();
};

const parseKeywordString = (raw) => {
  if (!raw) return [];
  const seen = new Set();
  const normalizedList = [];
  raw
    .split(',')
    .map((term) => term.trim())
    .forEach((term) => {
      if (!term) {
        return;
      }
      const canonical = canonicalizeKeyword(term);
      if (!canonical || seen.has(canonical)) {
        return;
      }
      seen.add(canonical);
      normalizedList.push(term);
    });
  return normalizedList;
};

const formatKeywordString = (list) => list.join(', ');

function App() {
  const [keywords, setKeywords] = useState(() => formatKeywordString(DEFAULT_TECHNOLOGY_TERMS));
  const [submittedKeywords, setSubmittedKeywords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [error, setError] = useState("");
  const [documents, setDocuments] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const objectUrlMapRef = useRef(new Map());
  const analysisTimersRef = useRef(new Map());
  const pendingUploadsRef = useRef(0);
  const [technologyFeedback, setTechnologyFeedback] = useState("");
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [activeFooterModal, setActiveFooterModal] = useState(null);
  const [uploadPanelTrigger, setUploadPanelTrigger] = useState(0);
  const [fileDialogTrigger, setFileDialogTrigger] = useState(0);
  const [isUploadPanelActive, setIsUploadPanelActive] = useState(true);
  const [wordBudgetDisabled, setWordBudgetDisabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const stored = window.localStorage?.getItem("wordBudgetDisabled");
    return stored === "true";
  });

  const userKeywordList = useMemo(() => parseKeywordString(keywords), [keywords]);

  const analyzableDocuments = useMemo(
    () =>
      documents.filter(
        (doc) => doc.file && doc.status !== "loading"
      ),
    [documents]
  );

  const remainingDocuments = useMemo(
    () =>
      analyzableDocuments.filter(
        (doc) => doc.status !== "success"
      ),
    [analyzableDocuments]
  );

  const hasCompletedDocuments = useMemo(
    () => documents.some((doc) => doc.status === "success"),
    [documents]
  );

  const wordBudgetButtonLabel = wordBudgetDisabled ? "Re-enable word budget" : "Disable word budget";
  const wordBudgetStatusLine = wordBudgetDisabled
    ? "Word & page limits disabled — every page and the full text are processed."
    : "Word & page limits active • Default guard (~120k words & 500 pages) keeps analyses stable.";

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

  const startDocumentAnalysisIndicators = useCallback((docId, runToken) => {
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
      runToken,
    });
  }, [DEFAULT_ANALYSIS_STEPS, clearDocumentAnalysisTimers, updateDocument]);

  const finishDocumentAnalysisIndicators = useCallback((docId, expectedToken) => {
    const timerEntry = analysisTimersRef.current.get(docId);
    if (expectedToken && timerEntry?.runToken && timerEntry.runToken !== expectedToken) {
      return;
    }
    clearDocumentAnalysisTimers(docId);
    updateDocument(docId, (doc) => {
      if (expectedToken && doc.analysisRunToken !== expectedToken) {
        return null;
      }
      return {
        analysisRunToken: null,
        analysisProgress: 100,
        analysisSteps: (doc.analysisSteps || createInitialSteps()).map((step) => ({
          ...step,
          status: "completed",
        })),
      };
    });
  }, [analysisTimersRef, clearDocumentAnalysisTimers, createInitialSteps, updateDocument]);

  const handleRemoveAllDocuments = useCallback(() => {
    setDocuments((prev) => {
      if (!prev.length) {
        return prev;
      }
      prev.forEach((doc) => {
        const objectUrl = objectUrlMapRef.current.get(doc.id);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          objectUrlMapRef.current.delete(doc.id);
        }
      });
      objectUrlMapRef.current.clear();
      return [];
    });
    clearAllDocumentTimers();
    analysisTimersRef.current.clear();
    pendingUploadsRef.current = 0;
    setActiveDocumentId(null);
    setLoading(false);
    setUploadingDocuments(false);
    setError("");
  }, [clearAllDocumentTimers]);

  const analyzeDocuments = useCallback(async (docsToAnalyze = [], {
    clearGlobalError = true,
    snapshotKeywords = false,
  } = {}) => {
    const analyzableDocs = docsToAnalyze.filter((doc) => doc && doc.file);
    if (!analyzableDocs.length) {
      return;
    }

    setLoading(true);
    if (clearGlobalError) {
      setError("");
    }
    if (snapshotKeywords) {
      setSubmittedKeywords(userKeywordList);
    }

    const apiUrl = getApiBase();
    const endpoint = apiUrl ? `${apiUrl}/analyze` : "/analyze";
    const analysisRunTokens = new Map();

    analyzableDocs.forEach((doc) => {
      const runToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      analysisRunTokens.set(doc.id, runToken);
      clearDocumentAnalysisTimers(doc.id);
      updateDocument(doc.id, (current) => ({
        ...current,
        status: "queued",
        analysisResult: null,
        analysisError: "",
        analysisProgress: 0,
        analysisSteps: createInitialSteps(),
        analysisRunToken: runToken,
      }));
    });

    const activateDocument = (doc) => {
      if (!doc) {
        return;
      }
      const runToken = analysisRunTokens.get(doc.id);
      if (!runToken) {
        return;
      }
      clearDocumentAnalysisTimers(doc.id);
      updateDocument(doc.id, (current) => ({
        ...current,
        status: "loading",
        analysisResult: null,
        analysisError: "",
        analysisProgress: 0,
        analysisSteps: createInitialSteps(),
        analysisRunToken: runToken,
      }));
      startDocumentAnalysisIndicators(doc.id, runToken);
    };

    if (analyzableDocs.length > 0) {
      activateDocument(analyzableDocs[0]);
    }

    const errors = [];

    for (let index = 0; index < analyzableDocs.length; index += 1) {
      const doc = analyzableDocs[index];
      const runToken = analysisRunTokens.get(doc.id);

      if (index > 0) {
        activateDocument(doc);
      }
      try {
        const formData = new FormData();
        formData.append("file", doc.file);
        formData.append("buzzwords", keywords);
        formData.append("wordBudgetMode", wordBudgetDisabled ? "disabled" : "default");

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

        updateDocument(doc.id, (current) => {
          if (current.analysisRunToken !== runToken) {
            return null;
          }
          return {
            status: "success",
            analysisResult: data,
            analysisError: "",
            backendDocumentId: data.document_id || current.backendDocumentId,
          };
        });
      } catch (err) {
        let shouldReportError = false;
        updateDocument(doc.id, (current) => {
          if (current.analysisRunToken !== runToken) {
            return null;
          }
          shouldReportError = true;
          return {
            status: "error",
            analysisResult: null,
            analysisError: err.message,
          };
        });
        if (shouldReportError) {
          errors.push(`${doc.name}: ${err.message}`);
        }
      } finally {
        finishDocumentAnalysisIndicators(doc.id, runToken);
      }
    }

    if (errors.length) {
      setError(
        `Analysis failed for ${errors.length} document${errors.length === 1 ? "" : "s"}`
      );
    } else if (clearGlobalError) {
      setError("");
    }

    setLoading(false);
  }, [
    clearDocumentAnalysisTimers,
    createInitialSteps,
    finishDocumentAnalysisIndicators,
    keywords,
    setError,
    setLoading,
    setSubmittedKeywords,
    startDocumentAnalysisIndicators,
    updateDocument,
    userKeywordList,
    wordBudgetDisabled,
  ]);

  const restartDocumentAnalysis = useCallback((docId) => {
    if (!docId) {
      return;
    }
    const targetDoc = documents.find((doc) => doc.id === docId);
    if (!targetDoc) {
      return;
    }
    if (!targetDoc.file) {
      setError("Document data missing. Please re-upload the PDF to analyze again.");
      return;
    }
    analyzeDocuments([targetDoc], {
      clearGlobalError: true,
      snapshotKeywords: true,
    });
  }, [analyzeDocuments, documents, setError]);

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

  const handleToggleWordBudget = useCallback(() => {
    setWordBudgetDisabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          window.localStorage?.setItem("wordBudgetDisabled", String(next));
        } catch (storageError) {
          console.warn("Failed to persist word-budget preference", storageError);
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!technologyFeedback) return;
    const timer = setTimeout(() => setTechnologyFeedback(""), 4000);
    return () => clearTimeout(timer);
  }, [technologyFeedback]);

  const openKeywordModal = useCallback(() => setShowKeywordModal(true), []);
  const closeKeywordModal = useCallback(() => setShowKeywordModal(false), []);
  const openFooterModal = useCallback((type) => {
    setActiveFooterModal(type);
  }, []);
  const closeFooterModal = useCallback(() => setActiveFooterModal(null), []);

  const modifyKeywords = useCallback((terms, label, mode) => {
    if (!Array.isArray(terms) || terms.length === 0) {
      setTechnologyFeedback(`No ${label.toLowerCase()} available.`);
      return;
    }

    let feedbackMessage = "";
    setKeywords((prev) => {
      const current = parseKeywordString(prev);

      if (mode === "add") {
        const seen = new Set(
          current
            .map((term) => canonicalizeKeyword(term))
            .filter(Boolean)
        );
        const next = [...current];
        let added = 0;
        terms.forEach((term) => {
          const trimmed = term.trim();
          if (!trimmed) return;
          const canonical = canonicalizeKeyword(trimmed);
          if (!canonical || seen.has(canonical)) return;
          seen.add(canonical);
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
        terms
          .map((term) => canonicalizeKeyword(term.trim()))
          .filter(Boolean)
      );
      if (!removalSet.size) {
        feedbackMessage = `No ${label.toLowerCase()} available to remove.`;
        return prev;
      }

      const next = current.filter(
        (term) => !removalSet.has(canonicalizeKeyword(term))
      );
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

    pendingUploadsRef.current += 1;
    setUploadingDocuments(true);

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
        analysisRunToken: null,
        backendDocumentId: null,
      };
    });

    setDocuments((prev) => [...prev, ...newDocs]);
    setActiveDocumentId(newDocs[newDocs.length - 1].id);
    setError("");
    const settleUpload = () => {
      pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current - 1);
      if (pendingUploadsRef.current === 0) {
        setUploadingDocuments(false);
      }
    };
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(settleUpload);
    } else {
      setTimeout(settleUpload, 0);
    }
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

  const handleUploadPanelRequest = useCallback(() => {
    if (isUploadPanelActive) {
      setFileDialogTrigger((prev) => prev + 1);
    } else {
      setUploadPanelTrigger((prev) => prev + 1);
    }
  }, [isUploadPanelActive]);

  const handleUploadPanelStateChange = useCallback((isActive) => {
    setIsUploadPanelActive(isActive);
  }, []);

  const handleLibraryPick = useCallback(async (selection) => {
    const rawSelections = Array.isArray(selection) ? selection : [selection];
    const normalizedItems = rawSelections
      .map((item) => (typeof item === "string" ? { url: item } : item))
      .filter((item) => item && item.url);

    if (!normalizedItems.length) {
      setError("No downloadable items were selected from the library.");
      return;
    }

    setLibraryLoading(true);
    setError("");

    try {
      const createdDocs = [];
      const failures = [];

      for (const item of normalizedItems) {
        const url = item.url;
        try {
          const response = await fetch(url, { mode: "cors" });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          const name =
            item?.name ||
            item?.key?.split("/").pop() ||
            url.split("/").pop() ||
            "library-document.pdf";
          const fileFromLibrary = new File([blob], name, {
            type: blob.type || "application/pdf",
          });

          const id = generateDocumentId();
          createdDocs.push({
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
            analysisRunToken: null,
            backendDocumentId: null,
          });
        } catch (fetchErr) {
          console.error("Failed to load library document", fetchErr);
          failures.push(item?.name || item?.key || item?.url || "Unknown item");
        }
      }

      if (createdDocs.length) {
        setDocuments((prev) => [...prev, ...createdDocs]);
        setActiveDocumentId(createdDocs[createdDocs.length - 1].id);
      }

      if (failures.length) {
        setError(
          `Failed to load ${failures.length} item${failures.length === 1 ? "" : "s"} from the library.`
        );
      } else {
        setError("");
      }
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

    const docsReadyForAnalysis = documents.filter(
      (doc) =>
        doc.file &&
        doc.status !== "loading" &&
        doc.status !== "success" &&
        doc.status !== "queued"
    );

    if (!docsReadyForAnalysis.length) {
      setError("No documents left to analyze. Add new PDFs or restart an individual analysis.");
      return;
    }

    await analyzeDocuments(docsReadyForAnalysis, {
      clearGlobalError: true,
      snapshotKeywords: true,
    });
  }, [
    analyzeDocuments,
    documents,
    libraryLoading,
  ]);

  const totalDocuments = documents.length;
  const analyzingCount = documents.filter((doc) => doc.status === "loading").length;
  const processedCount = documents.filter((doc) => doc.status === "success" || doc.status === "error").length;
  const remainingCount = remainingDocuments.length;
  const hasDocsToAnalyze = remainingCount > 0;
  const analyzeButtonDisabled =
    loading ||
    libraryLoading ||
    totalDocuments === 0 ||
    !hasDocsToAnalyze;

  const analyzeButtonLabel = libraryLoading
    ? "Loading document..."
    : loading
      ? `Analyzing${totalDocuments > 1 ? ` (${processedCount}/${totalDocuments})` : "..."}`
      : !hasDocsToAnalyze
        ? (totalDocuments === 0
          ? "Analyze"
          : hasCompletedDocuments
            ? "All analyzed"
            : totalDocuments > 1
              ? "Analyze all"
              : "Analyze")
        : hasCompletedDocuments && totalDocuments > 1
          ? "Analyze remaining"
          : totalDocuments > 1
            ? "Analyze all"
            : "Analyze";

  return (
    <div className="app">
      <Header
        onPickFromLibrary={handleLibraryPick}
        onRequestUpload={handleUploadPanelRequest}
        onRemoveAllSelected={handleRemoveAllDocuments}
        canRemoveAll={documents.length > 0}
      />
      <LegalNoticeModal
        isOpen={activeFooterModal === "legal"}
        onClose={closeFooterModal}
      />
      <InfoModal
        title="About Trendalyze"
        isOpen={activeFooterModal === "about"}
        onClose={closeFooterModal}
      >
        <p>
          Trendalyze is a research prototype that accelerates the review of sustainability, innovation, and
          annual reports. It combines automated extraction, keyword steering, and visual exploration so that
          researchers can surface signals from hundreds of pages in minutes instead of hours.
        </p>
        <p>
          Core capabilities:
        </p>
        <ul>
          <li>Automated PDF parsing with OCR cleaning tailored to corporate disclosures.</li>
          <li>Keyword workbench to fine-tune trend lenses for each analysis session.</li>
          <li>Interactive highlight stream that groups matching passages by theme and sentiment.</li>
          <li>Document library with curated ESG and innovation filings for benchmarking.</li>
        </ul>
        <p>
          The tool is developed at the University of Hamburg as part of the Master Project Stahlbock. We
          continuously extend the corpus and welcome ideas for new sectors, languages, or analytical lenses.
        </p>
      </InfoModal>
      <InfoModal
        title="Terms of Use"
        isOpen={activeFooterModal === "terms"}
        onClose={closeFooterModal}
      >
        <ul>
          <li>Trendalyze is limited to academic research and teaching within the University of Hamburg project team.</li>
          <li>Only documents that are publicly available or explicitly cleared by the rights holder may be uploaded.</li>
          <li>The output is exploratory and must not be used as legal, financial, or investment advice.</li>
          <li>Personal data may only be processed with documented consent; otherwise it must be removed immediately.</li>
          <li>Users are responsible for ensuring they have the right to process every document they add to the system.</li>
          <li>The maintainers may revoke access or delete material that violates these terms without prior notice.</li>
        </ul>
      </InfoModal>
      <InfoModal
        title="Contact"
        isOpen={activeFooterModal === "contact"}
        onClose={closeFooterModal}
      >
        <p>
          Questions, ideas, or bug reports? Send us a note and the project team will respond within two working days.
        </p>
        <p>
          <strong>Project lead:</strong> Simon Laatz<br />
          <strong>Affiliation:</strong> University of Hamburg, Department of Information Systems<br />
          <strong>Office:</strong> Von-Melle-Park 5, 20146 Hamburg<br />
          <strong>Email:</strong>{" "}
          <a href="mailto:simon.laatz@studium.uni-hamburg.de">
            simon.laatz@studium.uni-hamburg.de
          </a>
        </p>
        <p>
          We welcome contributions to the document library, requests for additional analytics, and collaboration
          inquiries from other research groups.
        </p>
      </InfoModal>

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
                  <div className="word-budget-panel">
                    <div className="word-budget-copy">
                      <span className="word-budget-title">Word & page limits</span>
                      <span className="word-budget-status-text">{wordBudgetStatusLine}</span>
                      <p className="word-budget-warning">
                        Disabling both guards removes the word budget and page sampling caps, which can slow down processing or crash on very large PDFs.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="word-budget-button"
                      onClick={handleToggleWordBudget}
                    >
                      {wordBudgetButtonLabel}
                    </button>
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
                                  {doc.status === "queued" && (
                                    <span className="analysis-card-status analysis-card-status-queued">
                                      In queue
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
                                  onClick={() => restartDocumentAnalysis(doc.id)}
                                  className="analysis-card-action"
                                >
                                  Restart analysis
                                </button>
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
                              queued={doc.status === "queued"}
                              analysisProgress={doc.analysisProgress || 0}
                              analysisSteps={doc.analysisSteps || []}
                              customKeywords={submittedKeywords}
                              onNavigateToPdf={navigateToPdfLocation}
                              documentId={documentIdentifier}
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
                  uploadingDocuments={uploadingDocuments}
                  uploadPanelTrigger={uploadPanelTrigger}
                  fileDialogTrigger={fileDialogTrigger}
                  onUploadPanelStateChange={handleUploadPanelStateChange}
                />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
      <Footer onOpenModal={openFooterModal} />
    </div>
  );
}

export default App;
