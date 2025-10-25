import React from "react";

export default function InfoModal({ title, isOpen, onClose, children }) {
  if (!isOpen) {
    return null;
  }

  const modalTitleId = `info-modal-title-${String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={modalTitleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id={modalTitleId}>{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
