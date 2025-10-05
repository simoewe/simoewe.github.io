import React, { useState } from "react";
import { useDropzone } from "react-dropzone";

function RightPanel({ onFileUpload }) {
  const [uploadStatus, setUploadStatus] = useState(null);
  const [fileTypeError, setFileTypeError] = useState("");

  const onDrop = (acceptedFiles, rejectedFiles) => {
    setFileTypeError("");
    setUploadStatus(null);

    if (rejectedFiles && rejectedFiles.length > 0) {
      const reasons = rejectedFiles
        .map((file) => file.errors.map((err) => err.message).join(", "))
        .join("; ");
      setUploadStatus(`❌ Upload failed: ${reasons}`);
      return;
    }

    const file = acceptedFiles[0];
    if (!file) {
      setUploadStatus("❌ No file selected");
      return;
    }

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      const error = "❌ Invalid file type (PDF required)";
      setFileTypeError(error);
      setUploadStatus(error);
      return;
    }

    setUploadStatus("✅ PDF loaded — ready for analysis");

    if (onFileUpload) {
      onFileUpload(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/x-pdf": [".pdf"] },
    multiple: false,
    onDropRejected: (rejectedFiles) => {
      const reasons = rejectedFiles
        .map((file) => file.errors.map((err) => err.message).join(", "))
        .join("; ");
      setUploadStatus(`❌ Upload failed: ${reasons}`);
    },
  });

  return (
    <div className="right-panel">
      {fileTypeError && (
        <div style={{ color: "#dc3545", fontWeight: "bold", marginBottom: "10px" }}>
          {fileTypeError}
        </div>
      )}
      <div {...getRootProps({ className: "dropzone fullsize" })}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the PDF here…</p>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p>📄 Upload PDF (drag & drop or click)</p>
            <p style={{ fontSize: "14px", color: "#666", marginTop: "10px" }}>
              Upload containerlogistics documents for analysis
            </p>
            {uploadStatus && (
              <p style={{ marginTop: "12px", fontWeight: "bold" }}>{uploadStatus}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RightPanel;
