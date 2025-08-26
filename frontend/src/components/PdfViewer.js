import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker-Setup (korrekt für pdfjs-dist v5.x)
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

function RightPanel() {
  const [pdfFile, setPdfFile] = useState(null);
  const [numPages, setNumPages] = useState(null);

  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file); // direkt File an react-pdf übergeben
    } else {
      console.error("Keine gültige PDF-Datei hochgeladen.");
    }
  };

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
              console.log("✅ PDF geladen, Seiten:", numPages);
              setNumPages(numPages);
            }}
            onLoadError={(err) =>
              console.error("❌ PDF Ladefehler:", err.message, err)
            }
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
