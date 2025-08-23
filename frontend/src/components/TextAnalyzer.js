import React, { useState } from 'react';
import '../TextAnalyzer.css';

const TextAnalyzer = () => {
  const [buzzwords, setBuzzwords] = useState('');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [counter, setCounter] = useState(0);

  const [wordcloud, setWordcloud] = useState(null);
  const [frequencies, setFrequencies] = useState(null);
  const [densities, setDensities] = useState(null);
  const [kwic, setKwic] = useState(null);
  const [collocations, setCollocations] = useState(null);
  const [readability, setReadability] = useState(null);
  const [trends, setTrends] = useState(null);
  const [sentiment, setSentiment] = useState(null);

  const [activeTab, setActiveTab] = useState('frequencies');

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const highlightTermInSentence = (sentence, term) => {
    if (!term) return sentence;
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    return sentence.split(regex).map((part, i) => {
      const isMatch = regex.test(part);
      regex.lastIndex = 0; // Reset regex state
      return isMatch ? (
        <span key={i} style={{ background: '#ffe5ea', color: '#e2001a', fontWeight: 'bold' }}>
          {part}
        </span>
      ) : part;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Bitte laden Sie eine Datei hoch.');
      return;
    }

    setError('');
    setWordcloud(null);
    setFrequencies(null);
    setDensities(null);
    setKwic(null);
    setCollocations(null);
    setReadability(null);
    setSentiment(null);
    setTrends(null);

    setLoading(true);
    setProgress(0);
    setCounter(0);

    let estimatedWords = 1000;
    if (file.size < 100000) estimatedWords = 500;
    else if (file.size < 500000) estimatedWords = 2000;
    else estimatedWords = 5000;

    let prog = 0;
    let count = 0;

    const progInterval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 3 + 1, 90);
      setProgress(prog);
    }, 80);

    const countInterval = setInterval(() => {
      count = Math.min(count + Math.floor(Math.random() * 20 + 5), estimatedWords * 0.9);
      setCounter(count);
    }, 60);

    const formData = new FormData();
    formData.append('buzzwords', buzzwords);
    formData.append('file', file);

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiUrl}/analyze`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progInterval);
      clearInterval(countInterval);
      setLoading(false);
      setProgress(100);
      setCounter(estimatedWords);

      if (!res.ok) {
        let errMsg = 'Es ist ein Fehler aufgetreten.';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch (_) {}
        setError(errMsg);
        return;
      }

      const data = await res.json();

      if (data.image) setWordcloud(data.image);
      if (data.frequencies && Object.keys(data.frequencies).length > 0) {
        const sorted = Object.entries(data.frequencies).sort((a, b) => b[1] - a[1]);
        setFrequencies(sorted);
      }
      setDensities(data.densities || null);
      setKwic(data.kwic || null);
      setCollocations(data.collocations || null);
      setReadability(data.readability || null);
      setSentiment(data.sentiment || null);
      setTrends(data.trends || null);

    } catch (err) {
      clearInterval(progInterval);
      clearInterval(countInterval);
      setLoading(false);
      setError('Failed to connect to backend.');
    }
  };

  return (
    <div className="container">
      <img
        src="https://www.uni-hamburg.de/16809753/uhh-logo-insert-6a9742755df2ab4c64c62c24740883d1dbab4529.png"
        alt="Universität Hamburg Logo"
        style={{ display: 'block', margin: '0 auto 18px auto', maxWidth: 180, height: 'auto' }}
      />
      <h2>Textanalyse-Tool</h2>

      <form onSubmit={handleSubmit}>
        <label htmlFor="buzzwords">Suchbegriffe (kommagetrennt):</label>
        <input
          type="text"
          id="buzzwords"
          required
          placeholder="z.B. KI, Daten, Analyse"
          value={buzzwords}
          onChange={e => setBuzzwords(e.target.value)}
        />

        <label htmlFor="file">Datei hochladen (PDF, DOCX, TXT):</label>
        <input
          type="file"
          id="file"
          accept=".pdf,.docx,.txt"
          required
          onChange={e => setFile(e.target.files[0])}
        />

        <button type="submit">Analysieren & Wortwolke erstellen</button>
      </form>

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="wordcloud" style={{ color: '#007bff', fontSize: 18 }}>
          <div style={{ marginBottom: 10 }}>Bitte warten, die Analyse läuft...</div>
          <div id="progressbar-container" style={{ width: '100%', background: '#e0e0e0', borderRadius: 6, height: 18, marginBottom: 8 }}>
            <div id="progressbar" style={{ height: '100%', width: `${progress}%`, background: '#e2001a', borderRadius: 6, transition: 'width 0.2s' }}></div>
          </div>
          <div id="livecounter" style={{ fontSize: 16, color: '#b10016', fontWeight: 'bold' }}>
            Analysierte Wörter: <span id="counter-value">{counter}</span>
          </div>
        </div>
      )}

      {wordcloud && (
        <div className="wordcloud">
          <img
            src={wordcloud}
            alt="Word Cloud"
            style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          />
        </div>
      )}

      {/* Tabs */}
      {(frequencies || kwic || collocations || readability || sentiment || (trends && trends.length > 0)) && (
        <div style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {['frequencies', 'kwic', 'collocations', 'readability', 'sentiment', 'trends'].map(tab => (
              <button
                key={tab}
                type="button"
                className={activeTab === tab ? 'tab-active' : 'tab'}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'frequencies' && 'Frequenzen'}
                {tab === 'kwic' && 'KWIC'}
                {tab === 'collocations' && 'Kollokationen'}
                {tab === 'readability' && 'Lesbarkeit'}
                {tab === 'sentiment' && 'Sentiment'}
                {tab === 'trends' && 'Tech-Trends'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ background: '#f8f9fa', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0' }}>
            
            {activeTab === 'frequencies' && frequencies && (
              <div>
                <h3>Wortfrequenzen</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 15 }}>
                  <thead>
                    <tr style={{ background: '#e2001a', color: 'white' }}>
                      <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>Suchbegriff</th>
                      <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>Häufigkeit</th>
                      {densities && <th style={{ padding: 12, textAlign: 'left', border: '1px solid #ddd' }}>Dichte (%)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {frequencies.map(([word, count], idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? '#f9f9f9' : 'white' }}>
                        <td style={{ padding: 12, border: '1px solid #ddd', fontWeight: 'bold' }}>{word}</td>
                        <td style={{ padding: 12, border: '1px solid #ddd' }}>{count}</td>
                        {densities && <td style={{ padding: 12, border: '1px solid #ddd' }}>{densities[word] || 0}%</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'kwic' && kwic && (
              <div>
                <h3>Keyword in Context (KWIC)</h3>
                {Object.entries(kwic).map(([word, contexts]) => (
                  <div key={word} style={{ marginBottom: 25 }}>
                    <h4 style={{ color: '#e2001a', marginBottom: 10 }}>{word.toUpperCase()}</h4>
                    {contexts.length > 0 ? (
                      contexts.map((context, idx) => (
                        <p key={idx} style={{ 
                          background: 'white', 
                          padding: 12, 
                          margin: '8px 0', 
                          border: '1px solid #e0e0e0',
                          borderRadius: 4,
                          fontFamily: 'monospace',
                          fontSize: 14,
                          lineHeight: 1.4
                        }}>
                          {highlightTermInSentence(context, word)}
                        </p>
                      ))
                    ) : (
                      <p style={{ fontStyle: 'italic', color: '#666' }}>Keine Kontexte gefunden</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'collocations' && collocations && (
              <div>
                <h3>Kollokationen</h3>
                {Object.entries(collocations).map(([word, data]) => (
                  <div key={word} style={{ marginBottom: 25, background: 'white', padding: 15, borderRadius: 6, border: '1px solid #e0e0e0' }}>
                    <h4 style={{ color: '#e2001a', marginBottom: 15 }}>{word.toUpperCase()}</h4>
                    <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <h5 style={{ color: '#007bff', marginBottom: 10 }}>Linke Nachbarn:</h5>
                        {data.left.length > 0 ? (
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {data.left.map(([neighbor, count], idx) => (
                              <li key={idx} style={{ 
                                padding: '6px 12px', 
                                margin: '4px 0', 
                                background: '#f0f8ff', 
                                borderRadius: 4,
                                border: '1px solid #e0e0e0'
                              }}>
                                <strong>{neighbor}</strong> <span style={{ color: '#666' }}>({count})</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontStyle: 'italic', color: '#666' }}>Keine gefunden</p>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <h5 style={{ color: '#28a745', marginBottom: 10 }}>Rechte Nachbarn:</h5>
                        {data.right.length > 0 ? (
                          <ul style={{ listStyle: 'none', padding: 0 }}>
                            {data.right.map(([neighbor, count], idx) => (
                              <li key={idx} style={{ 
                                padding: '6px 12px', 
                                margin: '4px 0', 
                                background: '#f0fff0', 
                                borderRadius: 4,
                                border: '1px solid #e0e0e0'
                              }}>
                                <strong>{neighbor}</strong> <span style={{ color: '#666' }}>({count})</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ fontStyle: 'italic', color: '#666' }}>Keine gefunden</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'readability' && readability && (
              <div>
                <h3>Lesbarkeitsanalyse</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginTop: 15 }}>
                  <div style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#e2001a' }}>Flesch Reading Ease</h4>
                    <p style={{ fontSize: 32, fontWeight: 'bold', color: '#e2001a', margin: '10px 0' }}>{readability.flesch_reading_ease}</p>
                    <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                      {readability.flesch_reading_ease >= 90 ? 'Sehr einfach' : 
                       readability.flesch_reading_ease >= 80 ? 'Einfach' :
                       readability.flesch_reading_ease >= 70 ? 'Ziemlich einfach' :
                       readability.flesch_reading_ease >= 60 ? 'Standard' :
                       readability.flesch_reading_ease >= 50 ? 'Ziemlich schwierig' :
                       readability.flesch_reading_ease >= 30 ? 'Schwierig' : 'Sehr schwierig'}
                    </p>
                  </div>
                  <div style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#007bff' }}>Gesamtwörter</h4>
                    <p style={{ fontSize: 32, fontWeight: 'bold', color: '#007bff', margin: '10px 0' }}>{readability.total_words.toLocaleString()}</p>
                  </div>
                  <div style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#28a745' }}>Gesamtsätze</h4>
                    <p style={{ fontSize: 32, fontWeight: 'bold', color: '#28a745', margin: '10px 0' }}>{readability.total_sentences.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sentiment' && sentiment && (
              <div>
                <h3>Sentimentanalyse</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginTop: 15 }}>
                  <div style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Polarität</h4>
                    <p style={{ 
                      fontSize: 32, 
                      fontWeight: 'bold', 
                      color: sentiment.polarity > 0.1 ? '#28a745' : sentiment.polarity < -0.1 ? '#dc3545' : '#ffc107',
                      margin: '10px 0' 
                    }}>
                      {sentiment.polarity.toFixed(2)}
                    </p>
                    <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                      (-1 = sehr negativ, 0 = neutral, +1 = sehr positiv)
                    </p>
                    <p style={{ fontSize: 14, color: '#333', marginTop: 8 }}>
                      {sentiment.polarity > 0.1 ? 'Positiv' : sentiment.polarity < -0.1 ? 'Negativ' : 'Neutral'}
                    </p>
                  </div>
                  <div style={{ background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0', textAlign: 'center' }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>Subjektivität</h4>
                    <p style={{ fontSize: 32, fontWeight: 'bold', color: '#007bff', margin: '10px 0' }}>{sentiment.subjectivity.toFixed(2)}</p>
                    <p style={{ fontSize: 12, color: '#666', margin: 0 }}>
                      (0 = sehr objektiv, 1 = sehr subjektiv)
                    </p>
                    <p style={{ fontSize: 14, color: '#333', marginTop: 8 }}>
                      {sentiment.subjectivity > 0.5 ? 'Subjektiv' : 'Objektiv'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trends' && trends && trends.length > 0 && (
              <div>
                <h3>Technologie-Trends</h3>
                <p style={{ color: '#666', marginBottom: 20 }}>Gefundene {trends.length} Technologie-Trend(s) im Text:</p>
                {trends.map((trend, idx) => (
                  <div key={idx} style={{ marginBottom: 25, background: 'white', padding: 20, borderRadius: 8, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 15 }}>
                      <h4 style={{ color: '#e2001a', margin: 0, flex: 1 }}>{trend.trend}</h4>
                      <span style={{ 
                        background: '#e2001a', 
                        color: 'white', 
                        padding: '4px 12px', 
                        borderRadius: 15, 
                        fontSize: 14, 
                        fontWeight: 'bold' 
                      }}>
                        {trend.count} {trend.count === 1 ? 'Erwähnung' : 'Erwähnungen'}
                      </span>
                    </div>
                    <div>
                      <h5 style={{ color: '#007bff', marginBottom: 10 }}>Kontexte:</h5>
                      {trend.contexts.map((context, contextIdx) => (
                        <p key={contextIdx} style={{ 
                          background: '#f8f9fa', 
                          padding: 12, 
                          margin: '8px 0', 
                          borderRadius: 4,
                          fontSize: 14,
                          lineHeight: 1.5,
                          border: '1px solid #e9ecef'
                        }}>
                          {highlightTermInSentence(context, trend.trend)}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default TextAnalyzer;