export default function ResultCard({ title, count, children, className = '', action = null }) {
  return (
    <section className={`result-card ${className}`}>
      <header className="result-heading">
        <h2>{title}</h2>
        <div className="result-heading-tools">
          {action}
          <span className="result-count">{count.toLocaleString()}</span>
        </div>
      </header>
      {children}
    </section>
  )
}
