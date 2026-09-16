import ResultCard from './ResultCard'
import ResultsTable from './ResultsTable'

const columns = [
  {
    key: 'serialNumber',
    label: 'SrNo',
    className: 'serial-column',
    render: (_row, index) => <span className="serial-number">{index + 1}</span>,
  },
  {
    key: 'number',
    label: 'Number (Times)',
    render: (row) => (
      <div className={`number-times${row.isPrediction ? ' predicted-number' : ''}`}>
        <strong>{row.number}</strong>
        <span>{row.isPrediction ? `Predicted #${row.predictionRank ?? 1}` : `(${row.count})`}</span>
      </div>
    ),
  },
]

export default function NextNumberCountSection({
  analysis,
  isLastWeekLoading,
  onOpenAnalysis,
  onOpenLastWeekAnalysis,
  onOpenPatternWiseAnalysis,
  isPatternWiseLoading,
  onOpenPatternResponses,
  patternLabel,
  patternResponseCount,
}) {
  return (
    <ResultCard
      action={(
        <div className="result-action-group">
          {analysis.nextNumberCounts.length > 0 && (
            <button
              className="number-analysis-button"
              disabled={isPatternWiseLoading}
              onClick={onOpenPatternWiseAnalysis}
              title="Compare which pattern gave the best guess and pass number results"
              type="button"
            >
              {isPatternWiseLoading ? "Loading patterns..." : "Analysis Pattern wise"}
            </button>
          )}
          {analysis.nextNumberCounts.length > 0 && (
            <button
              className="number-analysis-button"
              disabled={isLastWeekLoading}
              onClick={onOpenLastWeekAnalysis}
              title="Show guess analysis for the last seven days"
              type="button"
            >
              Analysis Last week
            </button>
          )}
          {analysis.nextNumberCounts.length > 0 && (
            <button className="number-analysis-button" onClick={onOpenAnalysis} title="Analyze top guess numbers" type="button">
              <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
                <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
              Analysis
            </button>
          )}
          {patternResponseCount > 0 && (
            <button
              className="number-analysis-button pattern-response-button"
              onClick={onOpenPatternResponses}
              title="Show grouped AI pattern responses"
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
                <path d="M12 3 13.8 8.2 19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
              </svg>
              Pattern Response
              <span>{patternResponseCount}</span>
            </button>
          )}
        </div>
      )}
      className="number-counts"
      count={analysis.nextNumberCounts.length}
      title={`Next Number Count · ${patternLabel}`}
    >
      <ResultsTable
        columns={columns}
        groups={analysis.patternGroups}
        rowKey={(row, _index, group) => group ? `${group.pattern}-${row.number}` : row.number}
        rows={analysis.nextNumberCounts}
        rowsKey="nextNumberCounts"
      />
    </ResultCard>
  )
}
