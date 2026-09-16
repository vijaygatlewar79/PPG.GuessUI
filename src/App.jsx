import { useEffect, useRef, useState } from "react";
import { getApiEnvironment } from "./apiConfig";
import PageHeader from "./components/PageHeader";
import CurrentDataSection from "./components/explorer/CurrentDataSection";
import MatchLinesSection from "./components/explorer/MatchLinesSection";
import NextNumberCountSection from "./components/explorer/NextNumberCountSection";
import OriginalPanelDataSection from "./components/explorer/OriginalPanelDataSection";
import PatternResponseModal from "./components/explorer/PatternResponseModal";
import SearchControls from "./components/explorer/SearchControls";
import ThreeTouchPatternSection from "./components/explorer/ThreeTouchPatternSection";
import {
  getCurrentDataSeries,
  getSeriesDayLimit,
} from "./components/explorer/seriesSelection";
import {
  panelPatternOptions,
  patternOptions,
  predictionPatternOptions,
} from "./components/explorer/patternOptions";

const dataSheetPath = "/DataSheet";

function getPageFromPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path.toLowerCase() === dataSheetPath.toLowerCase()
    ? "excel-files"
    : "explorer";
}

async function fetchGames(apiBaseUrl, signal) {
  const response = await fetch(`${apiBaseUrl}/api/panel/games`, { signal });
  if (!response.ok) {
    throw new Error(`Game list request failed with status ${response.status}.`);
  }

  const games = await response.json();
  return [...games].sort((first, second) => {
    const firstOrder = Number.isFinite(first.orderBy)
      ? first.orderBy
      : Number.MAX_SAFE_INTEGER;
    const secondOrder = Number.isFinite(second.orderBy)
      ? second.orderBy
      : Number.MAX_SAFE_INTEGER;

    return (
      firstOrder - secondOrder ||
      first.displayName.localeCompare(second.displayName) ||
      first.fileName.localeCompare(second.fileName)
    );
  });
}

function getProblemMessage(problem, fallback) {
  if (problem?.errors) {
    return Object.values(problem.errors).flat().find(Boolean) || fallback;
  }

  return problem?.detail || problem?.title || fallback;
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
  const isGenerating = status === "loading";
  const isLoadingOptions = status === "loading-options";
  const isLoading = isGenerating || isLoadingOptions;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !isGenerating && onClose()
      }
      role="presentation"
    >
      <section
        aria-labelledby="chart-generator-title"
        aria-modal="true"
        className="generator-modal"
        role="dialog"
      >
        <header className="generator-modal-header">
          <div>
            <p className="modal-eyebrow">Panel data import</p>
            <h2 id="chart-generator-title">Generate Excel from URL</h2>
          </div>
          <button
            aria-label="Close generator"
            className="modal-close"
            disabled={isGenerating}
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </header>

        <form className="generator-form" onSubmit={onSubmit}>
          <div className="generator-field">
            <label htmlFor="chart-file-name">File name</label>
            <select
              autoFocus
              disabled={isLoading}
              id="chart-file-name"
              onChange={(event) => onSourceChange(event.target.value)}
              required
              value={fileName}
            >
              {sources.length === 0 && (
                <option value="">No chart sources configured</option>
              )}
              {sources.map((source) => (
                <option key={source.fileName} value={source.fileName}>
                  {source.displayName ?? source.fileName}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Options are loaded from the API chart-sources.json file.
            </span>
          </div>

          <div className="generator-field">
            <label htmlFor="chart-url">Chart URL</label>
            <input
              disabled={isLoading}
              id="chart-url"
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="Enter chart page URL"
              required
              type="url"
              value={url}
            />
            <span className="field-hint">
              Changing this URL and generating the file updates its JSON entry.
            </span>
          </div>

          {error && (
            <div className="generator-message error" role="alert">
              {error}
            </div>
          )}
          {result && (
            <div className="generator-message success" role="status">
              <strong>{result.fileName}</strong> generated with{" "}
              {result.rowCount.toLocaleString()} rows and added to the game
              list.
            </div>
          )}

          <footer className="generator-actions">
            <button
              className="secondary-button"
              disabled={isGenerating}
              onClick={onClose}
              type="button"
            >
              {result ? "Close" : "Cancel"}
            </button>
            <button
              className="primary-button"
              disabled={isLoading}
              type="submit"
            >
              {isLoadingOptions
                ? "Loading options..."
                : isGenerating
                  ? "Generating..."
                  : result
                    ? "Generate again"
                    : "Generate Excel"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function AddChartSourceModal({
  apiBaseUrl,
  onClose,
  onCreated,
  source = null,
}) {
  const isUpdate = Boolean(source);
  const [fileName, setFileName] = useState(source?.fileName ?? "");
  const [displayName, setDisplayName] = useState(source?.displayName ?? "");
  const [url, setUrl] = useState(source?.url ?? "");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const isLoading = status === "loading";

  const submit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, displayName, url }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getProblemMessage(
            data,
            `Generation request failed with status ${response.status}.`,
          ),
        );
      }

      if (
        source &&
        data.fileName.toLowerCase() !== source.fileName.toLowerCase()
      ) {
        const removeResponse = await fetch(
          `${apiBaseUrl}/api/chart-export/options?fileName=${encodeURIComponent(source.fileName)}&backupAction=Update`,
          { method: "DELETE" },
        );

        if (!removeResponse.ok) {
          const problem = await removeResponse.json().catch(() => null);
          await fetch(
            `${apiBaseUrl}/api/chart-export/options?fileName=${encodeURIComponent(data.fileName)}`,
            { method: "DELETE" },
          ).catch(() => null);
          throw new Error(
            getProblemMessage(
              problem,
              `The replacement was generated, but ${source.fileName} could not be removed.`,
            ),
          );
        }
      }

      setResult(data);
      setStatus("success");
      await onCreated(data);
    } catch (requestError) {
      setStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate the Excel file.",
      );
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !isLoading && onClose()
      }
      role="presentation"
    >
      <section
        aria-labelledby="add-chart-source-title"
        aria-modal="true"
        className="generator-modal"
        role="dialog"
      >
        <header className="generator-modal-header">
          <div>
            <p className="modal-eyebrow">Chart Excel files</p>
            <h2 id="add-chart-source-title">
              {isUpdate ? "Update Excel File" : "Add New Excel File"}
            </h2>
          </div>
          <button
            aria-label="Close"
            className="modal-close"
            disabled={isLoading}
            onClick={onClose}
            type="button"
          >
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
            <span className="field-hint">
              The API adds .xlsx when no supported extension is supplied.
            </span>
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

          {error && (
            <div className="generator-message error" role="alert">
              {error}
            </div>
          )}
          {result && (
            <div className="generator-message success" role="status">
              <strong>{result.fileName}</strong>{" "}
              {isUpdate ? "updated" : "generated"} with{" "}
              {result.rowCount.toLocaleString()} rows.
            </div>
          )}

          <footer className="generator-actions">
            <button
              className="secondary-button"
              disabled={isLoading}
              onClick={onClose}
              type="button"
            >
              {result ? "Close" : "Cancel"}
            </button>
            <button
              className="primary-button"
              disabled={isLoading || Boolean(result)}
              type="submit"
            >
              {isLoading
                ? isUpdate
                  ? "Updating..."
                  : "Generating..."
                : result
                  ? isUpdate
                    ? "Updated"
                    : "Generated"
                  : isUpdate
                    ? "Update Excel"
                    : "Generate Excel"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function ChartFilesPage({
  apiBaseUrl,
  apiEnvironmentKey,
  onApiEnvironmentChange,
  onBack,
  onGenerated,
  onRemoved,
}) {
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSource, setEditingSource] = useState(null);
  const [openingFileName, setOpeningFileName] = useState("");
  const [removingFileName, setRemovingFileName] = useState("");

  const loadSources = async (signal) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/options`, {
        signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          getProblemMessage(
            data,
            `Options request failed with status ${response.status}.`,
          ),
        );
      }

      const nextSources = Array.isArray(data?.sources) ? data.sources : [];
      setSources(nextSources);
      setStatus(nextSources.length > 0 ? "success" : "empty");
      setError("");
    } catch (requestError) {
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      )
        return;
      setStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load Excel files.",
      );
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setSources([]);
    setStatus("loading");
    setError("");
    loadSources(controller.signal);
    return () => controller.abort();
  }, [apiBaseUrl]);

  const sourceCreated = async (result) => {
    await loadSources();
    await onGenerated(result);
  };

  const openAddSource = () => {
    setEditingSource(null);
    setIsAddOpen(true);
  };

  const openUpdateSource = (source) => {
    setEditingSource(source);
    setIsAddOpen(true);
  };

  const closeSourceEditor = () => {
    setIsAddOpen(false);
    setEditingSource(null);
  };

  const openFile = async (source) => {
    setOpeningFileName(source.fileName);
    setError("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/chart-export/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: source.fileName }),
      });

      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(
          getProblemMessage(
            problem,
            `Open request failed with status ${response.status}.`,
          ),
        );
      }

      const file = await response.blob();
      const objectUrl = URL.createObjectURL(file);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = source.fileName;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to open the Excel file.",
      );
    } finally {
      setOpeningFileName("");
    }
  };

  const removeSource = async (source) => {
    const confirmed = window.confirm(
      `Remove "${source.displayName}"? The current ${source.fileName} will be saved in a dated backup before it and its JSON configuration are removed.`,
    );
    if (!confirmed) return;

    setRemovingFileName(source.fileName);
    setError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/chart-export/options?fileName=${encodeURIComponent(source.fileName)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(
          getProblemMessage(
            problem,
            `Remove request failed with status ${response.status}.`,
          ),
        );
      }

      await loadSources();
      await onRemoved(source.fileName);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove the Excel file.",
      );
    } finally {
      setRemovingFileName("");
    }
  };

  return (
    <main className="page-shell chart-files-page">
      <PageHeader
        actions={
          <>
            <button className="generate-link" onClick={onBack} type="button">
              Back to Explorer
            </button>
          </>
        }
      />

      <section className="chart-files-card">
        <header className="chart-files-card-header">
          <div>
            <h2>Generated Chart Excel Files</h2>
            <p>
              Manage {sources.length.toLocaleString()} configured file
              {sources.length === 1 ? "" : "s"} and their game-selector names.
            </p>
          </div>
          <button
            className="primary-button add-chart-file-button"
            onClick={openAddSource}
            type="button"
          >
            + Add New
          </button>
        </header>

        {status === "loading" && (
          <div className="chart-files-state">Loading Excel files...</div>
        )}
        {error && (
          <div
            className="generator-message error chart-files-error"
            role="alert"
          >
            {error}
          </div>
        )}
        {status === "empty" && (
          <div className="chart-files-state">
            <strong>No Excel files configured</strong>
            <span>Use Add New to generate the first chart workbook.</span>
          </div>
        )}
        {status === "success" && (
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
                    <td>
                      <strong>{source.displayName}</strong>
                    </td>
                    <td>
                      <code>{source.fileName}</code>
                    </td>
                    <td>
                      <a
                        href={source.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {source.url}
                      </a>
                    </td>
                    <td>
                      <div className="chart-file-actions">
                        <button
                          className="open-chart-file-button"
                          disabled={Boolean(
                            openingFileName || removingFileName,
                          )}
                          onClick={() => openFile(source)}
                          type="button"
                        >
                          {openingFileName === source.fileName
                            ? "Opening..."
                            : "Open File"}
                        </button>
                        <button
                          className="update-chart-file-button"
                          disabled={Boolean(
                            openingFileName || removingFileName,
                          )}
                          onClick={() => openUpdateSource(source)}
                          type="button"
                        >
                          Update
                        </button>
                        <a
                          className="source-open-button"
                          href={source.url}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          Open URL
                        </a>
                        <button
                          className="remove-chart-file-button"
                          disabled={Boolean(
                            openingFileName || removingFileName,
                          )}
                          onClick={() => removeSource(source)}
                          type="button"
                        >
                          {removingFileName === source.fileName
                            ? "Removing..."
                            : "Remove"}
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
          apiBaseUrl={apiBaseUrl}
          onClose={closeSourceEditor}
          onCreated={sourceCreated}
          source={editingSource}
        />
      )}
    </main>
  );
}

function getRankedGuessNumbers(analysis) {
  const groups = analysis.patternGroups ?? [
    {
      label:
        patternOptions.find((option) => option.value === analysis.pattern)
          ?.label ?? "Selected Pattern",
      nextNumberCounts: analysis.nextNumberCounts,
    },
  ];
  const totals = new Map();

  groups.forEach((group) => {
    group.nextNumberCounts.forEach((row) => {
      const key = String(row.number);
      const current = totals.get(key) ?? {
        number: key,
        total: 0,
        patterns: [],
      };
      const count = Number(row.count) || 0;

      current.total += count;
      current.patterns.push({ count, label: group.label });
      totals.set(key, current);
    });
  });

  return [...totals.values()].sort(
    (first, second) =>
      second.total - first.total ||
      first.number.localeCompare(second.number, undefined, { numeric: true }),
  );
}

function NumberAnalysisModal({ analysis, gameName, onClose }) {
  const [topCount, setTopCount] = useState("all");
  const allRankedNumbers = getRankedGuessNumbers(analysis);
  const rankedNumbers =
    topCount === "all"
      ? allRankedNumbers
      : allRankedNumbers.slice(0, Number(topCount));

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <section
        aria-labelledby="number-analysis-title"
        aria-modal="true"
        className="number-analysis-modal"
        role="dialog"
      >
        <header className="number-analysis-header">
          <div>
            <p className="modal-eyebrow">Next number count</p>
            <h2 id="number-analysis-title">Guess Number Analysis</h2>
          </div>
          <button
            aria-label="Close analysis"
            className="modal-close"
            onClick={onClose}
            type="button"
          >
            &times;
          </button>
        </header>

        {gameName && (
          <div className="last-week-game-name">
            <span>Game</span>
            <strong>{gameName}</strong>
            <span className="last-week-number-type-label">Number type</span>
            <strong>{analysis.numberType}</strong>
          </div>
        )}

        <div className="number-analysis-controls">
          <div>
            <strong>Best-ranked guesses</strong>
            <span>
              Combined by occurrence count across the selected patterns.
            </span>
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
                      <span key={pattern.label}>
                        {pattern.label}: {pattern.count}
                      </span>
                    ))}
                </div>
              </div>
            </article>
          ))}
          {rankedNumbers.length === 0 && (
            <div className="analysis-empty-state">
              No next-number data is available for analysis.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function getLastWeekRowResult(row) {
  const passNumber = String(row.passNumber ?? "").trim();
  if (!passNumber) return null;

  return row.numbers.some(
    (number) => String(number ?? "").trim() === passNumber,
  )
    ? "passed"
    : "failed";
}

function LastWeekAnalysisModal({
  dayCount,
  error,
  gameName,
  numberType,
  onClose,
  onDayCountChange,
  onTopCountChange,
  rows,
  status,
  topCount,
}) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const evaluatedResults = rows
    .map(getLastWeekRowResult)
    .filter(Boolean);
  const passedCount = evaluatedResults.filter((result) => result === "passed").length;
  const failedCount = evaluatedResults.length - passedCount;
  const passRate = evaluatedResults.length > 0
    ? Math.round((passedCount / evaluatedResults.length) * 1000) / 10
    : null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <section
        aria-labelledby="last-week-analysis-title"
        aria-modal="true"
        className="number-analysis-modal last-week-analysis-modal"
        role="dialog"
      >
        <header className="number-analysis-header">
          <div>
            <p className="modal-eyebrow">Next number count</p>
            <h2 id="last-week-analysis-title">Analysis Last week</h2>
          </div>
          <div className="last-week-header-actions">
            {passRate != null && (
              <div
                aria-label={`${passRate}% pass rate: ${passedCount} passed and ${failedCount} failed`}
                className="last-week-pass-rate"
                role="status"
                title={`${passedCount} Passed · ${failedCount} Failed`}
              >
                <span>Pass rate</span>
                <strong>{passRate}%</strong>
              </div>
            )}
            <label className="last-week-day-count" htmlFor="last-week-day-count">
              Show last day result
              <select
                disabled={status === "loading"}
                id="last-week-day-count"
                onChange={(event) => onDayCountChange(Number(event.target.value))}
                value={dayCount}
              >
                {Array.from({ length: 30 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? "Day" : "Days"}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="last-week-top-count">
              Top numbers
              <select
                disabled={status === "loading"}
                id="last-week-top-count"
                onChange={(event) => onTopCountChange(Number(event.target.value))}
                value={topCount}
              >
                {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>Top {count}</option>
                ))}
              </select>
            </label>
            <button
              aria-label="Close last week analysis"
              className="modal-close"
              onClick={onClose}
              type="button"
            >
              &times;
            </button>
          </div>
        </header>

        {gameName && (
          <div className="last-week-game-name">
            <span>Game</span>
            <strong>{gameName}</strong>
            <span className="last-week-number-type-label">Number type</span>
            <strong>{numberType}</strong>
          </div>
        )}

        <div className="last-week-analysis-body">
          {status === "loading" && (
            <div className="last-week-loading" role="status">
              <span className="spinner" aria-hidden="true" />
              Calculating the last {dayCount} {dayCount === 1 ? "day" : "days"}…
            </div>
          )}
          {status === "error" && (
            <div className="analysis-empty-state" role="alert">{error}</div>
          )}
          {status === "success" && (
            <table className="last-week-analysis-table">
              <thead>
                <tr>
                  <th>Sr No</th>
                  <th>Day guess</th>
                  <th>Guess Number</th>
                  <th>Pass Number</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const passNumber = String(row.passNumber ?? "").trim();
                  const hasPassNumber = passNumber !== "";
                  const isPassed = getLastWeekRowResult(row) === "passed";

                  return (
                    <tr key={`${row.dayGuess}-${index}`}>
                      <td><span className="serial-number">{index + 1}</span></td>
                      <td>{row.dayGuess}</td>
                      <td><strong>{row.numbers.join(", ") || "—"}</strong></td>
                      <td className="pass-number"><strong>{passNumber || "—"}</strong></td>
                      <td
                        className={`analysis-result${hasPassNumber ? ` ${isPassed ? "passed" : "failed"}` : ""}`}
                      >
                        {hasPassNumber && <strong>{isPassed ? "Passed" : "Failed"}</strong>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function PatternWiseAnalysisModal({ dayCount, error, gameName, numberType, onClose, onDayCountChange, onTopCountChange, rows, sourceUrl, status, topCount }) {
  const [chartType, setChartType] = useState("bar");
  const [winningRow, setWinningRow] = useState(null);
  const [stakeAmount, setStakeAmount] = useState(100);
  useEffect(() => {
    const closeOnEscape = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const patternLabel = (pattern) => pattern === "Weekly" ? "Weekly Row Pattern" : `${pattern} Pattern`;
  const getPassedCount = (row, limit) => row.results.filter((result) => result.matchRank && result.matchRank <= limit).length;
  const getRate = (row, limit) => row.evaluatedCount ? (getPassedCount(row, limit) / row.evaluatedCount) * 100 : 0;
  const rankedRows = [...rows].sort((a, b) => getRate(b, topCount) - getRate(a, topCount) || patternLabel(a.pattern).localeCompare(patternLabel(b.pattern)));
  const chartWidth = 820;
  const chartHeight = 250;
  const padding = { top: 18, right: 20, bottom: 38, left: 42 };
  const pointFor = (row, limit) => ({ x: padding.left + ((limit - 1) / 9) * (chartWidth - padding.left - padding.right), y: padding.top + (1 - getRate(row, limit) / 100) * (chartHeight - padding.top - padding.bottom) });
  const lineColors = ["#246493", "#20704f", "#8a5a20", "#70469a", "#ad4d3c", "#2b7983", "#596c3f", "#6c587c"];
  const winningPassedCount = winningRow ? getPassedCount(winningRow, topCount) : 0;
  const winningLossCount = winningRow ? winningRow.evaluatedCount - winningPassedCount : 0;
  const investmentPerDay = Number(stakeAmount || 0) * topCount;
  const totalInvestment = winningRow ? winningRow.evaluatedCount * investmentPerDay : 0;
  const winPayout = Number(stakeAmount || 0) * 9.5;
  const totalWinAmount = winningPassedCount * winPayout;
  const totalLossAmount = winningLossCount * investmentPerDay;
  const netAmount = totalWinAmount - totalInvestment;
  const renderPatternChart = (row, rate) => {
    const width = 360;
    const height = 180;
    const chartPadding = { top: 24, right: 12, bottom: 34, left: 28 };
    const plotWidth = width - chartPadding.left - chartPadding.right;
    const plotHeight = height - chartPadding.top - chartPadding.bottom;
    // API results are already ordered with the latest evaluated day first.
    const chartResults = row.results;
    const step = plotWidth / Math.max(chartResults.length, 1);
    const points = chartResults.map((result, index) => ({
      x: chartPadding.left + step * index + step / 2,
      y: chartPadding.top + ((result.matchRank && result.matchRank <= topCount) ? 0 : plotHeight),
      passed: result.matchRank && result.matchRank <= topCount,
      label: result.dayGuess.slice(0, 3),
    }));
    return <aside className="pattern-result-chart">
      <div className="pattern-result-chart-heading"><span>Top {topCount} daily result</span><strong>{rate.toFixed(1)}%</strong></div>
      <svg aria-label={`${patternLabel(row.pattern)} pass chart for Top ${topCount}`} role="img" viewBox={`0 0 ${width} ${height}`}>
        <line className="pattern-chart-gridline" x1={chartPadding.left} x2={width - chartPadding.right} y1={chartPadding.top} y2={chartPadding.top} />
        <line className="pattern-chart-gridline" x1={chartPadding.left} x2={width - chartPadding.right} y1={chartPadding.top + plotHeight} y2={chartPadding.top + plotHeight} />
        <text className="pattern-chart-axis-label" x="3" y={chartPadding.top + 4}>Pass</text><text className="pattern-chart-axis-label" x="5" y={chartPadding.top + plotHeight}>Miss</text>
        {chartType === "line" && points.length > 1 && <path d={`M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`} fill="none" stroke="#246493" strokeWidth="3" />}
        {points.map((point, index) => <g key={`${point.label}-${index}`}>{chartType === "bar" ? <rect fill={point.passed ? "#267157" : "#c55a4a"} height={point.passed ? plotHeight : 5} rx="3" width={Math.max(8, step - 8)} x={point.x - Math.max(8, step - 8) / 2} y={point.passed ? chartPadding.top : chartPadding.top + plotHeight - 5} /> : <circle cx={point.x} cy={point.y} fill={point.passed ? "#267157" : "#c55a4a"} r="5" stroke="#fff" strokeWidth="2" />}<text className="pattern-chart-axis-label" textAnchor="middle" x={point.x} y={height - 12}>{point.label}</text></g>)}
      </svg>
      <small><b>{getPassedCount(row, topCount)}</b> passed of {row.evaluatedCount} days · Green = pass · Red = miss</small>
    </aside>;
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
      <section aria-labelledby="pattern-wise-analysis-title" aria-modal="true" className="number-analysis-modal pattern-wise-analysis-modal" role="dialog">
        <header className="number-analysis-header">
          <div>
            <p className="modal-eyebrow">Pattern performance</p>
            <h2 id="pattern-wise-analysis-title">Analysis Pattern wise</h2>
          </div>
          <div className="last-week-header-actions">
            <label className="last-week-day-count" htmlFor="pattern-wise-day-count">
              Analyze days
              <select disabled={status === "loading"} id="pattern-wise-day-count" onChange={(event) => onDayCountChange(Number(event.target.value))} value={dayCount}>
                {Array.from({ length: 30 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>Last {count} Days</option>)}
              </select>
            </label>
            <label className="last-week-day-count" htmlFor="pattern-wise-top-count">
              Top guesses
              <select disabled={status === "loading"} id="pattern-wise-top-count" onChange={(event) => onTopCountChange(Number(event.target.value))} value={topCount}>
                {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>Top {count}</option>)}
              </select>
            </label>
            <label className="last-week-day-count" htmlFor="pattern-wise-chart-type">
              Graph type
              <select id="pattern-wise-chart-type" onChange={(event) => setChartType(event.target.value)} value={chartType}>
                <option value="bar">Bar chart</option>
                <option value="line">Line chart</option>
              </select>
            </label>
            <button aria-label="Close pattern analysis" className="modal-close" onClick={onClose} type="button">&times;</button>
          </div>
        </header>
        {gameName && <div className="last-week-game-name"><span>Game</span><strong>{gameName}</strong><span className="last-week-number-type-label">Number type</span><strong>{numberType}</strong>{sourceUrl && <a className="pattern-wise-open-url" href={sourceUrl} rel="noopener noreferrer" target="_blank">Open URL</a>}</div>}
        <div className="pattern-wise-intro">The chart compares pass percentages from Top 1 through Top 10 guesses. Select a Top value to update the detailed results below.</div>
        <div className="last-week-analysis-body">
          {status === "loading" && <div className="last-week-loading" role="status"><span className="spinner" aria-hidden="true" />Comparing pattern results…</div>}
          {status === "error" && <div className="analysis-empty-state" role="alert">{error}</div>}
          {status === "success" && <section aria-label="Pass percentage by top guesses" className="pattern-rate-chart">
            <div className="pattern-rate-chart-heading"><div><span>Pass percentage trend</span><strong>Top 1 to Top 10 comparison</strong></div><small>Selected: Top {topCount}</small></div>
            <div className="pattern-rate-chart-scroll"><svg aria-label="Line chart showing each pattern's pass percentage for Top 1 through Top 10 guesses" className="pattern-rate-chart-svg" role="img" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              {[0, 25, 50, 75, 100].map((value) => { const y = padding.top + (1 - value / 100) * (chartHeight - padding.top - padding.bottom); return <g key={value}><line className="pattern-chart-gridline" x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} /><text className="pattern-chart-axis-label" textAnchor="end" x={padding.left - 8} y={y + 4}>{value}%</text></g>; })}
              {Array.from({ length: 10 }, (_, index) => index + 1).map((limit) => { const x = pointFor(rankedRows[0] || { evaluatedCount: 0, results: [] }, limit).x; return <g key={limit}><text className="pattern-chart-axis-label" textAnchor="middle" x={x} y={chartHeight - 14}>Top {limit}</text>{limit === topCount && <line className="pattern-chart-selected-line" x1={x} x2={x} y1={padding.top} y2={chartHeight - padding.bottom} />}</g>; })}
              {rankedRows.map((row, index) => { const color = lineColors[index % lineColors.length]; const points = Array.from({ length: 10 }, (_, pointIndex) => pointFor(row, pointIndex + 1)); return <g key={row.pattern}><path d={`M ${points.map((point) => `${point.x} ${point.y}`).join(" L ")}`} fill="none" stroke={color} strokeWidth="3" />{points.map((point, pointIndex) => <circle className={pointIndex + 1 === topCount ? "pattern-chart-point selected" : "pattern-chart-point"} cx={point.x} cy={point.y} fill={color} key={pointIndex} r={pointIndex + 1 === topCount ? 5 : 3} />)}</g>; })}
            </svg></div>
            <div className="pattern-rate-chart-legend">{rankedRows.map((row, index) => <span key={row.pattern}><i style={{ backgroundColor: lineColors[index % lineColors.length] }} />{patternLabel(row.pattern)}: {getRate(row, topCount).toFixed(1)}%</span>)}</div>
          </section>}
          {status === "success" && rankedRows.map((row, index) => {
            const passedCount = getPassedCount(row, topCount);
            const rate = getRate(row, topCount);
            const selectedResults = row.results.map((result) => ({
              ...result,
              numbers: result.numbers.slice(0, topCount),
              matchRank: result.matchRank && result.matchRank <= topCount ? result.matchRank : null,
            }));
            return <article className={`pattern-performance-card${index === 0 ? " best" : ""}`} key={row.pattern}>
              <header><span className="guess-rank">#{index + 1}</span><strong>{patternLabel(row.pattern)}</strong>{index === 0 && <span className="best-pattern-badge">Best pattern</span>}<button className="winning-amount-button" onClick={() => setWinningRow(row)} type="button">Winning amount</button><span className="pattern-pass-rate">{rate.toFixed(1)}% pass rate</span></header>
              <p><strong>{passedCount}</strong> pass number matches from {row.evaluatedCount} evaluated days.</p>
              <div className={`today-pattern-guess${index === 0 ? " best" : ""}`}>
                <span>Next day after last pass · {row.todayGuessDay || "Next day"}</span>
                <strong>{row.todayNumbers?.slice(0, topCount).join(", ") || "No guess available"}</strong>
              </div>
              <div className="pattern-performance-details">
                <div className="pattern-day-results">
                {selectedResults.map((result, resultIndex) => <div className={result.matchRank && result.matchRank <= topCount ? "pattern-day-match" : "pattern-day-miss"} key={`${result.dayGuess}-${resultIndex}`}>
                  <strong>{result.dayGuess}</strong><span>Guess: {result.numbers.join(", ") || "—"}</span><span>Pass: {result.passNumber}</span><em>{result.matchRank ? `Passed · guess #${result.matchRank}` : "No match"}</em>
                </div>)}
                </div>
                {renderPatternChart(row, rate)}
              </div>
            </article>;
          })}
        </div>
        {winningRow && <div className="winning-amount-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setWinningRow(null)} role="presentation">
          <section aria-labelledby="winning-amount-title" aria-modal="true" className="winning-amount-modal" role="dialog">
            <header><div><span>Profit calculator</span><h3 id="winning-amount-title">{patternLabel(winningRow.pattern)} · Top {topCount}</h3></div><button aria-label="Close winning amount calculator" onClick={() => setWinningRow(null)} type="button">&times;</button></header>
            <p>Based on <b>{winningRow.evaluatedCount}</b> evaluated days: <b>{winningPassedCount}</b> passed and <b>{winningLossCount}</b> failed. Each day uses {topCount} guesses.</p>
            <div className="winning-amount-inputs"><label>Amount per guessed number (₹)<input min="0" onChange={(event) => setStakeAmount(Number(event.target.value))} type="number" value={stakeAmount} /></label><label>Payout when one number passes (₹)<input readOnly type="number" value={winPayout} /></label></div>
            <div className="winning-amount-summary"><div><span>Total investment</span><strong>₹{totalInvestment.toLocaleString("en-IN")}</strong><small>{winningRow.evaluatedCount} days × ₹{investmentPerDay.toLocaleString("en-IN")}</small></div><div><span>Winning amount</span><strong>₹{totalWinAmount.toLocaleString("en-IN")}</strong><small>{winningPassedCount} × ₹{Number(winPayout || 0).toLocaleString("en-IN")}</small></div><div><span>Lost amount</span><strong>₹{totalLossAmount.toLocaleString("en-IN")}</strong><small>{winningLossCount} × ₹{investmentPerDay.toLocaleString("en-IN")}</small></div><div className={netAmount >= 0 ? "profit" : "loss"}><span>Net profit / loss</span><strong>{netAmount >= 0 ? "+" : "-"}₹{Math.abs(netAmount).toLocaleString("en-IN")}</strong><small>Winning amount minus total investment</small></div></div>
            <footer>Top {topCount}: ₹{Number(stakeAmount || 0).toLocaleString("en-IN")} × {topCount} = ₹{investmentPerDay.toLocaleString("en-IN")} invested per day. Payout is automatic: ₹{Number(stakeAmount || 0).toLocaleString("en-IN")} × 9.5 = ₹{winPayout.toLocaleString("en-IN")}. Only failed days count as a loss.</footer>
          </section>
        </div>}
      </section>
    </div>
  );
}

function getLatestGuessNumbers(analysis, count, skipLastNumbers = 0) {
  const numberCount = Number(count);
  if (!analysis || !numberCount) {
    return "";
  }

  const latestNumbers = (analysis.latestNumbers ?? [])
    .map((value) => String(value ?? "").trim())
    .filter((value) => value && value !== "*");
  if (latestNumbers.length > 0) {
    const skipCount = Number(skipLastNumbers) || 0;
    const calculationNumbers =
      skipCount > 0 ? latestNumbers.slice(0, -skipCount) : latestNumbers;
    return calculationNumbers.slice(-numberCount).join(",");
  }

  const activeDays = getActivePanelDays(analysis);
  const values = [...(analysis.currentDataWeeks ?? [])]
    .reverse()
    .flatMap((week) => activeDays.map((day) => week.days?.[day]?.number))
    .map((value) => String(value ?? "").trim())
    .filter((value) => value && value !== "*");

  return values.slice(-numberCount).join(",");
}

function getActivePanelDays(analysis) {
  if (!analysis) {
    return [];
  }

  const availableDays = analysis.availableDays ?? [];
  const panelRows = analysis.panelRows ?? [];
  const activeDays = availableDays.filter((day) =>
    panelRows.some((row) => {
      const panelDay = row.days?.[day];
      return (
        panelDay &&
        [panelDay.open, panelDay.close, panelDay.pair].some(
          (value) => String(value ?? "").trim() !== "",
        )
      );
    }),
  );

  return activeDays.length > 0 ? activeDays : availableDays;
}

function getPredictedNumbers(data, patternLabel) {
  const structuredNumbers = Array.isArray(data?.predictedNumbers)
    ? data.predictedNumbers.map((number) => String(number ?? "").trim())
    : [];
  if (
    structuredNumbers.length === 3 &&
    structuredNumbers.every((number) => /^[0-9]$/.test(number)) &&
    new Set(structuredNumbers).size === 3
  ) {
    return structuredNumbers;
  }

  const structuredNumber = String(data?.predictedNumber ?? "").trim();
  if (/^[0-9]$/.test(structuredNumber)) {
    return [structuredNumber];
  }

  const markerMatch = String(data?.prediction ?? "").match(
    /FINAL_PREDICTED_NUMBER\s*:\s*(?:\*\*)?([0-9])(?:\*\*)?/i,
  );
  if (markerMatch) {
    return [markerMatch[1]];
  }

  throw new Error(
    `${patternLabel} did not return a valid next predicted number.`,
  );
}

async function requestPatternPrediction(
  apiBaseUrl,
  option,
  analysis,
  configuredSeriesDays,
) {
  const seriesDayLimit = option.seriesDays
    ?? getSeriesDayLimit(configuredSeriesDays);
  const requestSeries = getCurrentDataSeries(
    analysis,
    option.requestSeriesDays ?? seriesDayLimit,
  );
  const displayedSeries = seriesDayLimit == null
    ? requestSeries
    : requestSeries.slice(-seriesDayLimit);
  if (requestSeries.length === 0) {
    throw new Error(
      `${option.label} requires at least one valid Current Data value.`,
    );
  }

  const seriesData = requestSeries.join(",");
  const response = await fetch(`${apiBaseUrl}${option.endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      predictionMode: option.predictionMode ?? "Standard",
      seriesData,
      period: Math.max(1, analysis.availableDays?.length ?? 7),
    }),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      getProblemMessage(
        data,
        `${option.label} request failed with status ${response.status}.`,
      ),
    );
  }

  return {
    backtestAttempts: data.backtestAttempts,
    backtestHits: data.backtestHits,
    backtestHitRate: data.backtestHitRate,
    dataPointCount: displayedSeries.length,
    label: option.label,
    model: data.model,
    pattern: option.value,
    predictedNumbers: getPredictedNumbers(data, option.label),
    prediction: data.prediction,
    prompt: data.prompt,
    numberPrompts: data.numberPrompts,
    seriesData: displayedSeries.join(","),
    seriesDayLimit,
  };
}

function addPredictionResultsToAnalysis(
  analysis,
  responses,
  selectedPanelOptions,
) {
  if (responses.length === 0) {
    return analysis;
  }

  const panelGroups =
    analysis.patternGroups ??
    selectedPanelOptions.map((option) => ({
      label: option.label,
      matchLines: analysis.matchLines,
      nextNumberCounts: analysis.nextNumberCounts,
      pattern: option.value,
    }));
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
  }));

  return {
    ...analysis,
    nextNumberCounts: [
      ...analysis.nextNumberCounts,
      ...predictionGroups.flatMap((group) => group.nextNumberCounts),
    ],
    patternGroups: [...panelGroups, ...predictionGroups],
  };
}

function createPredictionOnlyAnalysis(baseAnalysis, selectedPredictionOptions) {
  return {
    ...baseAnalysis,
    guessNumbers: "",
    matchLines: [],
    matchingRowIds: [],
    nextNumberCounts: [],
    pattern:
      selectedPredictionOptions.length === 1
        ? selectedPredictionOptions[0].value
        : "Multiple",
    patternGroups: [],
    patternLabel:
      selectedPredictionOptions.length === 1
        ? selectedPredictionOptions[0].label
        : `${selectedPredictionOptions.length} AI Patterns`,
    threeTouch: null,
  };
}

function combinePatternAnalyses(patternAnalyses) {
  const firstAnalysis = patternAnalyses[0]?.analysis;
  if (!firstAnalysis) {
    return null;
  }

  const patternGroups = patternAnalyses.map(({ analysis, label, pattern }) => ({
    label,
    matchLines: analysis.matchLines,
    nextNumberCounts: analysis.nextNumberCounts,
    pattern,
  }));
  const threeTouch =
    patternAnalyses.find(({ analysis }) => analysis.threeTouch)?.analysis
      .threeTouch ?? null;

  return {
    ...firstAnalysis,
    pattern:
      patternAnalyses.length === panelPatternOptions.length
        ? "All"
        : "Multiple",
    patternLabel:
      patternAnalyses.length === panelPatternOptions.length
        ? "All Pattern"
        : `${patternAnalyses.length} Patterns`,
    matchLines: patternGroups.flatMap((group) => group.matchLines),
    matchingRowIds: [
      ...new Set(
        patternAnalyses.flatMap(({ analysis }) => analysis.matchingRowIds),
      ),
    ],
    nextNumberCounts: patternGroups.flatMap((group) => group.nextNumberCounts),
    patternGroups,
    threeTouch,
  };
}

export default function App() {
  const [activePage, setActivePage] = useState(getPageFromPath);
  const apiEnvironmentKey = import.meta.env.PROD
    ? "production"
    : "development";
  const [games, setGames] = useState([]);
  const [selectedPatterns, setSelectedPatterns] = useState(["Sequence"]);
  const [selectedGame, setSelectedGame] = useState("");
  const [gamesStatus, setGamesStatus] = useState("loading");
  const [numberType, setNumberType] = useState("Open");
  const [numbers, setNumbers] = useState("");
  const [latestCount, setLatestCount] = useState("3");
  const [aigSeriesDays, setAigSeriesDays] = useState("30");
  const [skipLastNumbers, setSkipLastNumbers] = useState("1");
  const [analysis, setAnalysis] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [isNumberAnalysisOpen, setIsNumberAnalysisOpen] = useState(false);
  const [isLastWeekAnalysisOpen, setIsLastWeekAnalysisOpen] = useState(false);
  const [isPatternWiseAnalysisOpen, setIsPatternWiseAnalysisOpen] = useState(false);
  const [patternWiseAnalysisRows, setPatternWiseAnalysisRows] = useState([]);
  const [patternWiseAnalysisStatus, setPatternWiseAnalysisStatus] = useState("idle");
  const [patternWiseAnalysisError, setPatternWiseAnalysisError] = useState("");
  const [patternWiseDayCount, setPatternWiseDayCount] = useState(7);
  const [patternWiseTopCount, setPatternWiseTopCount] = useState(3);
  const [lastWeekAnalysisRows, setLastWeekAnalysisRows] = useState([]);
  const [lastWeekAnalysisStatus, setLastWeekAnalysisStatus] = useState("idle");
  const [lastWeekAnalysisError, setLastWeekAnalysisError] = useState("");
  const [lastWeekTopCount, setLastWeekTopCount] = useState(10);
  const [lastWeekDayCount, setLastWeekDayCount] = useState(7);
  const [generatorUrl, setGeneratorUrl] = useState("");
  const [generatorFileName, setGeneratorFileName] = useState("");
  const [generatorSources, setGeneratorSources] = useState([]);
  const [generatorStatus, setGeneratorStatus] = useState("idle");
  const [generatorError, setGeneratorError] = useState("");
  const [generatorResult, setGeneratorResult] = useState(null);
  const [patternResponses, setPatternResponses] = useState([]);
  const [isPatternResponsesOpen, setIsPatternResponsesOpen] = useState(false);
  // In development, keep requests on the Vite origin so its /api proxy handles
  // the backend connection without browser CORS or local HTTPS certificate issues.
  const apiBaseUrl = import.meta.env.DEV
    ? ""
    : getApiEnvironment(apiEnvironmentKey).baseUrl;
  const activeApiBaseUrlRef = useRef(apiBaseUrl);
  const apiRequestGenerationRef = useRef(0);
  const generatorOptionsRequestRef = useRef(0);

  const isApiRequestCurrent = (requestGeneration, requestBaseUrl) =>
    apiRequestGenerationRef.current === requestGeneration &&
    activeApiBaseUrlRef.current === requestBaseUrl;

  useEffect(() => {
    const controller = new AbortController();
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;

    const loadGames = async () => {
      try {
        setGames([]);
        setSelectedGame("");
        setGamesStatus("loading");
        setError("");
        const data = await fetchGames(requestBaseUrl, controller.signal);
        if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
        setGames(data);
        setSelectedGame(data[0]?.fileName ?? "");
        setGamesStatus(data.length > 0 ? "success" : "empty");
      } catch (requestError) {
        if (
          (requestError instanceof DOMException &&
            requestError.name === "AbortError") ||
          !isApiRequestCurrent(requestGeneration, requestBaseUrl)
        ) {
          return;
        }

        setGamesStatus("error");
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load game files.",
        );
      }
    };

    loadGames();
    return () => controller.abort();
  }, [apiBaseUrl]);

  useEffect(() => {
    const handlePopState = () => setActivePage(getPageFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigateToPage = (page) => {
    const path = page === "excel-files" ? dataSheetPath : "/";
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setActivePage(page);
    window.scrollTo({ top: 0 });
  };

  // Environment selection removed for local development; this is a no-op.
  const changeApiEnvironment = () => {};

  const selectedGameDetails = games.find(
    (game) => game.fileName === selectedGame,
  );
  const selectedGameName = selectedGameDetails?.displayName;
  const selectedSourceUrl = selectedGameDetails?.sourceUrl;
  const analysisDays = getActivePanelDays(analysis);
  const analysisPatternLabel =
    analysis?.patternLabel ??
    patternOptions.find((option) => option.value === analysis?.pattern)
      ?.label ??
    "Sequence Pattern";

  const openGenerator = async () => {
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

    const optionsRequest = ++generatorOptionsRequestRef.current;
    setGeneratorError("");
    setGeneratorResult(null);
    setGeneratorStatus("loading-options");
    setIsGeneratorOpen(true);

    try {
      const response = await fetch(
        `${requestBaseUrl}/api/chart-export/options`,
      );
      const data = await response.json().catch(() => null);
      if (
        optionsRequest !== generatorOptionsRequestRef.current ||
        !isApiRequestCurrent(requestGeneration, requestBaseUrl)
      )
        return;

      if (!response.ok) {
        throw new Error(
          getProblemMessage(
            data,
            `Options request failed with status ${response.status}.`,
          ),
        );
      }

      const sources = Array.isArray(data?.sources) ? data.sources : [];
      const selectedSource =
        sources.find((source) => source.fileName === generatorFileName) ??
        sources[0];

      setGeneratorSources(sources);
      setGeneratorFileName(selectedSource?.fileName ?? "");
      setGeneratorUrl(selectedSource?.url ?? "");
      setGeneratorStatus("idle");
    } catch (requestError) {
      if (
        optionsRequest !== generatorOptionsRequestRef.current ||
        !isApiRequestCurrent(requestGeneration, requestBaseUrl)
      )
        return;

      setGeneratorStatus("error");
      setGeneratorError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to load generator defaults.",
      );
    }
  };

  const changeGeneratorSource = (fileName) => {
    const source = generatorSources.find((item) => item.fileName === fileName);
    setGeneratorFileName(fileName);
    setGeneratorUrl(source?.url ?? "");
    setGeneratorError("");
    setGeneratorResult(null);
  };

  const closeGenerator = () => {
    if (generatorStatus !== "loading") {
      generatorOptionsRequestRef.current += 1;
      setIsGeneratorOpen(false);
      if (generatorStatus === "loading-options") setGeneratorStatus("idle");
    }
  };

  const generateExcel = async (event) => {
    event.preventDefault();
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

    setGeneratorStatus("loading");
    setGeneratorError("");
    setGeneratorResult(null);

    try {
      const response = await fetch(
        `${requestBaseUrl}/api/chart-export/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: generatorUrl,
            fileName: generatorFileName,
          }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

      if (!response.ok) {
        throw new Error(
          getProblemMessage(
            data,
            `Generation request failed with status ${response.status}.`,
          ),
        );
      }

      setGeneratorResult(data);
      setGeneratorStatus("success");
      setGeneratorSources((currentSources) =>
        currentSources.map((source) =>
          source.fileName === generatorFileName
            ? { ...source, url: generatorUrl }
            : source,
        ),
      );
      setNumbers("");
      setAnalysis(null);
      setStatus("idle");
      setError("");

      try {
        const refreshedGames = await fetchGames(requestBaseUrl);
        if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
        setGames(refreshedGames);
        setGamesStatus(refreshedGames.length > 0 ? "success" : "empty");
        setSelectedGame(
          refreshedGames.some((game) => game.fileName === data.fileName)
            ? data.fileName
            : (refreshedGames[0]?.fileName ?? ""),
        );
      } catch (refreshError) {
        if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
        setError(
          refreshError instanceof Error
            ? `Excel was generated, but the game list could not refresh: ${refreshError.message}`
            : "Excel was generated, but the game list could not refresh.",
        );
      }
    } catch (requestError) {
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setGeneratorStatus("error");
      setGeneratorError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to generate the Excel file.",
      );
    }
  };

  const chartFileGenerated = async (result) => {
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

    setNumbers("");
    setAnalysis(null);
    setStatus("idle");
    setError("");

    try {
      const refreshedGames = await fetchGames(requestBaseUrl);
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setGames(refreshedGames);
      setGamesStatus(refreshedGames.length > 0 ? "success" : "empty");
      setSelectedGame(
        refreshedGames.some((game) => game.fileName === result.fileName)
          ? result.fileName
          : (refreshedGames[0]?.fileName ?? ""),
      );
    } catch (refreshError) {
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setError(
        refreshError instanceof Error
          ? `Excel was generated, but the game list could not refresh: ${refreshError.message}`
          : "Excel was generated, but the game list could not refresh.",
      );
    }
  };

  const chartFileRemoved = async (removedFileName) => {
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

    setNumbers("");
    setAnalysis(null);
    setStatus("idle");

    try {
      const refreshedGames = await fetchGames(requestBaseUrl);
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setGames(refreshedGames);
      setGamesStatus(refreshedGames.length > 0 ? "success" : "empty");
      setSelectedGame((currentGame) =>
        currentGame !== removedFileName &&
        refreshedGames.some((game) => game.fileName === currentGame)
          ? currentGame
          : (refreshedGames[0]?.fileName ?? ""),
      );
    } catch (refreshError) {
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh the game list.",
      );
    }
  };

  const changeGame = (event) => {
    setSelectedGame(event.target.value);
    setNumberType("Open");
    setNumbers("");
    setAnalysis(null);
    setStatus("idle");
    setError("");
  };

  const changePatterns = (nextPatterns) => {
    if (
      nextPatterns.length === selectedPatterns.length &&
      nextPatterns.every((patternValue) =>
        selectedPatterns.includes(patternValue),
      )
    ) {
      return;
    }

    if (numbers.trim()) {
      const shouldClear = window.confirm(
        "Guess Numbers must be blank before changing Pattern. Clear Guess Numbers and continue?",
      );

      if (!shouldClear) {
        return;
      }
    }

    setNumbers("");
    setAnalysis(null);
    setStatus("idle");
    setError("");
    setSelectedPatterns(nextPatterns);
  };

  const changeNumberType = (event) => {
    const nextNumberType = event.target.value;
    if (nextNumberType === numberType) {
      return;
    }

    if (numbers.trim()) {
      const shouldClear = window.confirm(
        "Guess Numbers must be blank before changing Number Type. Clear Guess Numbers and continue?",
      );

      if (!shouldClear) {
        return;
      }
    }

    setNumbers("");
    setAnalysis(null);
    setStatus("idle");
    setError("");
    setNumberType(nextNumberType);
  };

  const changeLatestCount = (event) => {
    const nextCount = event.target.value;
    setLatestCount(nextCount);

    if (!nextCount) {
      setNumbers("");
      return;
    }

    if (analysis) {
      setNumbers(getLatestGuessNumbers(analysis, nextCount, skipLastNumbers));
    }
  };

  const changeSkipLastNumbers = (event) => {
    const nextSkipCount = event.target.value;
    if (analysis && latestCount) {
      setNumbers(getLatestGuessNumbers(analysis, latestCount, nextSkipCount));
    }

    setSkipLastNumbers(nextSkipCount);
    setAnalysis(null);
    setStatus("idle");
    setError("");
  };

  const changeAigSeriesDays = (event) => {
    setAigSeriesDays(event.target.value);
    setAnalysis(null);
    setPatternResponses([]);
    setIsPatternResponsesOpen(false);
    setStatus("idle");
    setError("");
  };

  const runAnalysis = async (event) => {
    event.preventDefault();
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

    setIsNumberAnalysisOpen(false);
    setIsPatternResponsesOpen(false);
    setPatternResponses([]);

    if (selectedPatterns.length === 0) {
      setError("Select at least one pattern before searching.");
      return;
    }

    if (!selectedGame) {
      setError(
        "No Excel game file is available. Upload an .xlsx or .xlsm blob to the Azure files container.",
      );
      return;
    }

    setStatus("loading");
    setError("");

    try {
      const requestAnalysis = async (guessNumbers, requestedPattern) => {
        const response = await fetch(`${requestBaseUrl}/api/panel/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pattern: requestedPattern,
            fileName: selectedGame,
            numberType,
            numbers: guessNumbers,
            skipLastNumbers: Number(skipLastNumbers || 0),
          }),
        });

        if (!response.ok) {
          const problem = await response.json().catch(() => null);
          throw new Error(
            getProblemMessage(
              problem,
              `Analysis request failed with status ${response.status}.`,
            ),
          );
        }

        return response.json();
      };

      const selectedPanelPatternOptions = panelPatternOptions.filter((option) =>
        selectedPatterns.includes(option.value),
      );
      const selectedPredictionPatternOptions = predictionPatternOptions.filter(
        (option) => selectedPatterns.includes(option.value),
      );
      const requestSelectedPatterns = async (guessNumbers, seed = null) => {
        const patternAnalyses = await Promise.all(
          selectedPanelPatternOptions.map(async (option) => ({
            analysis:
              seed?.pattern === option.value
                ? seed.analysis
                : await requestAnalysis(guessNumbers, option.value),
            label: option.label,
            pattern: option.value,
          })),
        );

        return combinePatternAnalyses(patternAnalyses);
      };

      let data;

      if (selectedPanelPatternOptions.length === 0) {
        const seedAnalysis = await requestAnalysis("", "Sequence");
        data = createPredictionOnlyAnalysis(
          seedAnalysis,
          selectedPredictionPatternOptions,
        );
      } else if (!numbers.trim() && latestCount) {
        const seedPattern = selectedPanelPatternOptions[0].value;
        const seedAnalysis = await requestAnalysis("", seedPattern);
        const latestNumbers = getLatestGuessNumbers(
          seedAnalysis,
          latestCount,
          skipLastNumbers,
        );
        const seedMatchesSelection =
          latestNumbers === seedAnalysis.guessNumbers;

        if (selectedPanelPatternOptions.length > 1) {
          data = await requestSelectedPatterns(
            latestNumbers,
            seedMatchesSelection
              ? { analysis: seedAnalysis, pattern: seedPattern }
              : null,
          );
        } else {
          data = seedMatchesSelection
            ? seedAnalysis
            : await requestAnalysis(latestNumbers, seedPattern);
        }
      } else {
        data =
          selectedPanelPatternOptions.length > 1
            ? await requestSelectedPatterns(numbers)
            : await requestAnalysis(
                numbers,
                selectedPanelPatternOptions[0].value,
              );
      }

      if (!data) {
        throw new Error("No pattern analysis was returned.");
      }

      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

      const responses = await Promise.all(
        selectedPredictionPatternOptions.map((option) =>
          requestPatternPrediction(requestBaseUrl, option, data, aigSeriesDays),
        ),
      );
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

      const analysisWithPredictions = addPredictionResultsToAnalysis(
        data,
        responses,
        selectedPanelPatternOptions,
      );

      setAnalysis(analysisWithPredictions);
      setPatternResponses(responses);
      setNumbers(latestCount ? data.guessNumbers : "");
      setStatus("success");
    } catch (requestError) {
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setAnalysis(null);
      setPatternResponses([]);
      setStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to analyze panel data.",
      );
    }
  };

  const runLastWeekAnalysis = async (
    topCount = lastWeekTopCount,
    dayCount = lastWeekDayCount,
  ) => {
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    const requestedPatterns = panelPatternOptions
      .filter((option) => selectedPatterns.includes(option.value))
      .map((option) => option.value);

    setIsLastWeekAnalysisOpen(true);
    setLastWeekAnalysisRows([]);
    setLastWeekAnalysisStatus("loading");
    setLastWeekAnalysisError("");

    if (requestedPatterns.length === 0) {
      setLastWeekAnalysisStatus("error");
      setLastWeekAnalysisError("Select at least one non-AIG pattern to analyze the last week.");
      return;
    }

    try {
      const response = await fetch(`${requestBaseUrl}/api/panel/analyze-last-week`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedGame,
          latestCount: Number(latestCount || 3),
          numberType,
          patterns: requestedPatterns,
          skipLastNumbers: Number(skipLastNumbers || 0),
          topCount,
          dayCount,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getProblemMessage(data, `Last week analysis failed with status ${response.status}.`),
        );
      }
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;

      setLastWeekAnalysisRows(data);
      setLastWeekAnalysisStatus("success");
    } catch (requestError) {
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setLastWeekAnalysisStatus("error");
      setLastWeekAnalysisError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to analyze the last week.",
      );
    }
  };

  const runPatternWiseAnalysis = async (
    dayCount = patternWiseDayCount,
    topCount = patternWiseTopCount,
  ) => {
    const requestGeneration = apiRequestGenerationRef.current;
    const requestBaseUrl = apiBaseUrl;
    const requestedPatterns = panelPatternOptions.map((option) => option.value);
    setIsPatternWiseAnalysisOpen(true);
    setPatternWiseAnalysisRows([]);
    setPatternWiseAnalysisStatus("loading");
    setPatternWiseAnalysisError("");
    try {
      const response = await fetch(`${requestBaseUrl}/api/panel/analyze-pattern-wise`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // Always collect the top ten ranks once. The modal derives every Top 1–10
        // percentage from these ranks, making the Top selector immediate.
        body: JSON.stringify({ fileName: selectedGame, latestCount: Number(latestCount || 3), numberType, patterns: requestedPatterns, skipLastNumbers: Number(skipLastNumbers || 0), topCount: 10, dayCount }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getProblemMessage(data, `Pattern-wise analysis failed with status ${response.status}.`));
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setPatternWiseAnalysisRows(data);
      setPatternWiseAnalysisStatus("success");
    } catch (requestError) {
      if (!isApiRequestCurrent(requestGeneration, requestBaseUrl)) return;
      setPatternWiseAnalysisStatus("error");
      setPatternWiseAnalysisError(requestError instanceof Error ? requestError.message : "Unable to compare pattern results.");
    }
  };

  if (activePage === "excel-files") {
    return (
      <ChartFilesPage
        apiBaseUrl={apiBaseUrl}
        apiEnvironmentKey={apiEnvironmentKey}
        key={apiEnvironmentKey}
        onApiEnvironmentChange={changeApiEnvironment}
        onBack={() => navigateToPage("explorer")}
        onGenerated={chartFileGenerated}
        onRemoved={chartFileRemoved}
      />
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        actions={
          <>
            <button
              className="generate-link"
              onClick={() => navigateToPage("excel-files")}
              type="button"
            >
              Excel Files
            </button>
            {analysis && (
              <div className="summary-chip">
                <strong>{analysis.matchLines.length}</strong>
                <span>matches found</span>
              </div>
            )}
          </>
        }
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

      {!analysis && status !== "loading" && (
        <section className="empty-state">
          <div aria-hidden="true">⌕</div>
          <h2>Ready to search the panel history</h2>
          <p>
            Leave Guess Numbers blank to use the latest three digits, or enter
            your own sequence.
          </p>
        </section>
      )}

      {status === "loading" && (
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
              isLastWeekLoading={lastWeekAnalysisStatus === "loading"}
              isPatternWiseLoading={patternWiseAnalysisStatus === "loading"}
              onOpenAnalysis={() => setIsNumberAnalysisOpen(true)}
              onOpenLastWeekAnalysis={() => runLastWeekAnalysis()}
              onOpenPatternWiseAnalysis={() => runPatternWiseAnalysis()}
              onOpenPatternResponses={() => setIsPatternResponsesOpen(true)}
              patternLabel={analysisPatternLabel}
              patternResponseCount={patternResponses.length}
            />
            <MatchLinesSection
              analysis={analysis}
              patternLabel={analysisPatternLabel}
            />
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
        <NumberAnalysisModal
          analysis={analysis}
          gameName={selectedGameName}
          onClose={() => setIsNumberAnalysisOpen(false)}
        />
      )}

      {isLastWeekAnalysisOpen && (
        <LastWeekAnalysisModal
          dayCount={lastWeekDayCount}
          error={lastWeekAnalysisError}
          gameName={selectedGameName}
          numberType={numberType}
          onClose={() => setIsLastWeekAnalysisOpen(false)}
          onDayCountChange={(dayCount) => {
            setLastWeekDayCount(dayCount);
            runLastWeekAnalysis(lastWeekTopCount, dayCount);
          }}
          onTopCountChange={(topCount) => {
            setLastWeekTopCount(topCount);
            runLastWeekAnalysis(topCount, lastWeekDayCount);
          }}
          rows={lastWeekAnalysisRows}
          status={lastWeekAnalysisStatus}
          topCount={lastWeekTopCount}
        />
      )}

      {isPatternWiseAnalysisOpen && (
        <PatternWiseAnalysisModal
          dayCount={patternWiseDayCount}
          error={patternWiseAnalysisError}
          gameName={selectedGameName}
          numberType={numberType}
          onClose={() => setIsPatternWiseAnalysisOpen(false)}
          onDayCountChange={(dayCount) => { setPatternWiseDayCount(dayCount); runPatternWiseAnalysis(dayCount, patternWiseTopCount); }}
          onTopCountChange={setPatternWiseTopCount}
          rows={patternWiseAnalysisRows}
          sourceUrl={selectedSourceUrl}
          status={patternWiseAnalysisStatus}
          topCount={patternWiseTopCount}
        />
      )}

      {isPatternResponsesOpen && patternResponses.length > 0 && (
        <PatternResponseModal
          onClose={() => setIsPatternResponsesOpen(false)}
          responses={patternResponses}
        />
      )}
    </main>
  );
}
