import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeText, analyzeFile, ensureDataUrl } from '../lib/api'
import SentimentCard from './Result/SentimentCard.jsx'
import EntitiesList from './Result/EntitiesList.jsx'
import Wordcloud from './Result/WordCloud.jsx'

const MAX_FILE_SIZE = 20 * 1024 * 1024

export default function TextAnalyzer() {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const abortRef = useRef(null)

  const charCount = useMemo(() => text.length, [text])

  useEffect(() => () => abortRef.current?.abort(), [])

  function onFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return setFile(null)
    if (f.size > MAX_FILE_SIZE) {
      setError('Datei ist größer als 20 MB.')
      e.target.value = ''
      return
    }
    setError('')
    setFile(f)
  }

  function clearAll() {
    setText('')
    setFile(null)
    setResult(null)
    setError('')
  }

  async function onAnalyze(e) {
    e.preventDefault()
    setError('')
    setResult(null)

    if (!text && !file) {
      setError('Bitte Text eingeben oder eine Datei wählen.')
      return
    }
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    try {
      const payload = file
        ? await analyzeFile(file, { signal: abortRef.current.signal })
        : await analyzeText(text, { signal: abortRef.current.signal })
      setResult(payload)
    } catch (err) {
      setError(err.message || 'Analyse fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  const wc = ensureDataUrl(result?.wordcloud_png)

  return (
    <section className="grid">
      <form onSubmit={onAnalyze} className="grid card">
        <label htmlFor="ta">Text</label>
        <textarea id="ta" rows={8} placeholder="Text hier einfügen…" value={text} onChange={(e)=>setText(e.target.value)} />
        <div className="row">
          <small>{charCount} Zeichen</small>
          <input type="file" accept=".pdf,.docx,.txt" onChange={onFileChange} />
        </div>
        <div className="row">
          <button className="btn" type="submit" disabled={loading}>{loading?'Analysiere…':'Analysieren'}</button>
          <button className="btn secondary" type="button" onClick={clearAll} disabled={loading}>Zurücksetzen</button>
        </div>
      </form>

      {error && <div className="alert">{error}</div>}

      {result && (
        <div className="card grid">
          <h2 style={{margin:'0 0 8px'}}>Ergebnis</h2>
          {'sentiment' in result && <SentimentCard sentiment={result.sentiment} />}
          {Array.isArray(result.entities) && result.entities.length>0 && <EntitiesList entities={result.entities} />}
          {wc && <Wordcloud dataUrl={wc} />}
          {result.debug && (
            <details>
              <summary>Debug</summary>
              <pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(result.debug, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  )
}
