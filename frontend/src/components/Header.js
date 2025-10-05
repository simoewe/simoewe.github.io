import React, { useMemo, useState } from "react";
import UHH_Logo from "../UHH_Logo.svg.png";
import Library from "./Library";
import { getApiBase } from "../utils/apiBase";

export default function Header({ onPickFromLibrary, technologyTerms }) {
  const [showLib, setShowLib] = useState(false);
  const [showImpressum, setShowImpressum] = useState(false);
  const [showCodePrompt, setShowCodePrompt] = useState(false);
  const [showTechnologies, setShowTechnologies] = useState(false);
  const [libraryAccessGranted, setLibraryAccessGranted] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);

  const closeLibrary = () => setShowLib(false);

  const { defaultTerms = [], customTerms = [] } = technologyTerms || {};
  const uniqueDefaultTerms = useMemo(
    () => Array.from(new Set(defaultTerms)).sort((a, b) => a.localeCompare(b)),
    [defaultTerms]
  );
  const uniqueCustomTerms = useMemo(
    () =>
      Array.from(new Set(customTerms.map((term) => term.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [customTerms]
  );
  const combinedTerms = useMemo(
    () =>
      Array.from(
        new Set([...uniqueDefaultTerms, ...uniqueCustomTerms].map((term) => term.trim()))
      ).sort((a, b) => a.localeCompare(b)),
    [uniqueDefaultTerms, uniqueCustomTerms]
  );

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
      setCodeError("Bitte Zugangscode eingeben.");
      return;
    }

    if (trimmed.length > 128) {
      setCodeError("Code ist zu lang. Bitte kürzeren Zugangscode verwenden.");
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
        setCodeError("Code ist ungültig. Bitte erneut versuchen.");
        return;
      }

      throw new Error(data.error || "Verifikation fehlgeschlagen.");
    } catch (err) {
      setCodeError(err.message || "Verifikation fehlgeschlagen.");
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <header className="header">
      <nav className="navbar">
        <div className="logo">
          <img src={UHH_Logo} alt="logo" className="logo-img" />
          <span className="logo-text">Projekt <b>Stahlbock</b></span>
        </div>

        <ul className="nav-rechts">
          <li>
            <button onClick={() => setShowTechnologies(true)}>Technologien</button>
          </li>
          <li>Option</li>
          <li>
            <button onClick={handleLibraryClick}>Library</button>
          </li>
          <li>
            <button onClick={() => setShowImpressum(true)}>Impressum</button>
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
                aria-label="Library schließen"
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
              <h2 id="impressum-title">Impressum gemäß § 5 DDG</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowImpressum(false)}
                aria-label="Impressum schließen"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section>
                <h3>Projektangaben</h3>
                <p>
                  <strong>Projektname:</strong> Masterprojekt Stahlbock<br />
                  <strong>Trägerinstitution:</strong> University of Hamburg Business School, Institut für Wirtschaftsinformatik<br />
                  <strong>Anschrift:</strong> Von-Melle-Park 5, 20146 Hamburg
                </p>
              </section>

              <section>
                <h3>Kontakt</h3>
                <p>
                  <strong>Ansprechperson:</strong> Simon Laatz<br />
                  <strong>E-Mail:</strong>{" "}
                  <a href="mailto:simon.laatz@studium.uni-hamburg.de">
                    simon.laatz@studium.uni-hamburg.de
                  </a>
                </p>
              </section>

              <section>
                <h3>Verantwortlich gemäß § 18 Abs. 2 MStV</h3>
                <p>
                  Simon Laatz<br />
                  [ggf. Adresse]
                </p>
              </section>

              <section>
                <h3>Haftung für Inhalte</h3>
                <p>
                  Die Inhalte dieser Website wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
                  Vollständigkeit und Aktualität der Inhalte übernehmen wir jedoch keine Gewähr. Das Webtool
                  dient ausschließlich wissenschaftlichen Forschungs- und Lehrzwecken im Rahmen eines
                  universitären Projekts. Eine kommerzielle Nutzung ist ausgeschlossen.
                </p>
              </section>

              <section>
                <h3>Nutzung von Dokumenten</h3>
                <p>
                  Im Rahmen dieses Projekts werden öffentlich zugängliche Unternehmensberichte gesammelt und in
                  einer zugangsbeschränkten, nicht-öffentlichen Cloud verarbeitet. Die Cloud ist nur für
                  Projektteilnehmerinnen und Projektteilnehmer zugänglich. Eine öffentliche Bereitstellung oder
                  Weiterverbreitung dieser Dokumente erfolgt nicht. Sämtliche Urheber- und Nutzungsrechte
                  verbleiben bei den jeweiligen Unternehmen oder Herausgebern. Sollten Rechteinhaber Einwände
                  gegen die Nutzung im Rahmen dieses Projekts haben, bitten wir um eine kurze Nachricht. In
                  diesem Fall werden die betroffenen Inhalte unverzüglich entfernt.
                </p>
              </section>

              <section>
                <h3>Haftung für externe Links</h3>
                <p>
                  Diese Website enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
                  Einfluss haben. Deshalb übernehmen wir für diese fremden Inhalte auch keine Gewähr. Für die
                  Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich.
                </p>
              </section>

              <section>
                <h3>Datenschutz</h3>
                <p>
                  Dieses Projekt verarbeitet ausschließlich Dokumente, die bereits öffentlich zugänglich sind.
                  Sollten dennoch unbeabsichtigt personenbezogene Daten enthalten sein, werden diese im Rahmen
                  des Projekts nicht weiterverarbeitet und auf Anfrage entfernt. Weitere Informationen zum
                  Datenschutz: <a href="#">[Link zu einer evtl. vorhandenen Datenschutzerklärung]</a>
                </p>
              </section>

              <section>
                <h3>Nicht-kommerzieller Charakter</h3>
                <p>
                  Dieses Webtool ist Teil eines universitären Forschungsprojekts und dient ausschließlich
                  akademischen Zwecken. Eine kommerzielle Nutzung, Vervielfältigung oder Weitergabe der im Rahmen
                  des Projekts verwendeten Dokumente ist nicht gestattet.
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
              <h2 id="technologies-title">Technologie-Begriffe</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowTechnologies(false)}
                aria-label="Technologie-Übersicht schließen"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <section>
                <h3>Standardbegriffe</h3>
                {uniqueDefaultTerms.length > 0 ? (
                  <ul className="technology-list">
                    {uniqueDefaultTerms.map((term) => (
                      <li key={`default-${term}`}>{term}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Keine Standardbegriffe konfiguriert.</p>
                )}
              </section>

              <section>
                <h3>Eigene Stichwörter</h3>
                {uniqueCustomTerms.length > 0 ? (
                  <ul className="technology-list">
                    {uniqueCustomTerms.map((term) => (
                      <li key={`custom-${term}`}>{term}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Derzeit wurden keine zusätzlichen Stichwörter hinzugefügt.</p>
                )}
              </section>

              <section>
                <h3>Gesamte Analysebegriffe</h3>
                {combinedTerms.length > 0 ? (
                  <ul className="technology-list columns">
                    {combinedTerms.map((term) => (
                      <li key={`combined-${term}`}>{term}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Keine Begriffe vorhanden.</p>
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
              <h2 id="code-prompt-title">Zugangscode erforderlich</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeCodePrompt}
                aria-label="Codeeingabe schließen"
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
                    Verifiziere Zugangscode … das kann beim ersten Mal einen Moment dauern.
                  </p>
                </div>
              )}
              <label htmlFor="visibility-code">Bitte Zugangscode eingeben</label>
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
                  Abbrechen
                </button>
                <button type="submit" disabled={verifyingCode}>
                  {verifyingCode ? "Prüfe…" : "Bestätigen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
