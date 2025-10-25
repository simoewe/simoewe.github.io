import React from "react";

export default function Footer({ onOpenLegalNotice }) {
  const handleLegalNoticeClick = (event) => {
    event.preventDefault();
    if (typeof onOpenLegalNotice === "function") {
      onOpenLegalNotice();
    }
  };

  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <a className="site-footer-link" href="#about">
          About
        </a>
        <a className="site-footer-link" href="#terms">
          Terms of Use
        </a>
        <button
          type="button"
          className="site-footer-link"
          onClick={handleLegalNoticeClick}
        >
          Legal Notice
        </button>
        <a className="site-footer-link" href="mailto:simon.laatz@studium.uni-hamburg.de">
          Contact
        </a>
      </div>
    </footer>
  );
}
