export default function Wordcloud({ dataUrl }) {
  return (
    <div>
      <strong>Wordcloud</strong>
      <div style={{marginTop:8}}>
        <img src={dataUrl} loading="lazy" alt="Wordcloud" />
      </div>
    </div>
  )
}
