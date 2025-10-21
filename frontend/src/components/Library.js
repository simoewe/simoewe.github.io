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

function collectFolderFiles(folderNode) {
  if (!folderNode) return [];
  const files = [...(folderNode.files || [])];
  (folderNode.children || []).forEach((child) => {
    files.push(...collectFolderFiles(child));
  });
  return files;
}

export default function Library({ onSelect, onCancel }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set([ROOT_PATH]));
  const [selectedMap, setSelectedMap] = useState(() => new Map());

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

  useEffect(() => {
    setSelectedMap(new Map());
  }, [items]);

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

  const toggleFileSelection = (file) => {
    if (!file || !file.path) {
      return;
    }
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else {
        next.set(file.path, file);
      }
      return next;
    });
  };

  const toggleFolderSelection = (folderNode) => {
    if (!folderNode) {
      return;
    }
    const folderFiles = collectFolderFiles(folderNode);
    if (!folderFiles.length) {
      return;
    }
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const allSelected = folderFiles.every((file) => next.has(file.path));
      if (allSelected) {
        folderFiles.forEach((file) => next.delete(file.path));
      } else {
        folderFiles.forEach((file) => {
          if (file && file.path) {
            next.set(file.path, file);
          }
        });
      }
      return next;
    });
  };

  const selectedCount = selectedMap.size;
  const confirmSelection = () => {
    if (!selectedCount) {
      return;
    }
    if (typeof onSelect === "function") {
      onSelect(Array.from(selectedMap.values()));
    }
  };

  const renderFolder = (folder, depth = 0) => {
    const isRoot = folder.path === ROOT_PATH;
    const isExpanded = expanded.has(folder.path);
    const folderFiles = collectFolderFiles(folder);
    const allSelected =
      folderFiles.length > 0 && folderFiles.every((file) => selectedMap.has(file.path));
    const someSelected =
      !allSelected && folderFiles.some((file) => selectedMap.has(file.path));

    return (
      <div key={`folder-${folder.path || "root"}`} className="library-tree-node">
        {!isRoot && (
          <div className="library-folder-row" style={{ paddingLeft: `${depth * 16}px` }}>
            <button
              type="button"
              className="library-tree-folder"
              onClick={() => toggleFolder(folder.path)}
            >
              <span className="library-tree-icon">{isExpanded ? "📂" : "📁"}</span>
              <span>{folder.name}</span>
              <span className="library-tree-count">
                {folder.children.length + folder.files.length}
              </span>
            </button>
            {folderFiles.length > 0 && (
              <label className="library-folder-select">
                <input
                  type="checkbox"
                  className="library-checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate = someSelected;
                    }
                  }}
                  onChange={() => toggleFolderSelection(folder)}
                />
                <span>Select all</span>
              </label>
            )}
          </div>
        )}

        {(isRoot || isExpanded) && (
          <div className="library-tree-children">
            {folder.children
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((child) => renderFolder(child, isRoot ? depth : depth + 1))}
            {folder.files
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((file) => (
                <label
                  key={`file-${file.path}`}
                  className={`library-tree-file${
                    selectedMap.has(file.path) ? " library-tree-file-selected" : ""
                  }`}
                  style={{ paddingLeft: `${(isRoot ? depth : depth + 1) * 16 + 18}px` }}
                  onDoubleClick={() => onSelect && onSelect([file])}
                >
                  <input
                    type="checkbox"
                    className="library-checkbox"
                    checked={selectedMap.has(file.path)}
                    onChange={() => toggleFileSelection(file)}
                  />
                  <span className="library-tree-icon">📄</span>
                  <span className="library-tree-label">{file.name}</span>
                  {typeof file.size === "number" && (
                    <span className="library-tree-meta">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  )}
                </label>
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
        <>
          <div className="library-tree">{renderFolder(tree, 0)}</div>
          <div className="library-selection-footer">
            <div className="library-selection-summary">
              {selectedCount === 0
                ? "No files selected"
                : `${selectedCount} file${selectedCount === 1 ? "" : "s"} selected`}
            </div>
            <div className="library-selection-actions">
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSelection}
                disabled={selectedCount === 0}
              >
                Add selected
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="library-empty">No documents available.</p>
      )}
    </div>
  );
}
