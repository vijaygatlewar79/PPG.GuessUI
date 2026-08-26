function formatFullYearDate(value) {
  return String(value ?? '').trim().replace(
    /^(\d{1,2}[/-]\d{1,2}[/-])(\d{2})$/,
    (_match, datePrefix, shortYear) => {
      const century = Number(shortYear) >= 70 ? '19' : '20'
      return `${datePrefix}${century}${shortYear}`
    },
  )
}

export default function DateRange({ value }) {
  const [start = '', end = ''] = String(value ?? '').split(/\s+to\s+/i)
  const formattedStart = formatFullYearDate(start)
  const formattedEnd = formatFullYearDate(end)

  return (
    <div className="date-range">
      <span>{formattedStart}</span>
      {formattedEnd && <strong>to</strong>}
      {formattedEnd && <span>{formattedEnd}</span>}
    </div>
  )
}
