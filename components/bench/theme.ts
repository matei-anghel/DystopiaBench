export type ThemePreference = "system" | "light" | "dark"

const STORAGE_KEY = "dystopiabench-theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"
const CHANGE_EVENT = "dystopiabench-theme-change"

/**
 * Runs inline in <head> before first paint so the page never flashes the wrong theme. With no
 * stored choice it follows the visitor's system setting. Kept dependency-free (it is a string).
 */
export const THEME_INIT_SCRIPT = `(function(){var d;try{var p=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches)}catch(e){d=matchMedia(${JSON.stringify(DARK_QUERY)}).matches}document.documentElement.classList.toggle("dark",d)})()`

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return "system"
  }
}

function applyPreference(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle("dark", dark)
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage can be unavailable (private mode); the choice then lasts for this page view.
  }
  applyPreference(preference)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

/** useSyncExternalStore subscription: our own changes, other tabs, and system theme flips. */
export function subscribeToTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY)
  const onSystemChange = () => {
    if (readPreference() === "system") applyPreference("system")
    onChange()
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    applyPreference(readPreference())
    onChange()
  }
  media.addEventListener("change", onSystemChange)
  window.addEventListener("storage", onStorage)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    media.removeEventListener("change", onSystemChange)
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export const getThemePreference = readPreference
export const getServerThemePreference = (): ThemePreference => "system"
