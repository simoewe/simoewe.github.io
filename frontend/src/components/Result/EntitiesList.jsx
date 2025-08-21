export default function EntitiesList({ entities }) {
  return (
    <div>
      <strong>Entitäten</strong>
      <ul>
        {entities.map((e,i)=>(
          <li key={`${e.text}-${i}`}>
            {e.text} <small>({e.label})</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
