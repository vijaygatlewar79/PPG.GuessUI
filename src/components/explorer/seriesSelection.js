export function getSeriesDayLimit(value) {
  const normalizedValue = String(value ?? '').trim()
  if (!normalizedValue) {
    return null
  }

  const dayLimit = Number(normalizedValue)
  if (!Number.isInteger(dayLimit) || dayLimit < 1) {
    throw new Error('AIG Series Days must be a positive whole number or blank for all data.')
  }

  return dayLimit
}

export function getCurrentDataSeries(analysis, dayLimit) {
  const values = (analysis?.currentData ?? [])
    .map((row) => String(row?.number ?? '').trim())
    .filter((value) => value && value !== '*')

  return dayLimit == null ? values : values.slice(-dayLimit)
}
