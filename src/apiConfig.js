export const API_ENVIRONMENT_STORAGE_KEY = 'ppg-guess-api-environment'

const normalizeBaseUrl = (value) => String(value ?? '').trim().replace(/\/+$/, '')
const normalizeEnvironmentKey = (value) => String(value ?? '').trim().toLowerCase()

const developmentBaseUrl = normalizeBaseUrl(
  import.meta.env.VITE_DEVELOPMENT_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL,
)
const productionBaseUrl = normalizeBaseUrl(import.meta.env.VITE_PRODUCTION_API_BASE_URL)
  || 'https://ppgguessapi-a2gbfjgva2gnancn.centralindia-01.azurewebsites.net'
const configuredDefaultEnvironmentKey = normalizeEnvironmentKey(
  import.meta.env.VITE_DEFAULT_API_ENVIRONMENT,
)

export const DEFAULT_API_ENVIRONMENT_KEY = ['development', 'production'].includes(
  configuredDefaultEnvironmentKey,
)
  ? configuredDefaultEnvironmentKey
  : import.meta.env.PROD ? 'production' : 'development'

const getHostLabel = (baseUrl, fallback) => {
  if (!baseUrl) return fallback

  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

export const API_ENVIRONMENTS = Object.freeze([
  Object.freeze({
    key: 'development',
    label: 'Development',
    baseUrl: developmentBaseUrl,
    hostLabel: getHostLabel(developmentBaseUrl, 'localhost:5288 via Vite proxy'),
  }),
  Object.freeze({
    key: 'production',
    label: 'Production',
    baseUrl: productionBaseUrl,
    hostLabel: getHostLabel(productionBaseUrl, productionBaseUrl),
  }),
])

export const API_ENVIRONMENTS_BY_KEY = Object.freeze(Object.fromEntries(
  API_ENVIRONMENTS.map((environment) => [environment.key, environment]),
))

export function isApiEnvironmentKey(value) {
  return Object.prototype.hasOwnProperty.call(
    API_ENVIRONMENTS_BY_KEY,
    normalizeEnvironmentKey(value),
  )
}

export function getApiEnvironment(value) {
  return API_ENVIRONMENTS_BY_KEY[normalizeEnvironmentKey(value)]
    ?? API_ENVIRONMENTS_BY_KEY[DEFAULT_API_ENVIRONMENT_KEY]
}

export function loadApiEnvironmentKey() {
  try {
    const storedValue = normalizeEnvironmentKey(
      window.localStorage.getItem(API_ENVIRONMENT_STORAGE_KEY),
    )
    return isApiEnvironmentKey(storedValue) ? storedValue : DEFAULT_API_ENVIRONMENT_KEY
  } catch {
    return DEFAULT_API_ENVIRONMENT_KEY
  }
}

export function saveApiEnvironmentKey(value) {
  const environmentKey = getApiEnvironment(value).key

  try {
    window.localStorage.setItem(API_ENVIRONMENT_STORAGE_KEY, environmentKey)
  } catch {
    // The selection still works for this session when storage is unavailable.
  }

  return environmentKey
}
