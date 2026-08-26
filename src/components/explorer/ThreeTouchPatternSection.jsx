import { useState } from 'react'
import ResultCard from './ResultCard'

export default function ThreeTouchPatternSection({ numberType, threeTouch }) {
  const [copied, setCopied] = useState(false)
  const accuracy = threeTouch.backtestAttempts > 0
    ? Math.round((threeTouch.backtestWins / threeTouch.backtestAttempts) * 100)
    : null

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(threeTouch.prompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <ResultCard
      action={threeTouch.predictedNumber && (
        <span className="three-touch-target">Target {threeTouch.predictedNumber}</span>
      )}
      className="three-touch-result"
      count={threeTouch.touches.length}
      title={`3-Touch Trick · ${numberType}`}
    >
      <div className="three-touch-content">
        <section className="three-touch-chain" aria-label="Three-touch pattern chain">
          <header>
            <div>
              <span>Anchor sequence</span>
              <strong>{threeTouch.anchorSequence}</strong>
            </div>
            <div>
              <span>Anchor day</span>
              <strong>{threeTouch.anchorDay || 'Not found'}</strong>
            </div>
          </header>
          <div className="touch-points">
            {[0, 1, 2].map((index) => {
              const touch = threeTouch.touches[index]
              return (
                <article className={touch ? 'touch-point' : 'touch-point missing'} key={index}>
                  <span>{touch?.label ?? `T${index + 1}`}</span>
                  <strong>{touch?.outcome ?? '—'}</strong>
                  <small>{touch?.weekDate ?? 'More history required'}</small>
                </article>
              )
            })}
          </div>
        </section>

        <section className="three-touch-rule">
          <span>Selected progression rule</span>
          <h3>{threeTouch.ruleName || 'Insufficient history'}</h3>
          <p>{threeTouch.ruleDescription}</p>
          <div className="three-touch-metrics">
            <span>Forecast <strong>{threeTouch.predictedNumber || 'Pending'}</strong></span>
            <span>Backtest <strong>{accuracy == null ? 'No test window' : `${accuracy}%`}</strong></span>
            {threeTouch.backtestAttempts > 0 && (
              <span>Wins <strong>{threeTouch.backtestWins}/{threeTouch.backtestAttempts}</strong></span>
            )}
          </div>
        </section>

        <section className="three-touch-prompt">
          <header>
            <div>
              <span>Generated result prompt</span>
              <strong>Ready for deeper trick analysis</strong>
            </div>
            <button onClick={copyPrompt} type="button">{copied ? 'Copied' : 'Copy Prompt'}</button>
          </header>
          <textarea aria-label="Generated 3-Touch analysis prompt" readOnly rows="8" value={threeTouch.prompt} />
        </section>
      </div>
    </ResultCard>
  )
}
