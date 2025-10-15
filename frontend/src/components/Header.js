import React, { useEffect, useMemo, useState } from "react";
import UHH_Logo from "../UHH_Logo.svg.png";
import Library from "./Library";
import { getApiBase } from "../utils/apiBase";
import KeywordInput from "./Input";
import { DEFAULT_TECHNOLOGY_TERMS, GERMAN_TECHNOLOGY_TERMS } from "../constants/technologies";

export default function Header({
  onPickFromLibrary,
  technologyTerms,
  keywordsValue,
  onKeywordsChange,
}) {
  const [showLib, setShowLib] = useState(false);
  const [showImpressum, setShowImpressum] = useState(false);
  const [showCodePrompt, setShowCodePrompt] = useState(false);
  const [showTechnologies, setShowTechnologies] = useState(false);
  const [libraryAccessGranted, setLibraryAccessGranted] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  const closeLibrary = () => setShowLib(false);

  const {
    englishDefaultTerms = [],
    germanDefaultTerms = [],
    customTerms = [],
  } = technologyTerms || {};

  const uniqueEnglishDefaultTerms = useMemo(
    () => Array.from(new Set(englishDefaultTerms)).sort((a, b) => a.localeCompare(b)),
    [englishDefaultTerms]
  );
  const uniqueGermanDefaultTerms = useMemo(
    () =>
      Array.from(new Set(germanDefaultTerms)).sort((a, b) => a.localeCompare(b)),
    [germanDefaultTerms]
  );
  const uniqueCustomTerms = useMemo(
    () =>
      Array.from(new Set(customTerms.map((term) => term.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [customTerms]
  );
  const [technologyFeedback, setTechnologyFeedback] = useState("");

  useEffect(() => {
    if (!technologyFeedback) return;
    const timeoutId = setTimeout(() => setTechnologyFeedback(""), 4000);
    return () => clearTimeout(timeoutId);
  }, [technologyFeedback]);

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

  const handleKeywordsChange = (eventOrValue) => {
    if (!onKeywordsChange) return;
    if (typeof eventOrValue === "string") {
      onKeywordsChange(eventOrValue);
      return;
    }
    const nextValue = eventOrValue?.target?.value ?? "";
    onKeywordsChange(nextValue);
  };

  const getCurrentKeywords = () =>
    (keywordsValue || "")
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);

  const addTerms = (terms, label) => {
    if (!onKeywordsChange) return;
    const current = getCurrentKeywords();
    const seen = new Set(current.map((term) => term.toLowerCase()));
    let added = 0;

    const next = [...current];
    terms.forEach((term) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      const lowered = trimmed.toLowerCase();
      if (seen.has(lowered)) {
        return;
      }
      seen.add(lowered);
      next.push(trimmed);
      added += 1;
    });

    if (added === 0) {
      setTechnologyFeedback(`No ${label.toLowerCase()} left to add.`);
      return;
    }

    handleKeywordsChange(next.join(", "));
    setTechnologyFeedback(`Added ${added} ${label.toLowerCase()}.`);
  };

  const removeTerms = (terms, label) => {
    if (!onKeywordsChange) return;
    const removalSet = new Set(
      terms.map((term) => term.trim().toLowerCase()).filter(Boolean)
    );
    if (!removalSet.size) {
      setTechnologyFeedback(`No ${label.toLowerCase()} available to remove.`);
      return;
    }

    const current = getCurrentKeywords();
    const next = current.filter((term) => !removalSet.has(term.toLowerCase()));
    const removed = current.length - next.length;

    if (removed === 0) {
      setTechnologyFeedback(`No ${label.toLowerCase()} found to remove.`);
      return;
    }

    handleKeywordsChange(next.join(", "));
    setTechnologyFeedback(`Removed ${removed} ${label.toLowerCase()}.`);
  };

  const handleAddGermanTerms = () => addTerms(GERMAN_TECHNOLOGY_TERMS, "German terms");
  const handleRemoveGermanTerms = () => removeTerms(GERMAN_TECHNOLOGY_TERMS, "German terms");
  const handleAddEnglishTerms = () => addTerms(DEFAULT_TECHNOLOGY_TERMS, "English terms");
  const handleRemoveEnglishTerms = () => removeTerms(DEFAULT_TECHNOLOGY_TERMS, "English terms");

  return (
    <header className="header">
      <nav className="navbar">
        <div className="logo">
          <img src={UHH_Logo} alt="logo" className="logo-img" />
          <span className="logo-text">Project <b>Stahlbock</b></span>
        </div>

        <ul className="nav-rechts">
          <li>
            <button onClick={() => setShowTechnologies(true)}>Technologies</button>
          </li>
          <li>Option</li>
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
                onSelect={(item) => {
                  onPickFromLibrary && onPickFromLibrary(item);
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

      {showTechnologies && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowTechnologies(false)}
        >
          <div
            className="modal-card technologies-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="technologies-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="technologies-title">Technology terms</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowTechnologies(false)}
                aria-label="Close technology overview"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section className="technology-keyword-editor">
                <h3>Keyword editor</h3>
                <KeywordInput
                  value={keywordsValue}
                  onChange={handleKeywordsChange}
                />
                <div className="technology-actions">
                  <div className="technology-action-group">
                    <span className="technology-action-label">Deutsche Suchbegriffe</span>
                    <div className="technology-action-buttons">
                      <button type="button" onClick={handleAddGermanTerms}>
                        Add
                      </button>
                      <button type="button" onClick={handleRemoveGermanTerms}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="technology-action-group">
                    <span className="technology-action-label">Englische Suchbegriffe</span>
                    <div className="technology-action-buttons">
                      <button type="button" onClick={handleAddEnglishTerms}>
                        Add
                      </button>
                      <button type="button" onClick={handleRemoveEnglishTerms}>
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
                {technologyFeedback && <p className="technology-feedback">{technologyFeedback}</p>}
              </section>

              <section>
                <h3>Active English terms</h3>
                {uniqueEnglishDefaultTerms.length > 0 ? (
                  <ul className="technology-list">
                    {uniqueEnglishDefaultTerms.map((term) => (
                      <li key={`default-${term}`}>{term}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No English defaults selected.</p>
                )}
              </section>

              <section>
                <h3>Active German terms</h3>
                {uniqueGermanDefaultTerms.length > 0 ? (
                  <ul className="technology-list">
                    {uniqueGermanDefaultTerms.map((term) => (
                      <li key={`german-${term}`}>{term}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No German defaults selected.</p>
                )}
              </section>

              <section>
                <h3>Custom keywords</h3>
                {uniqueCustomTerms.length > 0 ? (
                  <ul className="technology-list">
                    {uniqueCustomTerms.map((term) => (
                      <li key={`custom-${term}`}>{term}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No additional keywords have been added yet.</p>
                )}
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
