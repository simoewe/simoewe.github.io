import React, { useEffect, useMemo, useState } from "react";
import { getApiBase } from "../utils/apiBase";

const ROOT_PATH = "";

function buildTree(items) {
  const root = { type: "folder", name: "", path: ROOT_PATH, children: [], files: [] };
  const folderMap = { [ROOT_PATH]: root };

  const ensureFolder = (path, name) => {
    if (!folderMap[path]) {
      const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ROOT_PATH;
      const folderNode = { type: "folder", name, path, children: [], files: [] };
      folderMap[path] = folderNode;
      const parentNode = folderMap[parentPath] || root;
      parentNode.children.push(folderNode);
    }
    return folderMap[path];
  };

  items.forEach((item) => {
    const fullKey = (item.key || item.name || "").trim();
    if (!fullKey) {
      root.files.push({ ...item, type: "file", path: item.name || Math.random().toString(36) });
      return;
    }

    const segments = fullKey.split("/").filter(Boolean);
    const fileName = segments.pop();
    let currentPath = ROOT_PATH;

    segments.forEach((segment) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      ensureFolder(currentPath, segment);
    });

    const parentNode = currentPath ? folderMap[currentPath] : root;
    parentNode.files.push({ ...item, type: "file", name: item.name || fileName, path: fullKey });
  });

  return root;
}

export default function Library({ onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set([ROOT_PATH]));

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
        const validItems = (data.items || []).filter((it) => it.url && (it.key || it.name));
        setErr(null);
        setItems(validItems);
        setExpanded(new Set([ROOT_PATH]));
      } catch (e) {
        setErr(e.message);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const tree = useMemo(() => buildTree(items), [items]);

  const toggleFolder = (path) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderFolder = (folder, depth = 0) => {
    const isRoot = folder.path === ROOT_PATH;
    const isExpanded = expanded.has(folder.path);

    return (
      <div key={`folder-${folder.path || "root"}`} className="library-tree-node">
        {!isRoot && (
          <button
            type="button"
            className="library-tree-folder"
            style={{ paddingLeft: `${depth * 16}px` }}
            onClick={() => toggleFolder(folder.path)}
          >
            <span className="library-tree-icon">{isExpanded ? "📂" : "📁"}</span>
            <span>{folder.name}</span>
            <span className="library-tree-count">
              {folder.children.length + folder.files.length}
            </span>
          </button>
        )}

        {(isRoot || isExpanded) && (
          <div className="library-tree-children">
            {folder.children
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((child) => renderFolder(child, isRoot ? depth : depth + 1))}
            {folder.files
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((file) => (
                <button
                  key={`file-${file.path}`}
                  type="button"
                  className="library-tree-file"
                  style={{ paddingLeft: `${(isRoot ? depth : depth + 1) * 16 + 16}px` }}
                  onClick={() => onSelect && onSelect(file)}
                >
                  <span className="library-tree-icon">📄</span>
                  <span className="library-tree-label">{file.name}</span>
                  {typeof file.size === "number" && (
                    <span className="library-tree-meta">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  )}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="library-loading" role="status" aria-live="polite">
        <div className="spinner" aria-hidden="true" />
        <div>
          <p className="library-loading-title">Loading library…</p>
          <p className="library-loading-hint">
            Note: The first request can take up to a minute because of the cloud connection.
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

  const hasContent = tree.children.length > 0 || tree.files.length > 0;

  return (
    <div className="library-panel">
      {hasContent ? (
        <div className="library-tree">
          {renderFolder(tree, 0)}
        </div>
      ) : (
        <p className="library-empty">No documents available.</p>
      )}
    </div>
  );
}
