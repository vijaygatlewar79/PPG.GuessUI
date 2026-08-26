import DateRange from './DateRange'
import ResultCard from './ResultCard'

function splitPanna(value) {
  const digits = Array.from(String(value ?? '').trim()).slice(0, 3)
  return [digits[0] ?? '', digits[1] ?? '', digits[2] ?? '']
}

function calculatePannaNumber(value) {
  const digits = Array.from(String(value ?? '')).filter((character) => /\d/.test(character))
  return digits.length === 0 ? '' : String(digits.reduce((sum, digit) => sum + Number(digit), 0) % 10)
}

function PanelDay({ close, isRedPair, pair, open }) {
  const openDigits = splitPanna(open)
  const closeDigits = splitPanna(close)
  const hasOpen = openDigits.some(Boolean)
  const hasClose = closeDigits.some(Boolean)
  const displayedNumber = hasOpen && hasClose
    ? pair || ''
    : hasOpen ? calculatePannaNumber(open) : hasClose ? calculatePannaNumber(close) : ''

  return (
    <div className="panel-day">
      <div className="panna-digits" aria-label={`Open ${open}`}>
        {openDigits.map((digit, index) => <span key={`open-${index}`}>{digit}</span>)}
      </div>
      <strong className={isRedPair && hasOpen && hasClose ? 'pair-number red-pair' : 'pair-number'}>{displayedNumber}</strong>
      <div className="panna-digits" aria-label={`Close ${close}`}>
        {closeDigits.map((digit, index) => <span key={`close-${index}`}>{digit}</span>)}
      </div>
    </div>
  )
}

export default function OriginalPanelDataSection({ days, gameName, rows }) {
  return (
    <ResultCard count={rows.length} title={`Original Panel Data${gameName ? ` · ${gameName}` : ''}`}>
      <div className="panel-chart-scroll" tabIndex="0">
        <table className="panel-chart">
          <thead><tr><th>Date</th>{days.map((day) => <th key={day}>{day}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><DateRange value={row.weekDate} /></td>
                {days.map((day) => {
                  const panelDay = row.days[day]
                  return (
                    <td key={day}>
                      <PanelDay close={panelDay.close} isRedPair={panelDay.isRedPair} open={panelDay.open} pair={panelDay.pair} />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ResultCard>
  )
}
