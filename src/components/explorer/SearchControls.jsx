import { useEffect, useId, useRef, useState } from "react";
import { allPatternOptions, individualPatternOptions } from "./patternOptions";

function InfoTooltip({ children, label }) {
  const tooltipId = useId();

  return (
    <span className="control-info">
      <button
        aria-describedby={tooltipId}
        aria-label={`${label} information`}
        className="control-info-button"
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="16"
          viewBox="0 0 20 20"
          width="16"
        >
          <circle
            cx="10"
            cy="10"
            r="8.25"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M10 8.5v5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
          />
          <circle cx="10" cy="5.8" fill="currentColor" r="1" />
        </svg>
      </button>
      <span className="control-info-tooltip" id={tooltipId} role="tooltip">
        {children}
      </span>
    </span>
  );
}

function ControlLabel({ children, htmlFor, label }) {
  return (
    <div className="control-label-row">
      <label htmlFor={htmlFor}>{label}</label>
      <InfoTooltip label={label}>{children}</InfoTooltip>
    </div>
  );
}

function PatternSelector({ onChange, value }) {
  const [isOpen, setIsOpen] = useState(false);
  const selectorRef = useRef(null);
  const allSelected =
    value.length === allPatternOptions.length &&
    allPatternOptions.every((option) => value.includes(option.value));
  const selectedLabel = allSelected
    ? "All Pattern"
    : value.length === 1
      ? individualPatternOptions.find((option) => option.value === value[0])
          ?.label
      : value.length > 1
        ? `${value.length} Patterns`
        : "Select Pattern";

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!selectorRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const toggleAll = () => {
    onChange(
      allSelected ? [] : allPatternOptions.map((option) => option.value),
    );
  };

  const togglePattern = (patternValue) => {
    onChange(
      value.includes(patternValue)
        ? value.filter((selectedValue) => selectedValue !== patternValue)
        : [...value, patternValue],
    );
  };

  return (
    <div className="pattern-selector" ref={selectorRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="pattern-select-trigger"
        id="pattern"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span>{selectedLabel}</span>
        <span aria-hidden="true" className="pattern-select-arrow">
          ▾
        </span>
      </button>
      {isOpen && (
        <div
          aria-label="Select patterns"
          className="pattern-options"
          role="group"
        >
          <label className="pattern-option all-pattern-option">
            <input
              checked={allSelected}
              onChange={toggleAll}
              ref={(input) => {
                if (input)
                  input.indeterminate = value.length > 0 && !allSelected;
              }}
              type="checkbox"
            />
            <span>All Pattern</span>
          </label>
          {individualPatternOptions.map((option) => (
            <label className="pattern-option" key={option.value}>
              <input
                checked={value.includes(option.value)}
                onChange={() => togglePattern(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchControls({
  aigSeriesDays,
  games,
  gamesStatus,
  latestCount,
  numberType,
  numbers,
  onAigSeriesDaysChange,
  onGameChange,
  onLatestCountChange,
  onNumberTypeChange,
  onNumbersChange,
  onPatternChange,
  onSkipLastNumbersChange,
  onSubmit,
  selectedGame,
  selectedGameName,
  selectedPatterns,
  selectedSourceUrl,
  skipLastNumbers,
  status,
}) {
  const isSubmitDisabled =
    status === "loading" ||
    gamesStatus === "loading" ||
    !selectedGame ||
    selectedPatterns.length === 0;
  const isAigSelected = selectedPatterns.some((pattern) =>
    pattern === "AIG" || pattern === "AIGDeep"
  );

  return (
    <form className="search-bar" onSubmit={onSubmit}>
      <section
        aria-label="Game and pattern settings"
        className="search-section search-source-section"
      >
        <div className="search-field pattern-field">
          <label htmlFor="pattern">Pattern</label>
          <PatternSelector
            onChange={onPatternChange}
            value={selectedPatterns}
          />
        </div>
        <div className="search-field game-field">
          <label htmlFor="game-file">Select Game</label>
          <div className="game-picker-row">
            <select
              disabled={gamesStatus === "loading" || games.length === 0}
              id="game-file"
              onChange={onGameChange}
              value={selectedGame}
            >
              {gamesStatus === "loading" && (
                <option value="">Loading games...</option>
              )}
              {gamesStatus !== "loading" && games.length === 0 && (
                <option value="">No games available</option>
              )}
              {games.map((game) => (
                <option key={game.fileName} value={game.fileName}>
                  {game.displayName}
                </option>
              ))}
            </select>
            {selectedSourceUrl && (
              <a
                aria-label={`Open source site for ${selectedGameName}`}
                className="source-site-link"
                href={selectedSourceUrl}
                rel="noopener noreferrer"
                target="_blank"
                title="Open source site"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="18"
                >
                  <path d="M14 3h7v7" />
                  <path d="M10 14 21 3" />
                  <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                </svg>
              </a>
            )}
          </div>
        </div>
        <div className="search-field mode-field">
          <label htmlFor="number-type">Number type</label>
          <select
            id="number-type"
            onChange={onNumberTypeChange}
            value={numberType}
          >
            <option value="Open">Open</option>
            <option value="Close">Close</option>
          </select>
        </div>
      </section>

      <section
        aria-label="Skipped values setting"
        className="search-section search-skip-section"
      >
        <div className="search-field skip-field">
          <ControlLabel htmlFor="skip-last-numbers" label="Skip Last Number">
            Choose how many recent numbers to ignore. Select 0 to use all
            numbers. Select 1-4 to ignore that many latest numbers. This
            affects all results, including AIG.
          </ControlLabel>
          <select
            id="skip-last-numbers"
            onChange={onSkipLastNumbersChange}
            value={skipLastNumbers}
          >
            {[0, 1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        aria-label="AIG series setting"
        className="search-section search-aig-section"
      >
        <div className="search-field aig-days-field">
          <ControlLabel htmlFor="aig-series-days" label="AIG Series Days">
            Choose how many recent numbers to send to AIG. Enter 30 to send the
            latest 30 numbers, or 40 to send the latest 40. Leave it blank to
            send all numbers. Blank cells and * are not sent. This box works
            only when AIG Pattern or AIG Deep Pattern is selected.
          </ControlLabel>
          <input
            disabled={!isAigSelected}
            id="aig-series-days"
            inputMode="numeric"
            min="1"
            onChange={onAigSeriesDaysChange}
            placeholder={isAigSelected ? "All" : "Select AIG"}
            step="1"
            title="Number of latest Current Data days sent to AIG. Leave blank to send all available data."
            type="number"
            value={aigSeriesDays}
          />
        </div>
      </section>

      <section
        aria-label="Latest number settings"
        className="search-section search-latest-section"
      >
        <div className="search-field latest-field">
          <ControlLabel htmlFor="latest-count" label="Latest">
            Choose how many recent numbers to use when looking for old matching
            patterns. For example, Last 3 uses the latest three numbers. Choose
            Blank to clear it. If this and Latest Last Number are blank, the
            latest three numbers are used. This does not change AIG Series
            Days.
          </ControlLabel>
          <select
            id="latest-count"
            onChange={onLatestCountChange}
            value={latestCount}
          >
            <option value="4">Last 4</option>
            <option value="3">Last 3</option>
            <option value="2">Last 2</option>
            <option value="1">Last 1</option>
            <option value="">Blank</option>
          </select>
        </div>
        <div className="search-field guess-field">
          <ControlLabel htmlFor="guess-numbers" label="Latest Last Number">
            These numbers are used to find old matching patterns and possible
            next numbers. The Latest option can fill this box, or you can enter
            numbers separated by commas. AIG uses Current Data and does not use
            this box.
          </ControlLabel>
          <input
            id="guess-numbers"
            inputMode="numeric"
            onChange={(event) => onNumbersChange(event.target.value)}
            placeholder="Leave blank to use latest digits"
            value={numbers}
          />
        </div>
      </section>

      <section
        aria-label="Run analysis"
        className="search-section search-action-section"
      >
        <span className="search-action-label">Pattern analysis</span>
        <button
          className="search-submit"
          disabled={isSubmitDisabled}
          type="submit"
        >
          {status === "loading" ? "Analyzing…" : "Run Analysis"}
        </button>
      </section>
    </form>
  );
}
