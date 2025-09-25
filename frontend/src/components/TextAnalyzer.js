// TextAnalyzer.js
import React, { useState, useEffect } from 'react';
import '../TextAnalyzer.css';


const TextAnalyzer = ({ analysisResult, loading }) => {
  if (loading) {
    return <div className="text-analyzer"><h2>Analysis Results</h2><p>Loading…</p></div>;
  }
  if (!analysisResult) {
    return <div className="text-analyzer"><h2>Analysis Results</h2><p>No analysis yet.</p></div>;
  }
  if (analysisResult.error) {
    return <div className="text-analyzer"><h2>Analysis Results</h2><p className="error">{analysisResult.error}</p></div>;
  }

  const { image, kwic, collocations, frequencies, densities, sentiment, readability, trends } = analysisResult;

  return (
    <div className="text-analyzer">
      <h2>Analysis Results</h2>

      {/* Wordcloud */}
      {image && (
        <div className="wordcloud-section">
          <h3>Wordcloud</h3>
          <img src={image} alt="Wordcloud" />
        </div>
      )}

      {/* KWIC */}
      {kwic && Object.keys(kwic).length > 0 && (
        <div className="kwic-section">
          <h3>KWIC Results</h3>
          {Object.entries(kwic).map(([keyword, contexts], idx) => (
            <div key={idx}>
              <strong>{keyword}</strong>
              <ul>
                {contexts.map((context, i) => (
                  <li key={i}>{context}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Collocations */}
      {collocations && Object.keys(collocations).length > 0 && (
        <div className="collocations-section">
          <h3>Collocations</h3>
          {Object.entries(collocations).map(([keyword, colloc], idx) => (
            <div key={idx}>
              <strong>{keyword}</strong>
              <div>Left: {colloc.left.map(([word, count]) => `${word} (${count})`).join(', ')}</div>
              <div>Right: {colloc.right.map(([word, count]) => `${word} (${count})`).join(', ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Frequencies & Densities */}
      {frequencies && densities && (
        <div className="freq-section">
          <h3>Frequencies & Densities</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Frequency</th>
                <th>Density (%)</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(frequencies).map((kw) => (
                <tr key={kw}>
                  <td>{kw}</td>
                  <td>{frequencies[kw]}</td>
                  <td>{densities[kw]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sentiment */}
      {sentiment && (
        <div className="sentiment-section">
          <h3>Sentiment</h3>
          <div>Polarity: {sentiment.polarity}</div>
          <div>Subjectivity: {sentiment.subjectivity}</div>
        </div>
      )}

      {/* Readability */}
      {readability && (
        <div className="readability-section">
          <h3>Readability</h3>
          <div>Flesch Reading Ease: {readability.flesch_reading_ease}</div>
          <div>Total Words: {readability.total_words}</div>
          <div>Total Sentences: {readability.total_sentences}</div>
        </div>
      )}

      {/* Trends */}
      {trends && trends.length > 0 && (
        <div className="trends-section">
          <h3>Technological Trends</h3>
          <ul>
            {trends.map((trend, idx) => (
              <li key={idx}>
                <strong>{trend.trend}</strong> ({trend.count}):
                <ul>
                  {trend.contexts.map((ctx, i) => (
                    <li key={i}>{ctx}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TextAnalyzer;
