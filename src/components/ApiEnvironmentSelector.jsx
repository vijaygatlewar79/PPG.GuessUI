import { useId } from 'react'
import { API_ENVIRONMENTS, getApiEnvironment } from '../apiConfig'

export default function ApiEnvironmentSelector({ disabled = false, onChange, value }) {
  const selectId = useId()
  const hostId = `${selectId}-host`
  const selectedEnvironment = getApiEnvironment(value)
  const endpointTitle = selectedEnvironment.baseUrl
    || 'Requests use the Vite development proxy to localhost:5288.'

  return (
    <div className="api-environment-selector">
      <label htmlFor={selectId}>API environment</label>
      <select
        aria-describedby={hostId}
        disabled={disabled}
        id={selectId}
        onChange={(event) => onChange(event.target.value)}
        value={selectedEnvironment.key}
      >
        {API_ENVIRONMENTS.map((environment) => (
          <option key={environment.key} value={environment.key}>
            {environment.label}
          </option>
        ))}
      </select>
      <span
        aria-live="polite"
        className="api-environment-host"
        id={hostId}
        title={endpointTitle}
      >
        {selectedEnvironment.hostLabel}
      </span>
    </div>
  )
}
