import { useState } from 'react'

function TableCells({ columns, index, row }) {
  return columns.map((column) => (
    <td className={column.className} key={column.key}>
      {column.render
        ? column.render(row, index)
        : row[column.key] === '' || row[column.key] == null ? '' : row[column.key]}
    </td>
  ))
}

function TableHeader({ columns }) {
  return (
    <thead>
      <tr>
        {columns.map((column) => <th className={column.className} key={column.key}>{column.label}</th>)}
      </tr>
    </thead>
  )
}

function EmptyTableRow({ columnCount }) {
  return (
    <tr>
      <td className="no-results" colSpan={columnCount}>No matching records</td>
    </tr>
  )
}

function DataTable({ columns, rows, rowKey }) {
  return (
    <div className="table-scroll" tabIndex="0">
      <table>
        <TableHeader columns={columns} />
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}><TableCells columns={columns} index={index} row={row} /></tr>
          ))}
          {rows.length === 0 && <EmptyTableRow columnCount={columns.length} />}
        </tbody>
      </table>
    </div>
  )
}

function PatternTreeGroup({ columns, group, rowKey, rowsKey }) {
  const rows = group[rowsKey]
  const [isOpen, setIsOpen] = useState(rows.length > 0)

  return (
    <details className="pattern-result-group" onToggle={(event) => setIsOpen(event.currentTarget.open)} open={isOpen}>
      <summary className="pattern-group-heading">
        <h3>{group.label}</h3>
        <span>{rows.length.toLocaleString()}</span>
      </summary>
      <div className="pattern-tree-branch">
        <table>
          <TableHeader columns={columns} />
          <tbody>
            {rows.map((row, index) => (
              <tr key={rowKey(row, index, group)}><TableCells columns={columns} index={index} row={row} /></tr>
            ))}
            {rows.length === 0 && <EmptyTableRow columnCount={columns.length} />}
          </tbody>
        </table>
      </div>
    </details>
  )
}

function GroupedDataTable({ columns, groups, rowKey, rowsKey }) {
  const groupsWithData = groups.filter((group) => group[rowsKey].length > 0)

  return (
    <div className="grouped-table-scroll" tabIndex="0">
      {groupsWithData.map((group) => (
        <PatternTreeGroup columns={columns} group={group} key={group.pattern} rowKey={rowKey} rowsKey={rowsKey} />
      ))}
      {groupsWithData.length === 0 && <div className="no-pattern-results">No patterns with matching data</div>}
    </div>
  )
}

export default function ResultsTable({ columns, groups, rowKey, rows, rowsKey }) {
  return groups
    ? <GroupedDataTable columns={columns} groups={groups} rowKey={rowKey} rowsKey={rowsKey} />
    : <DataTable columns={columns} rowKey={rowKey} rows={rows} />
}
