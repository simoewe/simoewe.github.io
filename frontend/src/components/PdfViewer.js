import React, { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes)) {
    return "";
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
};

function RightPanel({
  documents = [],
  activeDocumentId,
  onFilesUpload,
  onRemoveDocument,
  onSelectDocument,
  libraryLoading = false,
  uploadingDocuments = false,
}) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [fileTypeError, setFileTypeError] = useState("");
  const [activeTab, setActiveTab] = useState("upload");
  const dropzoneDisabled = libraryLoading || uploadingDocuments;

  useEffect(() => {
    if (!documents.length) {
      setActiveTab("upload");
      return;
    }

    if (activeDocumentId && documents.some((doc) => doc.id === activeDocumentId)) {
      setActiveTab(activeDocumentId);
      return;
    }

    setActiveTab((current) => {
      if (current !== "upload" && documents.some((doc) => doc.id === current)) {
        return current;
      }
      return documents[documents.length - 1]?.id || "upload";
    });
  }, [documents, activeDocumentId]);

  const handleDrop = (acceptedFiles, rejectedFiles) => {
    setFileTypeError("");
    setUploadStatus("");

    if (rejectedFiles && rejectedFiles.length > 0) {
      const reasons = rejectedFiles
        .map((file) => file.errors.map((err) => err.message).join(", "))
        .join("; ");
      setFileTypeError(`Rejected: ${reasons}`);
    }

    if (!acceptedFiles || !acceptedFiles.length) {
      return;
    }

    const pdfFiles = acceptedFiles.filter((file) => {
      const name = file.name?.toLowerCase() || "";
      return (
        file.type === "application/pdf" ||
        name.endsWith(".pdf")
      );
    });

    if (!pdfFiles.length) {
      setUploadStatus("No valid PDF documents detected.");
      return;
    }

    if (typeof onFilesUpload === "function") {
      onFilesUpload(pdfFiles);
    }

    setUploadStatus(
      `Added ${pdfFiles.length} PDF${pdfFiles.length === 1 ? "" : "s"}`
    );
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    accept: { "application/pdf": [".pdf"], "application/x-pdf": [".pdf"] },
    multiple: true,
    disabled: dropzoneDisabled,
    onDropRejected: (rejectedFiles) => {
      const reasons = rejectedFiles
        .map((file) => file.errors.map((err) => err.message).join(", "))
        .join("; ");
      setFileTypeError(`Rejected: ${reasons}`);
    },
  });

  const hasDocuments = documents.length > 0;
  const activeDocument =
    activeTab !== "upload"
      ? documents.find((doc) => doc.id === activeTab)
      : null;

  const handleSelectUpload = () => setActiveTab("upload");

  const handleSelectDocumentTab = (docId) => {
    setActiveTab(docId);
    onSelectDocument?.(docId);
  };

  const handleRemoveDocumentTab = (event, docId) => {
    event.stopPropagation();
    event.preventDefault();
    if (typeof onRemoveDocument === "function") {
      onRemoveDocument(docId);
    }
    if (activeTab === docId) {
      setActiveTab("upload");
    }
  };

  const renderUploadArea = () => (
    <div
      {...getRootProps({
        className: `dropzone viewer-upload${
          dropzoneDisabled ? " dropzone-disabled" : ""
        }`,
      })}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p>Drop PDFs here…</p>
      ) : (
        <div className="dropzone-inner">
          <p className="dropzone-title">📄 Add PDFs (drag & drop or click)</p>
          <p className="dropzone-subtitle">
            Upload one or multiple documents to compare them side by side.
          </p>
          <button
            type="button"
            className="dropzone-button"
            onClick={open}
            disabled={dropzoneDisabled}
          >
            Select files
          </button>
          {libraryLoading && (
            <p className="dropzone-hint">Loading document from library…</p>
          )}
          {!libraryLoading && uploadingDocuments && (
            <p className="dropzone-hint">Uploading documents…</p>
          )}
          {fileTypeError && <p className="dropzone-error">{fileTypeError}</p>}
          {uploadStatus && !fileTypeError && (
            <p className="dropzone-status">{uploadStatus}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderActiveDocument = () => {
    if (!activeDocument) {
      return (
        <div className="viewer-message">
          <p>No document selected. Choose one from the tabs above.</p>
        </div>
      );
    }

    const statusLabel =
      activeDocument.status === "loading"
        ? "Analyzing…"
        : activeDocument.status === "success"
          ? "Ready"
          : activeDocument.status === "error"
            ? "Failed"
            : "Idle";
    const viewerSource =
      activeDocument.viewerSrc ||
      activeDocument.baseViewerUrl ||
      activeDocument.downloadUrl;

    return (
      <div className="viewer-document">
        <div className="viewer-document-header">
          <div>
            <h3 className="viewer-document-title">{activeDocument.name}</h3>
            <div className="viewer-document-meta">
              <span className="viewer-pill">
                {activeDocument.sourceType === "library" ? "Library" : "Upload"}
              </span>
              {activeDocument.file?.size ? (
                <span className="viewer-pill">
                  {formatFileSize(activeDocument.file.size)}
                </span>
              ) : null}
              <span className={`viewer-status viewer-status-${activeDocument.status || "idle"}`}>
                {statusLabel}
              </span>
            </div>
            {activeDocument.status === "error" && activeDocument.analysisError && (
              <div className="viewer-document-warning">{activeDocument.analysisError}</div>
            )}
          </div>
          <div className="viewer-document-actions">
            {viewerSource && (
              <a
                href={viewerSource}
                target="_blank"
                rel="noreferrer"
                className="viewer-action"
              >
                Open
              </a>
            )}
            <button
              type="button"
              className="viewer-action viewer-action-remove"
              onClick={() => onRemoveDocument?.(activeDocument.id)}
            >
              Remove
            </button>
          </div>
        </div>
        <div className="viewer-frame-wrapper">
          {viewerSource ? (
            <iframe
              title={`pdf-viewer-${activeDocument.id}`}
              src={viewerSource}
              key={`${activeDocument.id}:${viewerSource}`}
              className="viewer-frame"
            />
          ) : (
            <div className="viewer-message">
              <p>PDF preview unavailable.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="right-panel">
      <div className="viewer-tab-bar">
        <button
          type="button"
          className={`viewer-tab${activeTab === "upload" ? " viewer-tab-active" : ""}`}
          onClick={handleSelectUpload}
        >
          Upload
        </button>
        {documents.map((doc) => (
          <button
            key={doc.id}
            type="button"
            className={`viewer-tab${activeTab === doc.id ? " viewer-tab-active" : ""}`}
            onClick={() => handleSelectDocumentTab(doc.id)}
            title={doc.name}
          >
            <span className="viewer-tab-label">{doc.name}</span>
            <span
              className={`viewer-tab-remove viewer-status-${doc.status || "idle"}`}
              title="Remove document"
              aria-hidden="true"
              onClick={(event) => handleRemoveDocumentTab(event, doc.id)}
            >
              ×
            </span>
          </button>
        ))}
      </div>

      <div className="viewer-body">
        {activeTab === "upload" || !hasDocuments
          ? renderUploadArea()
          : renderActiveDocument()}
        {(libraryLoading || uploadingDocuments) && (
          <div className="viewer-loading-overlay" role="status" aria-live="polite">
            <div className="viewer-spinner" aria-hidden="true" />
            <p className="viewer-loading-text">
              {libraryLoading ? "Loading document from library…" : "Uploading documents…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RightPanel;
