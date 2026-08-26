import DateRange from './DateRange'
import ResultCard from './ResultCard'

export default function CurrentDataSection({ days, matchingRowIds, numberType, weeks }) {
  const sequenceRowIds = new Set(matchingRowIds)

  return (
    <ResultCard className="current-data" count={weeks.length} title={`Current Data · ${numberType}`}>
      <div className="panel-chart-scroll current-chart-scroll" tabIndex="0">
        <table className="panel-chart current-chart">
          <thead>
            <tr><th>Date</th>{days.map((day) => <th key={day}>{day}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.id}>
                <td><DateRange value={week.weekDate} /></td>
                {days.map((day) => {
                  const row = week.days[day]
                  return (
                    <td className={sequenceRowIds.has(row?.id) ? 'sequence-cell' : ''} key={day}>
                      <strong className="current-sequence-number">{row?.number ?? ''}</strong>
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
