export default function SentimentCard({ sentiment }) {
  const pol = Number(sentiment?.polarity ?? 0)
  const sub = Number(sentiment?.subjectivity ?? 0)
  return (
    <div>
      <strong>Sentiment</strong>
      <div>Polarity: {pol.toFixed(3)}</div>
      <div>Subjectivity: {sub.toFixed(3)}</div>
    </div>
  )
}
