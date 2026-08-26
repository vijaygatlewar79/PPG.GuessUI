import { useEffect } from 'react'

function InlineMarkdown({ text }) {
  const parts = text.split(/(\*\*.*?\*\*)/g).filter(Boolean)

  return parts.map((part, index) => (
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>
      : <span key={`${part}-${index}`}>{part}</span>
  ))
}

function PredictionContent({ value }) {
  return (
    <div className="pattern-response-content">
      {value.split(/\r?\n/).map((line, index) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return <div aria-hidden="true" className="response-spacer" key={`space-${index}`} />

        const heading = trimmedLine.match(/^#{1,6}\s+(.*)$/)
        if (heading) {
          return <h4 key={`heading-${index}`}><InlineMarkdown text={heading[1]} /></h4>
        }

        const bullet = trimmedLine.match(/^[*-]\s+(.*)$/)
        if (bullet) {
          return <div className="response-bullet" key={`bullet-${index}`}><InlineMarkdown text={bullet[1]} /></div>
        }

        return <p key={`line-${index}`}><InlineMarkdown text={trimmedLine} /></p>
      })}
    </div>
  )
}

function getSeriesSourceLabel(response) {
  if (response.seriesDayLimit == null) {
    return `All available data · ${response.dataPointCount} days`
  }

  if (response.dataPointCount < response.seriesDayLimit) {
    return `${response.dataPointCount} available days · requested ${response.seriesDayLimit}`
  }

  return `Last ${response.seriesDayLimit} days`
}

export default function PatternResponseModal({ onClose, responses }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <section aria-labelledby="pattern-response-title" aria-modal="true" className="pattern-response-modal" role="dialog">
        <header className="number-analysis-header">
          <div>
            <p className="modal-eyebrow">AI pattern analysis</p>
            <h2 id="pattern-response-title">Pattern Responses</h2>
          </div>
          <button aria-label="Close pattern responses" className="modal-close" onClick={onClose} type="button">
            &times;
          </button>
        </header>

        <div className="pattern-response-summary">
          <strong>{responses.length} response {responses.length === 1 ? 'group' : 'groups'}</strong>
          <span>Each selected AI pattern is shown separately so more pattern services can be added later.</span>
        </div>

        <div className="pattern-response-groups">
          {responses.map((response) => (
            <details className="pattern-response-group" key={response.pattern} open>
              <summary>
                <span>{response.label}</span>
                <small>{response.model}</small>
              </summary>
              <div className="pattern-response-body">
                <div className="pattern-response-prediction">
                  <span>Top 3 predicted numbers</span>
                  <strong>{response.predictedNumbers.join(', ')}</strong>
                </div>
                <div className="pattern-response-source">
                  <div>
                    <span>Current Data source</span>
                    <strong>{getSeriesSourceLabel(response)}</strong>
                  </div>
                  <code>{response.seriesData}</code>
                </div>
                <PredictionContent value={response.prediction} />
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
