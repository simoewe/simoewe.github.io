import React, { useState } from "react";
import Library from "./Library";
import { getApiBase } from "../utils/apiBase";

export default function Header({
  onPickFromLibrary,
  onOpenKeywords,
}) {
  const [showLib, setShowLib] = useState(false);
  const [showImpressum, setShowImpressum] = useState(false);
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

  const uhhLogoSrc = `${process.env.PUBLIC_URL || ""}/uhh-logo.png`;

  return (
    <header className="header">
      <nav className="navbar">
        <div className="logo">
          <img
            src={uhhLogoSrc}
            alt="University of Hamburg logo"
            className="logo-img"
          />
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
          <li>
            <button onClick={() => setShowImpressum(true)}>Legal notice</button>
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

      {showImpressum && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowImpressum(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="impressum-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="impressum-title">Legal notice (Sec. 5 DDG)</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowImpressum(false)}
                aria-label="Close legal notice"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section>
                <h3>Project information</h3>
                <p>
                  <strong>Project name:</strong> Master Project Stahlbock<br />
                  <strong>Host institution:</strong> University of Hamburg Business School, Department of Information Systems<br />
                  <strong>Address:</strong> Von-Melle-Park 5, 20146 Hamburg
                </p>
              </section>

              <section>
                <h3>Contact</h3>
                <p>
                  <strong>Contact person:</strong> Simon Laatz<br />
                  <strong>Email:</strong>{" "}
                  <a href="mailto:simon.laatz@studium.uni-hamburg.de">
                    simon.laatz@studium.uni-hamburg.de
                  </a>
                </p>
              </section>

              <section>
                <h3>Responsible under Sec. 18(2) MStV</h3>
                <p>
                  Simon Laatz<br />
                  [ggf. Adresse]
                </p>
              </section>

              <section>
                <h3>Liability for content</h3>
                <p>
                  The content of this website has been prepared with great care. Nevertheless, we cannot
                  guarantee that the information is accurate, complete, or up to date. The web tool is provided
                  solely for academic research and teaching purposes within a university project. Commercial use
                  is excluded.
                </p>
              </section>

              <section>
                <h3>Use of documents</h3>
                <p>
                  This project collects publicly available corporate reports and processes them in a restricted,
                  non-public cloud environment. Access is limited to project participants. The documents are not
                  published or redistributed. All copyrights and usage rights remain with the respective
                  companies or publishers. If rights holders object to the use within this project, please let us
                  know. The affected materials will be removed immediately.
                </p>
              </section>

              <section>
                <h3>Liability for external links</h3>
                <p>
                  This website contains links to external third-party websites over whose content we have no
                  control. Therefore, we cannot assume liability for this external content. The respective
                  provider or operator of the linked pages is always responsible for their content.
                </p>
              </section>

              <section>
                <h3>Data protection</h3>
                <p>
                  This project processes only documents that are already publicly accessible. Should personal
                  data inadvertently be included, it will not be further processed and will be removed upon
                  request. Further information on data protection: <a href="#">[Link to a potential privacy policy]</a>
                </p>
              </section>

              <section>
                <h3>Non-commercial purpose</h3>
                <p>
                  This web tool is part of a university research project and serves academic purposes only.
                  Commercial use, reproduction, or redistribution of the documents processed within the project
                  is not permitted.
                </p>
              </section>
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
