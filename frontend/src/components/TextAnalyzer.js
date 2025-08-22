import React, { useState } from 'react';
import '../TextAnalyzer.css';

const TextAnalyzer = () => {
  // State hooks
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

  // Tab state
  const [activeTab, setActiveTab] = useState('frequencies');

  // --- Helper functions ---
  const highlightTermInSentence = (sentence, term) => {
    if (!term) return sentence;
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
    const parts = sentence.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? (
          <span key={i} style={{ background: '#ffe5ea', color: '#e2001a', fontWeight: 'bold' }}>
            {part}
          </span>
        )
        : part
    );
  };

  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // --- Handle form submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
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

    // estimate words for progress
    let estimatedWords = 1000;
    if (file) {
      if (file.size < 100000) estimatedWords = 500;
      else if (file.size < 500000) estimatedWords = 2000;
      else estimatedWords = 5000;
    }

    let prog = 0;
    let count = 0;

    const progInterval = setInterval(() => {
      if (prog < 90) {
        prog += Math.random() * 3 + 1;
        if (prog > 90) prog = 90;
        setProgress(prog);
      }
    }, 80);

    const countInterval = setInterval(() => {
      if (count < estimatedWords * 0.9) {
        count += Math.floor(Math.random() * 20 + 5);
        if (count > estimatedWords * 0.9) count = Math.floor(estimatedWords * 0.9);
        setCounter(count);
      }
    }, 60);

    const formData = new FormData();
    formData.append('buzzwords', buzzwords);
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        body: formData,
      });

      setLoading(false);
      clearInterval(progInterval);
      clearInterval(countInterval);
      setProgress(100);
      setCounter(estimatedWords);

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Es ist ein Fehler aufgetreten.');
        return;
      }

      const data = await res.json();

      if (data.image) setWordcloud(data.image);
      if (data.frequencies && Object.keys(data.frequencies).length > 0) {
        const sorted = Object.entries(data.frequencies).sort((a, b) => b[1] - a[1]);
        setFrequencies(sorted);
        setTotal(sorted.reduce((acc, [_, count]) => acc + count, 0));
      }
      if (data.densities) setDensities(data.densities);
      if (data.kwic) setKwic(data.kwic);
      if (data.collocations) setCollocations(data.collocations);
      if (data.readability) setReadability(data.readability);
      if (data.sentiment) setSentiment(data.sentiment);
      if (data.trends) setTrends(data.trends);

    } catch (err) {
      setLoading(false);
      clearInterval(progInterval);
      clearInterval(countInterval);
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

      {/* Upload form */}
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

      {/* Progress display */}
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

      {/* Wordcloud */}
      {wordcloud && (
        <div className="wordcloud">
          <img
            src={wordcloud}
            alt="Word Cloud"
            style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          />
        </div>
      )}

      {/* Tabbed results UI */}
      {(frequencies || kwic || collocations || readability || sentiment || (trends && trends.length > 0)) && (
        <div style={{ marginTop: 30 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button type="button" className={activeTab === 'frequencies' ? 'tab-active' : 'tab'} onClick={() => setActiveTab('frequencies')}>Frequenzen</button>
            <button type="button" className={activeTab === 'kwic' ? 'tab-active' : 'tab'} onClick={() => setActiveTab('kwic')}>KWIC</button>
            <button type="button" className={activeTab === 'collocations' ? 'tab-active' : 'tab'} onClick={() => setActiveTab('collocations')}>Kollokationen</button>
            <button type="button" className={activeTab === 'readability' ? 'tab-active' : 'tab'} onClick={() => setActiveTab('readability')}>Lesbarkeit</button>
            <button type="button" className={activeTab === 'sentiment' ? 'tab-active' : 'tab'} onClick={() => setActiveTab('sentiment')}>Sentiment</button>
            <button type="button" className={activeTab === 'trends' ? 'tab-active' : 'tab'} onClick={() => setActiveTab('trends')}>Trends</button>
          </div>

          {activeTab === 'frequencies' && frequencies && (
            <div className="wordcloud">
              <h4>Häufigkeit und Dichte der Buzzwords:</h4>
              <ul className="freq-list">
                {frequencies.map(([word, count]) => (
                  <li key={word}>
                    <b>{word}</b>: {count}
                    {densities && densities[word] !== undefined && (
                      <span style={{ marginLeft: 8, color: '#888' }}>Dichte: {densities[word]}%</span>
                    )}
                  </li>
                ))}
              </ul>
              {total !== null && <div className='totalcount-box'>Gesamtanzahl aller Einträge: <b>{total}</b></div>}
            </div>
          )}

          {activeTab === 'kwic' && kwic && Object.keys(kwic).length > 0 && (
            <div className="wordcloud">
              <h4>Beispiel-Kontexte (KWIC):</h4>
              {Object.entries(kwic).map(([word, snippets]) => (
                <div key={word} style={{ marginBottom: 10 }}>
                  <b>{word}</b>:
                  <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 18, fontSize: '15px' }}>
                    {snippets.map((s, i) => (
                      <li key={i} style={{ color: '#444' }}>
                        {highlightTermInSentence(s, word)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'collocations' && collocations && Object.keys(collocations).length > 0 && (
            <div className="wordcloud">
              <h4>Häufige Nachbarn (Kollokationen):</h4>
              {Object.entries(collocations).map(([word, coll]) => (
                <div key={word} style={{ marginBottom: 10 }}>
                  <b>{word}</b>:
                  <div style={{ fontSize: '15px', color: '#444' }}>
                    Links: {coll.left.map(([w, c]) => `${w} (${c})`).join(', ') || '–'}<br />
                    Rechts: {coll.right.map(([w, c]) => `${w} (${c})`).join(', ') || '–'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'readability' && readability && (
            <div className="wordcloud">
              <h4>Lesbarkeitsindex (Flesch Reading Ease):</h4>
              <div>Score: <b>{readability.flesch_reading_ease}</b></div>
              <div>Wörter: <b>{readability.total_words}</b>, Sätze: <b>{readability.total_sentences}</b></div>
            </div>
          )}

          {activeTab === 'sentiment' && sentiment && (
            <div className="wordcloud">
              <h4>Sentiment-Analyse:</h4>
              <div>Polarity: <b>{sentiment.polarity}</b> (−1 = negativ, 1 = positiv)</div>
              <div>Subjectivity: <b>{sentiment.subjectivity}</b> (0 = objektiv, 1 = subjektiv)</div>
            </div>
          )}

          {activeTab === 'trends' && trends && trends.length > 0 && (
            <div className="wordcloud">
              <h4>Gefundene technologische Trends:</h4>
              <ul className="freq-list">
                {trends.map((trend, idx) => (
                  <li key={idx}>
                    <b>{trend.trend}</b> — Häufigkeit: <b>{trend.count}</b>
                    {trend.contexts && trend.contexts.length > 0 && (
                      <ul style={{ marginTop: '8px', marginBottom: '0', paddingLeft: '18px', fontSize: '15px' }}>
                        {trend.contexts.map((ctx, cidx) => (
                          <li key={cidx} style={{ color: '#444' }}>{highlightTermInSentence(ctx, trend.trend)}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TextAnalyzer;