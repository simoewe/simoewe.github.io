import React from "react";

export default function Footer({ onOpenModal }) {
  const handleClick = (type) => (event) => {
    event.preventDefault();
    if (typeof onOpenModal === "function") {
      onOpenModal(type);
    }
  };

  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <button
          type="button"
          className="site-footer-link"
          onClick={handleClick("about")}
        >
          About
        </button>
        <button
          type="button"
          className="site-footer-link"
          onClick={handleClick("terms")}
        >
          Terms of Use
        </button>
        <button
          type="button"
          className="site-footer-link"
          onClick={handleClick("legal")}
        >
          Legal Notice
        </button>
        <button
          type="button"
          className="site-footer-link"
          onClick={handleClick("contact")}
        >
          Contact
        </button>
      </div>
    </footer>
  );
}
