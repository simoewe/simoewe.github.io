import React, { useState } from "react";
import Library from "./Library";
import { getApiBase } from "../utils/apiBase";
import UHHLogo from "../UHH_Logo.svg";

export default function Header({
  onPickFromLibrary,
  onOpenKeywords,
}) {
  const [showLib, setShowLib] = useState(false);
  const [showCodePrompt, setShowCodePrompt] = useState(false);
  const [libraryAccessGranted, setLibraryAccessGranted] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  const closeLibrary = () => setShowLib(false);

  const handleLibraryClick = () => {
    if (libraryAccessGranted) {
      setShowLib((prev) => !prev);
    } else {
      setCodeInput("");
      setCodeError("");
      setShowCodePrompt(true);
    }
  };

  const closeCodePrompt = () => {
    setShowCodePrompt(false);
    setCodeInput("");
    setCodeError("");
    setVerifyingCode(false);
  };

  const handleCodeSubmit = async (event) => {
    event.preventDefault();
    if (verifyingCode) return;

    const trimmed = codeInput.trim();
    if (!trimmed) {
      setCodeError("Please enter the access code.");
      return;
    }

    if (trimmed.length > 128) {
      setCodeError("Code is too long. Please use a shorter access code.");
      return;
    }

    try {
      setVerifyingCode(true);
      setCodeError("");
      const base = getApiBase();
      const resp = await fetch(
        `${base ? `${base}/verify-visibility-code` : "/verify-visibility-code"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: trimmed }),
        }
      );

      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await resp.text();
        throw new Error(text || `Unexpected response (${resp.status})`);
      }

      const data = await resp.json();

      if (resp.ok && data.valid) {
        setLibraryAccessGranted(true);
        setShowCodePrompt(false);
        setShowLib(true);
        setCodeInput("");
        setCodeError("");
        return;
      }

      if (resp.status === 403 || data.valid === false) {
        setCodeError("Code is invalid. Please try again.");
        return;
      }

      throw new Error(data.error || "Verification failed.");
    } catch (err) {
      setCodeError(err.message || "Verification failed.");
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <header className="header">
      <nav className="navbar">
        <div className="logo">
          <img src={UHHLogo} alt="University of Hamburg logo" className="logo-img" />
          <span className="logo-text">Trendalyze</span>
        </div>

        <ul className="nav-rechts">
          <li>
            <button
              type="button"
              onClick={() => onOpenKeywords && onOpenKeywords()}
            >
              Keywords
            </button>
          </li>
          <li>
            <button onClick={handleLibraryClick}>Library</button>
          </li>
        </ul>
      </nav>

      {showLib && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeLibrary}
        >
          <div
            className="modal-card library-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="library-modal-title">Library</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeLibrary}
                aria-label="Close library"
              >
                ×
              </button>
            </div>
            <div className="library-modal-body">
              <Library
                onSelect={(selection) => {
                  if (onPickFromLibrary && selection && selection.length) {
                    onPickFromLibrary(selection);
                  }
                  closeLibrary();
                }}
                onCancel={() => {
                  closeLibrary();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showCodePrompt && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeCodePrompt}
        >
          <div
            className="modal-card code-entry"
            role="dialog"
            aria-modal="true"
            aria-labelledby="code-prompt-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="code-prompt-title">Access code required</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeCodePrompt}
                aria-label="Close code entry"
              >
                ×
              </button>
            </div>
            <form className="code-form" onSubmit={handleCodeSubmit}>
              {verifyingCode && (
                <div className="code-progress" aria-live="polite">
                  <div className="code-progress-bar">
                    <div className="code-progress-fill" />
                  </div>
                  <p className="code-progress-text">
                    Verifying access code … this may take a moment the first time.
                  </p>
              </div>
              )}
              <label htmlFor="visibility-code">Please enter the access code</label>
              <input
                id="visibility-code"
                type="password"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                autoFocus
                disabled={verifyingCode}
              />
              {codeError && <p className="code-error">{codeError}</p>}
              <div className="code-actions">
                <button type="button" onClick={closeCodePrompt} disabled={verifyingCode}>
                  Cancel
                </button>
                <button type="submit" disabled={verifyingCode}>
                  {verifyingCode ? "Verifying…" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
