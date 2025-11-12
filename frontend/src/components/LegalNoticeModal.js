import React from "react";

export default function LegalNoticeModal({ isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }

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
        className="modal-card info-modal legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="impressum-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header info-modal-header">
          <h2 id="impressum-title">Legal notice (Sec. 5 DDG)</h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleClose}
            aria-label="Close legal notice"
          >
            ×
          </button>
        </div>
        <div className="modal-body info-modal-body">
          <div className="info-modal-content">
            <div className="info-modal-stack">
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
                  Universität Hamburg<br />
                  Von-Melle-Park 5<br />
                  20146 Hamburg, Germany
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
                  This project processes only documents that are already publicly accessible. Uploaded sources
                  remain in a restricted university environment and are deleted as soon as the analysis is
                  completed. We do not build user profiles, store personal data beyond the session, or share
                  materials with third parties.
                </p>
                <p>
                  Should personal data inadvertently be included, it will not be further processed and will be
                  removed upon request. Please contact{" "}
                  <a href="mailto:simon.laatz@studium.uni-hamburg.de">
                    simon.laatz@studium.uni-hamburg.de
                  </a>{" "}
                  for any privacy-related questions.
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
      </div>
    </div>
  );
}
