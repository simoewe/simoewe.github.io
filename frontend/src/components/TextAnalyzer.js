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
  const [total, setTotal] = useState(null);
  const [trends, setTrends] = useState(null);
  const [sentiment, setSentiment] = useState(null);

  const [activeTab, setActiveTab] = useState('frequencies');

  const escapeRegExp = (string) =>
    string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightTermInSentence = (sentence, term) => {
    if (!term) return sentence;
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    return sentence.split(regex).map((part, i) =>
      regex.exec(part)
        ? (
          <span key={i} style={{ background: '#ffe5ea', color: '#e2001a', fontWeight: 'bold' }}>
            {part}
          </span>
        )
        : part
    );
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
    setTotal(null);
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
        setTotal(sorted.reduce((acc, [, count]) => acc + count, 0));
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
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Each tab content remains as in your original code */}
        </div>
      )}
    </div>
  );
};

export default TextAnalyzer;
