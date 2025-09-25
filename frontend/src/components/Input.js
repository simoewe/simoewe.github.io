import React from "react";

export default function KeywordInput({ onChange, value }) {
  return (
    <div className="keyword-input-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <textarea
        className="keyword-textarea"
        placeholder="Keywords eingeben..."
        value={value}
        onChange={onChange}
        style={{ minHeight: '40px', maxHeight: '80px', height: '100%', resize: 'vertical', overflowY: 'auto' }}
      />
    </div>
  );
}
