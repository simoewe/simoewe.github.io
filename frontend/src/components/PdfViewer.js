import React, { useState } from "react";
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
}) {
  const [uploadStatus, setUploadStatus] = useState("");
  const [fileTypeError, setFileTypeError] = useState("");

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
    disabled: libraryLoading,
    onDropRejected: (rejectedFiles) => {
      const reasons = rejectedFiles
        .map((file) => file.errors.map((err) => err.message).join(", "))
        .join("; ");
      setFileTypeError(`Rejected: ${reasons}`);
    },
  });

  const hasDocuments = documents.length > 0;

  return (
    <div className="right-panel">
      <div
        {...getRootProps({
          className: `dropzone fullsize${libraryLoading ? " dropzone-disabled" : ""}`,
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
              disabled={libraryLoading}
            >
              Select files
            </button>
            {libraryLoading && (
              <p className="dropzone-hint">Loading document from library…</p>
            )}
            {fileTypeError && (
              <p className="dropzone-error">{fileTypeError}</p>
            )}
            {uploadStatus && !fileTypeError && (
              <p className="dropzone-status">{uploadStatus}</p>
            )}
          </div>
        )}
      </div>

      {hasDocuments ? (
        <div className="document-viewer-section">
          <div className="document-list">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`document-item${
                  doc.id === activeDocumentId ? " document-item-active" : ""
                }`}
              >
                <div className="document-item-header">
                  <div>
                    <h4>{doc.name}</h4>
                    <div className="document-item-meta">
                      <span>{doc.sourceType === "library" ? "Library" : "Upload"}</span>
                      {doc.file?.size ? (
                        <span>{formatFileSize(doc.file.size)}</span>
                      ) : null}
                      {doc.status && (
                        <span className={`document-status document-status-${doc.status}`}>
                          {doc.status === "loading"
                            ? "Analyzing…"
                            : doc.status === "success"
                              ? "Ready"
                              : doc.status === "error"
                                ? "Failed"
                                : "Idle"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="document-item-actions">
                    {(doc.viewerSrc || doc.baseViewerUrl || doc.downloadUrl) && (
                      <a
                        href={doc.viewerSrc || doc.baseViewerUrl || doc.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="document-action"
                      >
                        Open
                      </a>
                    )}
                    <button
                      type="button"
                      className="document-action"
                      onClick={() => onSelectDocument?.(doc.id)}
                    >
                      Focus
                    </button>
                    <button
                      type="button"
                      className="document-action document-action-remove"
                      onClick={() => onRemoveDocument?.(doc.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="document-frame-wrapper">
                  <iframe
                    title={`pdf-viewer-${doc.id}`}
                    src={doc.viewerSrc || doc.baseViewerUrl || doc.downloadUrl}
                    key={`${doc.id}:${doc.viewerSrc || doc.baseViewerUrl || ""}`}
                    className="document-frame"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="document-empty">
          <p>No PDFs added yet. Drag files here or use the selection button above.</p>
        </div>
      )}
    </div>
  );
}

export default RightPanel;
