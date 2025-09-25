// TextAnalyzer.js
import React, { useState, useEffect } from 'react';
import '../TextAnalyzer.css';

const TextAnalyzer = ({ keywords }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Results
  const [wordcloudUrl, setWordcloudUrl] = useState('');
  const [kwicResults, setKwicResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  // Fetch results whenever keywords change
  useEffect(() => {
    if (!keywords) return;

    const fetchSearchResults = async () => {
      setError('');
      setLoading(true);
      setSearchResults([]);
      setWordcloudUrl('');
      setKwicResults([]);

      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiUrl}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords }),
        });

        if (!res.ok) throw new Error('Search request failed.');
        const data = await res.json();

        // Assuming backend returns { wordcloud, kwic, results }
        if (data.wordcloud) {
          setWordcloudUrl(`${apiUrl}/${data.wordcloud}`);
        }
        if (data.kwic) {
          setKwicResults(data.kwic);
        }
        if (Array.isArray(data.results)) {
          setSearchResults(data.results);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchResults();
  }, [keywords]);

  return (
    <div className="text-analyzer">
      <h2>Analysis Results</h2>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}

      {/* Wordcloud */}
      {wordcloudUrl && (
        <div className="wordcloud-section">
          <h3>Wordcloud</h3>
          <img src={wordcloudUrl} alt="Wordcloud" />
        </div>
      )}

      {/* KWIC */}
      {kwicResults.length > 0 && (
        <div className="kwic-section">
          <h3>KWIC Results</h3>
          <ul>
            {kwicResults.map((item, idx) => (
              <li key={idx}>
                <strong>{item.keyword}</strong>: {item.context}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Keyword Search Results */}
      {keywords && (
        <div className="search-results">
          <h3>
            Search Results for: <span style={{ color: '#e2001a' }}>{keywords}</span>
          </h3>
          {searchResults.length > 0 ? (
            <ul>
              {searchResults.map((res, idx) => (
                <li key={idx}>{res}</li>
              ))}
            </ul>
          ) : (
            !loading && <p>No matches found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TextAnalyzer;
