import React from "react";

export default function KeywordInput({ onChange, value }) {
  return (
    <div className="keyword-input-wrapper">
      <textarea
        className="keyword-textarea"
        placeholder="Keywords eingeben..."
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
