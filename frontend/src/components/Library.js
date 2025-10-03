import React, { useEffect, useState } from "react";
import { getApiBase } from "../utils/apiBase";

export default function Library({ onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const base = getApiBase();
        const resp = await fetch(`${base ? `${base}/library` : "/library"}`);
        const contentType = resp.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          const text = await resp.text();
          throw new Error(text || `Unexpected response (${resp.status})`);
        }

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || `Failed to load (status ${resp.status})`);
        if (data.warning) {
          setErr(data.warning);
          setItems([]);
          return;
        }
        setErr(null);
        setItems((data.items || []).filter(it => it.url && it.name));
      } catch (e) {
        setErr(e.message);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="library-loading" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <div>
          <p className="library-loading-title">Bibliothek wird geladen…</p>
          <p className="library-loading-hint">
            Hinweis: Der erste Abruf kann aufgrund der Cloud-Anbindung bis zu einer Minute dauern.
          </p>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="library-error" role="alert">
        {err}
      </div>
    );
  }

  return (
    <div className="library-panel">
      <h3>Library</h3>
      <ul>
        {items.map((it) => (
          <li key={it.key || it.name}>
            <button onClick={() => onSelect && onSelect(it)}>
              <span>{it.name}</span>
              {typeof it.size === "number" && (
                <small>{(it.size / 1024 / 1024).toFixed(2)} MB</small>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
