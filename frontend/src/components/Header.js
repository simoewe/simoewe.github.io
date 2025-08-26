import React from "react";
import UHH_Logo from "../UHH_Logo.svg.png"

export default function Header() {
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
          <li>Option</li>
          <li>Kontakt</li>
          <li>Impressum</li>
        </ul>
      </nav>
    </header>
  );
}