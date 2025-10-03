import React, { useState } from "react";
import UHH_Logo from "../UHH_Logo.svg.png";
import Library from "./Library";

export default function Header({ onPickFromLibrary }) {
  const [showLib, setShowLib] = useState(false);
  const [showImpressum, setShowImpressum] = useState(false);

  return (
    <header className="header">
      <nav className="navbar">
        <div className="logo">
          <img src={UHH_Logo} alt="logo" className="logo-img" />
          <span className="logo-text">Projekt <b>Stahlbock</b></span>
        </div>

        <ul className="nav-rechts">
          <li>Option</li>
          <li>Option</li>
          <li>
            <button onClick={() => setShowLib(v => !v)}>Library</button>
          </li>
          <li>Kontakt</li>
          <li>
            <button onClick={() => setShowImpressum(true)}>Impressum</button>
          </li>
        </ul>
      </nav>

      {showLib && (
        <div
          style={{
            position: "fixed",
            right: 16,
            top: 70,
            width: 320,
            maxHeight: "70vh",
            overflow: "auto",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 1000
          }}
        >
          <Library
            onSelect={(item) => {
              onPickFromLibrary && onPickFromLibrary(item);
              setShowLib(false);
            }}
          />
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
    </header>
  );
}
