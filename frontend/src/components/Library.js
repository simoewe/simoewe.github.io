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

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color: "red" }}>{err}</div>;

  return (
    <div style={{ padding: 12 }}>
      <h3>Library</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map(it => (
          <li key={it.key} style={{ marginBottom: 8 }}>
            <button onClick={() => onSelect && onSelect(it)}>
              {it.name}
            </button>
            {typeof it.size === "number" && (
              <small style={{ marginLeft: 8 }}>
                {(it.size / 1024 / 1024).toFixed(2)} MB
              </small>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
