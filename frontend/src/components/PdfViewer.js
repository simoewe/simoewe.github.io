import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function RightPanel() {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);

  const onDrop = (acceptedFiles) => {
  const file = acceptedFiles[0];
  if (file && file.type === "application/pdf") {
    setPdfFile(file);   // direkt File-Objekt speichern
  } else {
    console.error("Keine gültige PDF-Datei hochgeladen.");
  }
};

  // Speicher aufräumen, wenn neues File gesetzt oder Komponente unmountet wird
  useEffect(() => {
    return () => {
      if (pdfFile) {
        URL.revokeObjectURL(pdfFile);
      }
    };
  }, [pdfFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  return (
    <div className="right-panel">
      {!pdfFile ? (
        <div {...getRootProps({ className: "dropzone fullsize" })}>
          <input {...getInputProps()} />
          {isDragActive ? (
            <p>Ziehe die PDF hierher…</p>
          ) : (
            <p>PDF hochladen (Drag & Drop oder klicken)</p>
          )}
        </div>
      ) : (
        <div className="pdf-viewer fullsize">
          <Document
            file={pdfFile}
            onLoadSuccess={({ numPages }) => {
              console.log("PDF geladen, Seiten:", numPages);
              setNumPages(numPages);
            }}
            onLoadError={(err) => console.error("PDF Ladefehler:", err)}
          >
            {Array.from(new Array(numPages), (el, index) => (
              <Page
                key={`page_${index + 1}`}
                pageNumber={index + 1}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            ))}
          </Document>
        </div>
      )}
    </div>
  );
}

export default RightPanel;
