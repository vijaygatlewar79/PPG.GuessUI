import { useEffect, useState } from 'react'
import PageHeader from './components/PageHeader'
import CurrentDataSection from './components/explorer/CurrentDataSection'
import MatchLinesSection from './components/explorer/MatchLinesSection'
import NextNumberCountSection from './components/explorer/NextNumberCountSection'
import OriginalPanelDataSection from './components/explorer/OriginalPanelDataSection'
import PatternResponseModal from './components/explorer/PatternResponseModal'
import SearchControls from './components/explorer/SearchControls'
import ThreeTouchPatternSection from './components/explorer/ThreeTouchPatternSection'
import { getCurrentDataSeries, getSeriesDayLimit } from './components/explorer/seriesSelection'
import {
  panelPatternOptions,
  patternOptions,
  predictionPatternOptions,
} from './components/explorer/patternOptions'

const dataSheetPath = '/DataSheet'

function getPageFromPath() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return path.toLowerCase() === dataSheetPath.toLowerCase() ? 'excel-files' : 'explorer'
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

async function fetchGames(signal) {
  const response = await fetch(`${apiBaseUrl}/api/panel/games`, { signal })
  if (!response.ok) {
    throw new Error(`Game list request failed with status ${response.status}.`)
  }

  return response.json()
}

function getProblemMessage(problem, fallback) {
  if (problem?.errors) {
    return Object.values(problem.errors).flat().find(Boolean) || fallback
  }

  return problem?.detail || problem?.title || fallback
}

function ChartGeneratorModal({
  error,
  fileName,
  onClose,
  onSourceChange,
  onSubmit,
  onUrlChange,
  result,
  sources,
  status,
  url,
}) {
  const isLoading = status === 'loading'

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !isLoading && onClose()}
      role="presentation"
    >
      <section aria-labelledby="chart-generator-title" aria-modal="true" className="generator-modal" role="dialog">
        <header className="generator-modal-header">
          <div>
            <p className="modal-eyebrow">Panel data import</p>
            <h2 id="chart-generator-title">Generate Excel from URL</h2>
          </div>
          <button aria-label="Close generator" className="modal-close" disabled={isLoading} onClick={onClose} type="button">
            &times;
          </button>
        </header>

        <form className="generator-form" onSubmit={onSubmit}>
          <div className="generator-field">
            <label htmlFor="chart-file-name">File name</label>
            <select
              autoFocus
              id="chart-file-name"
              onChange={(event) => onSourceChange(event.target.value)}
              required
              value={fileName}
            >
              {sources.length === 0 && <option value="">No chart sources configured</option>}
              {sources.map((source) => (
                <option key={source.fileName} value={source.fileName}>
                  {source.displayName ?? source.fileName}
                </option>
              ))}
            </select>
            <span className="field-hint">Options are loaded from the API chart-sources.json file.</span>
          </div>

          <div className="generator-field">
            <label htmlFor="chart-url">Chart URL</label>
            <input
              id="chart-url"
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="Enter chart page URL"
              required
              type="url"
              value={url}
            />
            <span className="field-hint">Changing this URL and generating the file updates its JSON entry.</span>
          </div>

          {error && <div className="generator-message error" role="alert">{error}</div>}
          {result && (
            <div className="generator-message success" role="status">
              <strong>{result.fileName}</strong> generated with {result.rowCount.toLocaleString()} rows and added to the game list.
            </div>
          )}

          <footer className="generator-actions">
            <button className="secondary-button" disabled={isLoading} onClick={onClose} type="button">
              {result ? 'Close' : 'Cancel'}
            </button>
            <button className="primary-button" disabled={isLoading} type="submit">
              {isLoading ? 'Generating...' : result ? 'Generate again' : 'Generate Excel'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function AddChartSourceModal({ onClose, onCreated, source = null }) {
  const isUpdate = Boolean(source)
  const [fileName, setFileName] = useState(source?.fileName ?? '')
  const [displayName, setDisplayName] = useState(source?.displayName ?? '')
  const [url, setUrl] = useState(source?.url ?? '')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const isLoading = status === 'loading'

  const submit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    setResult(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, displayName, url }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getProblemMessage(data, `Generation request failed with status ${response.status}.`))
      }

      if (source && data.fileName.toLowerCase() !== source.fileName.toLowerCase()) {
        const removeResponse = await fetch(
          `${apiBaseUrl}/api/chart-export/options?fileName=${encodeURIComponent(source.fileName)}&backupAction=Update`,
          { method: 'DELETE' },
        )

        if (!removeResponse.ok) {
          const problem = await removeResponse.json().catch(() => null)
          await fetch(
            `${apiBaseUrl}/api/chart-export/options?fileName=${encodeURIComponent(data.fileName)}`,
            { method: 'DELETE' },
          ).catch(() => null)
          throw new Error(getProblemMessage(
            problem,
            `The replacement was generated, but ${source.fileName} could not be removed.`,
          ))
        }
      }

      setResult(data)
      setStatus('success')
      await onCreated(data)
    } catch (requestError) {
      setStatus('error')
      setError(requestError instanceof Error ? requestError.message : 'Unable to generate the Excel file.')
    }
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && !isLoading && onClose()}
      role="presentation"
    >
      <section aria-labelledby="add-chart-source-title" aria-modal="true" className="generator-modal" role="dialog">
        <header className="generator-modal-header">
          <div>
            <p className="modal-eyebrow">Chart Excel files</p>
            <h2 id="add-chart-source-title">{isUpdate ? 'Update Excel File' : 'Add New Excel File'}</h2>
          </div>
          <button aria-label="Close" className="modal-close" disabled={isLoading} onClick={onClose} type="button">
            &times;
          </button>
        </header>

        <form className="generator-form" onSubmit={submit}>
          <div className="generator-field">
            <label htmlFor="new-chart-file-name">File name</label>
            <input
              autoFocus
              id="new-chart-file-name"
              onChange={(event) => setFileName(event.target.value)}
              placeholder="Example: KALYAN MORNING.xlsx"
              required
              value={fileName}
            />
            <span className="field-hint">The API adds .xlsx when no supported extension is supplied.</span>
          </div>

          <div className="generator-field">
            <label htmlFor="new-chart-display-name">Display name</label>
            <input
              id="new-chart-display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Example: Kalyan Morning"
              required
              value={displayName}
            />
          </div>

          <div className="generator-field">
            <label htmlFor="new-chart-url">Chart URL</label>
            <input
              id="new-chart-url"
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Enter chart page URL"
              required
              type="url"
              value={url}
            />
          </div>

          {error && <div className="generator-message error" role="alert">{error}</div>}
          {result && (
            <div className="generator-message success" role="status">
              <strong>{result.fileName}</strong> {isUpdate ? 'updated' : 'generated'} with {result.rowCount.toLocaleString()} rows.
            </div>
          )}

          <footer className="generator-actions">
            <button className="secondary-button" disabled={isLoading} onClick={onClose} type="button">
              {result ? 'Close' : 'Cancel'}
            </button>
            <button className="primary-button" disabled={isLoading || Boolean(result)} type="submit">
              {isLoading
                ? isUpdate ? 'Updating...' : 'Generating...'
                : result
                  ? isUpdate ? 'Updated' : 'Generated'
                  : isUpdate ? 'Update Excel' : 'Generate Excel'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function ChartFilesPage({ onBack, onGenerated, onRemoved }) {
  const [sources, setSources] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingSource, setEditingSource] = useState(null)
  const [openingFileName, setOpeningFileName] = useState('')
  const [removingFileName, setRemovingFileName] = useState('')

  const loadSources = async (signal) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/options`, { signal })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(getProblemMessage(data, `Options request failed with status ${response.status}.`))
      }

      const nextSources = Array.isArray(data?.sources) ? data.sources : []
      setSources(nextSources)
      setStatus(nextSources.length > 0 ? 'success' : 'empty')
      setError('')
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setStatus('error')
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Excel files.')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadSources(controller.signal)
    return () => controller.abort()
  }, [])

  const sourceCreated = async (result) => {
    await loadSources()
    await onGenerated(result)
  }

  const openAddSource = () => {
    setEditingSource(null)
    setIsAddOpen(true)
  }

  const openUpdateSource = (source) => {
    setEditingSource(source)
    setIsAddOpen(true)
  }

  const closeSourceEditor = () => {
    setIsAddOpen(false)
    setEditingSource(null)
  }

  const openFile = async (source) => {
    setOpeningFileName(source.fileName)
    setError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: source.fileName }),
      })

      if (!response.ok) {
        const problem = await response.json().catch(() => null)
        throw new Error(getProblemMessage(problem, `Open request failed with status ${response.status}.`))
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to open the Excel file.')
    } finally {
      setOpeningFileName('')
    }
  }

  const removeSource = async (source) => {
    const confirmed = window.confirm(
      `Remove "${source.displayName}"? The current ${source.fileName} will be saved in a dated backup before it and its JSON configuration are removed.`,
    )
    if (!confirmed) return

    setRemovingFileName(source.fileName)
    setError('')

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/chart-export/options?fileName=${encodeURIComponent(source.fileName)}`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        const problem = await response.json().catch(() => null)
        throw new Error(getProblemMessage(problem, `Remove request failed with status ${response.status}.`))
      }

      await loadSources()
      await onRemoved(source.fileName)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to remove the Excel file.')
    } finally {
      setRemovingFileName('')
    }
  }

  return (
    <main className="page-shell chart-files-page">
      <PageHeader
        actions={<button className="generate-link" onClick={onBack} type="button">Back to Explorer</button>}
      />

      <section className="chart-files-card">
        <header className="chart-files-card-header">
          <div>
            <h2>Generated Chart Excel Files</h2>
            <p>
              Manage {sources.length.toLocaleString()} configured file{sources.length === 1 ? '' : 's'} and their game-selector names.
            </p>
          </div>
          <button className="primary-button add-chart-file-button" onClick={openAddSource} type="button">
            + Add New
          </button>
        </header>

        {status === 'loading' && <div className="chart-files-state">Loading Excel files...</div>}
        {error && <div className="generator-message error chart-files-error" role="alert">{error}</div>}
        {status === 'empty' && (
          <div className="chart-files-state">
            <strong>No Excel files configured</strong>
            <span>Use Add New to generate the first chart workbook.</span>
          </div>
        )}
        {status === 'success' && (
          <div className="chart-files-table-wrap">
            <table className="chart-files-table">
              <thead>
                <tr>
                  <th>Display name</th>
                  <th>File name</th>
                  <th>Chart URL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.fileName}>
                    <td><strong>{source.displayName}</strong></td>
                    <td><code>{source.fileName}</code></td>
                    <td><a href={source.url} rel="noopener noreferrer" target="_blank">{source.url}</a></td>
                    <td>
                      <div className="chart-file-actions">
                        <button
                          className="open-chart-file-button"
                          disabled={Boolean(openingFileName || removingFileName)}
                          onClick={() => openFile(source)}
                          type="button"
                        >
                          {openingFileName === source.fileName ? 'Opening...' : 'Open File'}
                        </button>
                        <button
                          className="update-chart-file-button"
                          disabled={Boolean(openingFileName || removingFileName)}
                          onClick={() => openUpdateSource(source)}
                          type="button"
                        >
                          Update
                        </button>
                        <a className="source-open-button" href={source.url} rel="noopener noreferrer" target="_blank">Open URL</a>
                        <button
                          className="remove-chart-file-button"
                          disabled={Boolean(openingFileName || removingFileName)}
                          onClick={() => removeSource(source)}
                          type="button"
                        >
                          {removingFileName === source.fileName ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isAddOpen && (
        <AddChartSourceModal
          onClose={closeSourceEditor}
          onCreated={sourceCreated}
          source={editingSource}
        />
      )}
    </main>
  )
}

function getRankedGuessNumbers(analysis) {
  const groups = analysis.patternGroups ?? [{
    label: patternOptions.find((option) => option.value === analysis.pattern)?.label ?? 'Selected Pattern',
    nextNumberCounts: analysis.nextNumberCounts,
  }]
  const totals = new Map()

  groups.forEach((group) => {
    group.nextNumberCounts.forEach((row) => {
      const key = String(row.number)
      const current = totals.get(key) ?? { number: key, total: 0, patterns: [] }
      const count = Number(row.count) || 0

      current.total += count
      current.patterns.push({ count, label: group.label })
      totals.set(key, current)
    })
  })

  return [...totals.values()].sort(
    (first, second) => second.total - first.total || first.number.localeCompare(second.number, undefined, { numeric: true }),
  )
}

function NumberAnalysisModal({ analysis, onClose }) {
  const [topCount, setTopCount] = useState('all')
  const allRankedNumbers = getRankedGuessNumbers(analysis)
  const rankedNumbers = topCount === 'all'
    ? allRankedNumbers
    : allRankedNumbers.slice(0, Number(topCount))

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
      <section aria-labelledby="number-analysis-title" aria-modal="true" className="number-analysis-modal" role="dialog">
        <header className="number-analysis-header">
          <div>
            <p className="modal-eyebrow">Next number count</p>
            <h2 id="number-analysis-title">Guess Number Analysis</h2>
          </div>
          <button aria-label="Close analysis" className="modal-close" onClick={onClose} type="button">
            &times;
          </button>
        </header>

        <div className="number-analysis-controls">
          <div>
            <strong>Best-ranked guesses</strong>
            <span>Combined by occurrence count across the selected patterns.</span>
          </div>
          <label htmlFor="analysis-top-count">
            Show
            <select
              id="analysis-top-count"
              onChange={(event) => setTopCount(event.target.value)}
              value={topCount}
            >
              <option value="all">All Numbers</option>
              <option value="3">Top 3</option>
              <option value="2">Top 2</option>
              <option value="1">Top 1</option>
            </select>
          </label>
        </div>

        <div className="ranked-guess-list">
          {rankedNumbers.map((item, index) => (
            <article className="ranked-guess" key={item.number}>
              <span className="guess-rank">#{index + 1}</span>
              <strong className="ranked-number">{item.number}</strong>
              <div className="ranked-guess-details">
                <strong>{item.total.toLocaleString()} times</strong>
                <div className="pattern-breakdown">
                  {item.patterns
                    .sort((first, second) => second.count - first.count)
                    .map((pattern) => (
                      <span key={pattern.label}>{pattern.label}: {pattern.count}</span>
                    ))}
                </div>
              </div>
            </article>
          ))}
          {rankedNumbers.length === 0 && (
            <div className="analysis-empty-state">No next-number data is available for analysis.</div>
          )}
        </div>
      </section>
    </div>
  )
}

function getLatestGuessNumbers(analysis, count, skipLastNumbers = 0) {
  const numberCount = Number(count)
  if (!analysis || !numberCount) {
    return ''
  }

  const latestNumbers = (analysis.latestNumbers ?? [])
    .map((value) => String(value ?? '').trim())
    .filter((value) => value && value !== '*')
  if (latestNumbers.length > 0) {
    const skipCount = Number(skipLastNumbers) || 0
    const calculationNumbers = skipCount > 0
      ? latestNumbers.slice(0, -skipCount)
      : latestNumbers
    return calculationNumbers.slice(-numberCount).join(',')
  }

  const activeDays = getActivePanelDays(analysis)
  const values = [...(analysis.currentDataWeeks ?? [])]
    .reverse()
    .flatMap((week) => activeDays.map((day) => week.days?.[day]?.number))
    .map((value) => String(value ?? '').trim())
    .filter((value) => value && value !== '*')

  return values.slice(-numberCount).join(',')
}

function getActivePanelDays(analysis) {
  if (!analysis) {
    return []
  }

  const availableDays = analysis.availableDays ?? []
  const panelRows = analysis.panelRows ?? []
  const activeDays = availableDays.filter((day) => panelRows.some((row) => {
    const panelDay = row.days?.[day]
    return panelDay && [panelDay.open, panelDay.close, panelDay.pair].some(
      (value) => String(value ?? '').trim() !== '',
    )
  }))

  return activeDays.length > 0 ? activeDays : availableDays
}

function getPredictedNumbers(data, patternLabel) {
  const structuredNumbers = Array.isArray(data?.predictedNumbers)
    ? data.predictedNumbers.map((number) => String(number ?? '').trim())
    : []
  if (
    structuredNumbers.length === 3
    && structuredNumbers.every((number) => /^[0-9]$/.test(number))
    && new Set(structuredNumbers).size === 3
  ) {
    return structuredNumbers
  }

  const structuredNumber = String(data?.predictedNumber ?? '').trim()
  if (/^[0-9]$/.test(structuredNumber)) {
    return [structuredNumber]
  }

  const markerMatch = String(data?.prediction ?? '').match(
    /FINAL_PREDICTED_NUMBER\s*:\s*(?:\*\*)?([0-9])(?:\*\*)?/i,
  )
  if (markerMatch) {
    return [markerMatch[1]]
  }

  throw new Error(`${patternLabel} did not return a valid next predicted number.`)
}

async function requestPatternPrediction(option, analysis, configuredSeriesDays) {
  const seriesDayLimit = getSeriesDayLimit(configuredSeriesDays)
  const series = getCurrentDataSeries(analysis, seriesDayLimit)
  if (series.length === 0) {
    throw new Error(`${option.label} requires at least one valid Current Data value.`)
  }

  const seriesData = series.join(',')
  const response = await fetch(`${apiBaseUrl}${option.endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      predictionMode: option.predictionMode ?? 'Standard',
      seriesData,
    }),
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(getProblemMessage(
      data,
      `${option.label} request failed with status ${response.status}.`,
    ))
  }

  return {
    dataPointCount: series.length,
    label: option.label,
    model: data.model,
    pattern: option.value,
    predictedNumbers: getPredictedNumbers(data, option.label),
    prediction: data.prediction,
    seriesData,
    seriesDayLimit,
  }
}

function addPredictionResultsToAnalysis(analysis, responses, selectedPanelOptions) {
  if (responses.length === 0) {
    return analysis
  }

  const panelGroups = analysis.patternGroups ?? selectedPanelOptions.map((option) => ({
    label: option.label,
    matchLines: analysis.matchLines,
    nextNumberCounts: analysis.nextNumberCounts,
    pattern: option.value,
  }))
  const predictionGroups = responses.map((response) => ({
    label: response.label,
    matchLines: [],
    nextNumberCounts: response.predictedNumbers.map((number, index) => ({
      count: 0,
      isPrediction: true,
      number,
      predictionRank: index + 1,
    })),
    pattern: response.pattern,
  }))

  return {
    ...analysis,
    nextNumberCounts: [
      ...analysis.nextNumberCounts,
      ...predictionGroups.flatMap((group) => group.nextNumberCounts),
    ],
    patternGroups: [...panelGroups, ...predictionGroups],
  }
}

function createPredictionOnlyAnalysis(baseAnalysis, selectedPredictionOptions) {
  return {
    ...baseAnalysis,
    guessNumbers: '',
    matchLines: [],
    matchingRowIds: [],
    nextNumberCounts: [],
    pattern: selectedPredictionOptions.length === 1 ? selectedPredictionOptions[0].value : 'Multiple',
    patternGroups: [],
    patternLabel: selectedPredictionOptions.length === 1
      ? selectedPredictionOptions[0].label
      : `${selectedPredictionOptions.length} AI Patterns`,
    threeTouch: null,
  }
}

function combinePatternAnalyses(patternAnalyses) {
  const firstAnalysis = patternAnalyses[0]?.analysis
  if (!firstAnalysis) {
    return null
  }

  const patternGroups = patternAnalyses.map(({ analysis, label, pattern }) => ({
    label,
    matchLines: analysis.matchLines,
    nextNumberCounts: analysis.nextNumberCounts,
    pattern,
  }))
  const threeTouch = patternAnalyses.find(({ analysis }) => analysis.threeTouch)?.analysis.threeTouch ?? null

  return {
    ...firstAnalysis,
    pattern: patternAnalyses.length === panelPatternOptions.length ? 'All' : 'Multiple',
    patternLabel: patternAnalyses.length === panelPatternOptions.length
      ? 'All Pattern'
      : `${patternAnalyses.length} Patterns`,
    matchLines: patternGroups.flatMap((group) => group.matchLines),
    matchingRowIds: [...new Set(patternAnalyses.flatMap(({ analysis }) => analysis.matchingRowIds))],
    nextNumberCounts: patternGroups.flatMap((group) => group.nextNumberCounts),
    patternGroups,
    threeTouch,
  }
}

export default function App() {
  const [activePage, setActivePage] = useState(getPageFromPath)
  const [games, setGames] = useState([])
  const [selectedPatterns, setSelectedPatterns] = useState(['Sequence'])
  const [selectedGame, setSelectedGame] = useState('')
  const [gamesStatus, setGamesStatus] = useState('loading')
  const [numberType, setNumberType] = useState('Open')
  const [numbers, setNumbers] = useState('')
  const [latestCount, setLatestCount] = useState('3')
  const [aigSeriesDays, setAigSeriesDays] = useState('30')
  const [skipLastNumbers, setSkipLastNumbers] = useState('1')
  const [analysis, setAnalysis] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false)
  const [isNumberAnalysisOpen, setIsNumberAnalysisOpen] = useState(false)
  const [generatorUrl, setGeneratorUrl] = useState('')
  const [generatorFileName, setGeneratorFileName] = useState('')
  const [generatorSources, setGeneratorSources] = useState([])
  const [generatorStatus, setGeneratorStatus] = useState('idle')
  const [generatorError, setGeneratorError] = useState('')
  const [generatorResult, setGeneratorResult] = useState(null)
  const [patternResponses, setPatternResponses] = useState([])
  const [isPatternResponsesOpen, setIsPatternResponsesOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadGames = async () => {
      try {
        const data = await fetchGames(controller.signal)
        setGames(data)
        setSelectedGame(data[0]?.fileName ?? '')
        setGamesStatus(data.length > 0 ? 'success' : 'empty')
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') {
          return
        }

        setGamesStatus('error')
        setError(requestError instanceof Error ? requestError.message : 'Unable to load game files.')
      }
    }

    loadGames()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const handlePopState = () => setActivePage(getPageFromPath())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateToPage = (page) => {
    const path = page === 'excel-files' ? dataSheetPath : '/'
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setActivePage(page)
    window.scrollTo({ top: 0 })
  }

  const selectedGameDetails = games.find((game) => game.fileName === selectedGame)
  const selectedGameName = selectedGameDetails?.displayName
  const selectedSourceUrl = selectedGameDetails?.sourceUrl
  const analysisDays = getActivePanelDays(analysis)
  const analysisPatternLabel = analysis?.patternLabel ?? patternOptions.find(
    (option) => option.value === analysis?.pattern,
  )?.label ?? 'Sequence Pattern'

  const openGenerator = async () => {
    setGeneratorError('')
    setGeneratorResult(null)
    setGeneratorStatus('idle')
    setIsGeneratorOpen(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/options`)
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(getProblemMessage(data, `Options request failed with status ${response.status}.`))
      }

      const sources = Array.isArray(data?.sources) ? data.sources : []
      const selectedSource = sources.find((source) => source.fileName === generatorFileName) ?? sources[0]

      setGeneratorSources(sources)
      setGeneratorFileName(selectedSource?.fileName ?? '')
      setGeneratorUrl(selectedSource?.url ?? '')
    } catch (requestError) {
      setGeneratorError(
        requestError instanceof Error ? requestError.message : 'Unable to load generator defaults.',
      )
    }
  }

  const changeGeneratorSource = (fileName) => {
    const source = generatorSources.find((item) => item.fileName === fileName)
    setGeneratorFileName(fileName)
    setGeneratorUrl(source?.url ?? '')
    setGeneratorError('')
    setGeneratorResult(null)
  }

  const closeGenerator = () => {
    if (generatorStatus !== 'loading') {
      setIsGeneratorOpen(false)
    }
  }

  const generateExcel = async (event) => {
    event.preventDefault()
    setGeneratorStatus('loading')
    setGeneratorError('')
    setGeneratorResult(null)

    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: generatorUrl, fileName: generatorFileName }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(getProblemMessage(data, `Generation request failed with status ${response.status}.`))
      }

      setGeneratorResult(data)
      setGeneratorStatus('success')
      setGeneratorSources((currentSources) => currentSources.map((source) => (
        source.fileName === generatorFileName ? { ...source, url: generatorUrl } : source
      )))
      setNumbers('')
      setAnalysis(null)
      setStatus('idle')
      setError('')

      try {
        const refreshedGames = await fetchGames()
        setGames(refreshedGames)
        setGamesStatus(refreshedGames.length > 0 ? 'success' : 'empty')
        setSelectedGame(
          refreshedGames.some((game) => game.fileName === data.fileName)
            ? data.fileName
            : refreshedGames[0]?.fileName ?? '',
        )
      } catch (refreshError) {
        setError(
          refreshError instanceof Error
            ? `Excel was generated, but the game list could not refresh: ${refreshError.message}`
            : 'Excel was generated, but the game list could not refresh.',
        )
      }
    } catch (requestError) {
      setGeneratorStatus('error')
      setGeneratorError(requestError instanceof Error ? requestError.message : 'Unable to generate the Excel file.')
    }
  }

  const chartFileGenerated = async (result) => {
    setNumbers('')
    setAnalysis(null)
    setStatus('idle')
    setError('')

    try {
      const refreshedGames = await fetchGames()
      setGames(refreshedGames)
      setGamesStatus(refreshedGames.length > 0 ? 'success' : 'empty')
      setSelectedGame(
        refreshedGames.some((game) => game.fileName === result.fileName)
          ? result.fileName
          : refreshedGames[0]?.fileName ?? '',
      )
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? `Excel was generated, but the game list could not refresh: ${refreshError.message}`
          : 'Excel was generated, but the game list could not refresh.',
      )
    }
  }

  const chartFileRemoved = async (removedFileName) => {
    setNumbers('')
    setAnalysis(null)
    setStatus('idle')

    try {
      const refreshedGames = await fetchGames()
      setGames(refreshedGames)
      setGamesStatus(refreshedGames.length > 0 ? 'success' : 'empty')
      setSelectedGame((currentGame) => (
        currentGame !== removedFileName && refreshedGames.some((game) => game.fileName === currentGame)
          ? currentGame
          : refreshedGames[0]?.fileName ?? ''
      ))
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh the game list.')
    }
  }

  const changeGame = (event) => {
    setSelectedGame(event.target.value)
    setNumbers('')
    setAnalysis(null)
    setStatus('idle')
    setError('')
  }

  const changePatterns = (nextPatterns) => {
    if (
      nextPatterns.length === selectedPatterns.length
      && nextPatterns.every((patternValue) => selectedPatterns.includes(patternValue))
    ) {
      return
    }

    if (numbers.trim()) {
      const shouldClear = window.confirm(
        'Guess Numbers must be blank before changing Pattern. Clear Guess Numbers and continue?',
      )

      if (!shouldClear) {
        return
      }
    }

    setNumbers('')
    setAnalysis(null)
    setStatus('idle')
    setError('')
    setSelectedPatterns(nextPatterns)
  }

  const changeNumberType = (event) => {
    const nextNumberType = event.target.value
    if (nextNumberType === numberType) {
      return
    }

    if (numbers.trim()) {
      const shouldClear = window.confirm(
        'Guess Numbers must be blank before changing Number Type. Clear Guess Numbers and continue?',
      )

      if (!shouldClear) {
        return
      }
    }

    setNumbers('')
    setAnalysis(null)
    setStatus('idle')
    setError('')
    setNumberType(nextNumberType)
  }

  const changeLatestCount = (event) => {
    const nextCount = event.target.value
    setLatestCount(nextCount)

    if (!nextCount) {
      setNumbers('')
      return
    }

    if (analysis) {
      setNumbers(getLatestGuessNumbers(analysis, nextCount, skipLastNumbers))
    }
  }

  const changeSkipLastNumbers = (event) => {
    const nextSkipCount = event.target.value
    if (analysis && latestCount) {
      setNumbers(getLatestGuessNumbers(analysis, latestCount, nextSkipCount))
    }

    setSkipLastNumbers(nextSkipCount)
    setAnalysis(null)
    setStatus('idle')
    setError('')
  }

  const changeAigSeriesDays = (event) => {
    setAigSeriesDays(event.target.value)
    setAnalysis(null)
    setPatternResponses([])
    setIsPatternResponsesOpen(false)
    setStatus('idle')
    setError('')
  }

  const runAnalysis = async (event) => {
    event.preventDefault()
    setIsNumberAnalysisOpen(false)
    setIsPatternResponsesOpen(false)
    setPatternResponses([])

    if (selectedPatterns.length === 0) {
      setError('Select at least one pattern before searching.')
      return
    }

    if (!selectedGame) {
      setError('No Excel game file is available. Add an .xlsx or .xlsm file to the API Files folder.')
      return
    }

    setStatus('loading')
    setError('')

    try {
      const requestAnalysis = async (guessNumbers, requestedPattern) => {
        const response = await fetch(`${apiBaseUrl}/api/panel/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pattern: requestedPattern,
            fileName: selectedGame,
            numberType,
            numbers: guessNumbers,
            skipLastNumbers: Number(skipLastNumbers || 0),
          }),
        })

        if (!response.ok) {
          const problem = await response.json().catch(() => null)
          throw new Error(getProblemMessage(problem, `Analysis request failed with status ${response.status}.`))
        }

        return response.json()
      }

      const selectedPanelPatternOptions = panelPatternOptions.filter(
        (option) => selectedPatterns.includes(option.value),
      )
      const selectedPredictionPatternOptions = predictionPatternOptions.filter(
        (option) => selectedPatterns.includes(option.value),
      )
      const requestSelectedPatterns = async (guessNumbers, seed = null) => {
        const patternAnalyses = await Promise.all(selectedPanelPatternOptions.map(async (option) => ({
          analysis: seed?.pattern === option.value
            ? seed.analysis
            : await requestAnalysis(guessNumbers, option.value),
          label: option.label,
          pattern: option.value,
        })))

        return combinePatternAnalyses(patternAnalyses)
      }

      let data

      if (selectedPanelPatternOptions.length === 0) {
        const seedAnalysis = await requestAnalysis('', 'Sequence')
        data = createPredictionOnlyAnalysis(seedAnalysis, selectedPredictionPatternOptions)
      } else if (!numbers.trim() && latestCount) {
        const seedPattern = selectedPanelPatternOptions[0].value
        const seedAnalysis = await requestAnalysis('', seedPattern)
        const latestNumbers = getLatestGuessNumbers(seedAnalysis, latestCount, skipLastNumbers)
        const seedMatchesSelection = latestNumbers === seedAnalysis.guessNumbers

        if (selectedPanelPatternOptions.length > 1) {
          data = await requestSelectedPatterns(
            latestNumbers,
            seedMatchesSelection ? { analysis: seedAnalysis, pattern: seedPattern } : null,
          )
        } else {
          data = seedMatchesSelection
            ? seedAnalysis
            : await requestAnalysis(latestNumbers, seedPattern)
        }
      } else {
        data = selectedPanelPatternOptions.length > 1
          ? await requestSelectedPatterns(numbers)
          : await requestAnalysis(numbers, selectedPanelPatternOptions[0].value)
      }

      if (!data) {
        throw new Error('No pattern analysis was returned.')
      }

      const responses = await Promise.all(
        selectedPredictionPatternOptions.map(
          (option) => requestPatternPrediction(option, data, aigSeriesDays),
        ),
      )
      const analysisWithPredictions = addPredictionResultsToAnalysis(
        data,
        responses,
        selectedPanelPatternOptions,
      )

      setAnalysis(analysisWithPredictions)
      setPatternResponses(responses)
      setNumbers(latestCount ? data.guessNumbers : '')
      setStatus('success')
    } catch (requestError) {
      setAnalysis(null)
      setPatternResponses([])
      setStatus('error')
      setError(requestError instanceof Error ? requestError.message : 'Unable to analyze panel data.')
    }
  }

  if (activePage === 'excel-files') {
    return (
      <ChartFilesPage
        onBack={() => navigateToPage('explorer')}
        onGenerated={chartFileGenerated}
        onRemoved={chartFileRemoved}
      />
    )
  }

  return (
    <main className="page-shell">
      <PageHeader
        actions={(
          <>
            <button className="generate-link" onClick={() => navigateToPage('excel-files')} type="button">
              Excel Files
            </button>
            {analysis && (
              <div className="summary-chip">
                <strong>{analysis.matchLines.length}</strong>
                <span>matches found</span>
              </div>
            )}
          </>
        )}
      />

      <SearchControls
        aigSeriesDays={aigSeriesDays}
        games={games}
        gamesStatus={gamesStatus}
        latestCount={latestCount}
        numberType={numberType}
        numbers={numbers}
        onGameChange={changeGame}
        onAigSeriesDaysChange={changeAigSeriesDays}
        onLatestCountChange={changeLatestCount}
        onNumbersChange={setNumbers}
        onNumberTypeChange={changeNumberType}
        onPatternChange={changePatterns}
        onSkipLastNumbersChange={changeSkipLastNumbers}
        onSubmit={runAnalysis}
        selectedGame={selectedGame}
        selectedGameName={selectedGameName}
        selectedPatterns={selectedPatterns}
        selectedSourceUrl={selectedSourceUrl}
        skipLastNumbers={skipLastNumbers}
        status={status}
      />

      {error && (
        <div className="error-message" role="alert">
          <strong>Could not complete the search.</strong>
          <span>{error}</span>
        </div>
      )}

      {!analysis && status !== 'loading' && (
        <section className="empty-state">
          <div aria-hidden="true">⌕</div>
          <h2>Ready to search the panel history</h2>
          <p>Leave Guess Numbers blank to use the latest three digits, or enter your own sequence.</p>
        </section>
      )}

      {status === 'loading' && (
        <section className="empty-state loading-state" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <h2>Analyzing panel history…</h2>
          <p>Building the daily sequence and finding matching lines.</p>
        </section>
      )}

      {analysis && (
        <div className="results" aria-live="polite">
          <div className="analysis-grid">
            <CurrentDataSection
              days={analysisDays}
              matchingRowIds={analysis.matchingRowIds}
              numberType={analysis.numberType}
              weeks={analysis.currentDataWeeks}
            />
            <NextNumberCountSection
              analysis={analysis}
              onOpenAnalysis={() => setIsNumberAnalysisOpen(true)}
              onOpenPatternResponses={() => setIsPatternResponsesOpen(true)}
              patternLabel={analysisPatternLabel}
              patternResponseCount={patternResponses.length}
            />
            <MatchLinesSection analysis={analysis} patternLabel={analysisPatternLabel} />
          </div>
          {analysis.threeTouch && (
            <ThreeTouchPatternSection
              numberType={analysis.numberType}
              threeTouch={analysis.threeTouch}
            />
          )}
          <OriginalPanelDataSection
            days={analysisDays}
            gameName={selectedGameName}
            rows={analysis.panelRows}
          />
        </div>
      )}

      {isGeneratorOpen && (
        <ChartGeneratorModal
          error={generatorError}
          fileName={generatorFileName}
          onClose={closeGenerator}
          onSourceChange={changeGeneratorSource}
          onSubmit={generateExcel}
          onUrlChange={setGeneratorUrl}
          result={generatorResult}
          sources={generatorSources}
          status={generatorStatus}
          url={generatorUrl}
        />
      )}

      {isNumberAnalysisOpen && analysis && (
        <NumberAnalysisModal analysis={analysis} onClose={() => setIsNumberAnalysisOpen(false)} />
      )}

      {isPatternResponsesOpen && patternResponses.length > 0 && (
        <PatternResponseModal
          onClose={() => setIsPatternResponsesOpen(false)}
          responses={patternResponses}
        />
      )}
    </main>
  )
}
