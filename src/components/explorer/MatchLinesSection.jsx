import DateRange from './DateRange'
import ResultCard from './ResultCard'
import ResultsTable from './ResultsTable'

const columns = [
  {
    key: 'serialNumber',
    label: 'SrNo',
    className: 'serial-column',
    render: (_row, index) => <span className="serial-number">{index + 1}</span>,
  },
  { key: 'nextNumber', label: 'Number' },
  { key: 'weekDate', label: 'Date', className: 'date-column', render: (row) => <DateRange value={row.weekDate} /> },
]

export default function MatchLinesSection({ analysis, patternLabel }) {
  return (
    <ResultCard className="match-lines" count={analysis.matchLines.length} title={`Match Lines · ${patternLabel}`}>
      <ResultsTable
        columns={columns}
        groups={analysis.patternGroups}
        rowKey={(row, index, group) => group
          ? `${group.pattern}-${row.currentDataRowId}-${index}`
          : `${row.currentDataRowId}-${index}`}
        rows={analysis.matchLines}
        rowsKey="matchLines"
      />
    </ResultCard>
  )
}
