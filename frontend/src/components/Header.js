import React, { useState } from "react";
import UHH_Logo from "../UHH_Logo.svg.png";
import Library from "./Library";

export default function Header({ onPickFromLibrary }) {
  const [showLib, setShowLib] = useState(false);

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
          <li>Impressum</li>
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
    </header>
  );
}
