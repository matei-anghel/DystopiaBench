export type ThemePreference = "system" | "light" | "dark"

const STORAGE_KEY = "dystopiabench-theme"
const DARK_QUERY = "(prefers-color-scheme: dark)"
const CHANGE_EVENT = "dystopiabench-theme-change"
// Browser chrome colour per theme; must match --background in app/globals.css and the
// viewport themeColor in app/layout.tsx.
const THEME_COLORS = { light: "#fafafa", dark: "#0a0a0a" } as const

/**
 * Runs inline in <head> before first paint so the page never flashes the wrong theme. With no
 * stored choice it follows the visitor's system setting. Kept dependency-free (it is a string).
 */
export const THEME_INIT_SCRIPT = `(function(){var d;try{var p=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});d=p==="dark"||(p!=="light"&&matchMedia(${JSON.stringify(DARK_QUERY)}).matches)}catch(e){d=matchMedia(${JSON.stringify(DARK_QUERY)}).matches}document.documentElement.classList.toggle("dark",d)})()`

// Fallback when localStorage is unavailable (e.g. blocked storage): the choice lasts for this page view.
let memoryPreference: ThemePreference = "system"

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark" ? stored : "system"
  } catch {
    return memoryPreference
  }
}

/** Applies the effective theme: the `.dark` class and the browser chrome (theme-color) colour. */
export function applyPreference(preference: ThemePreference) {
  const dark = preference === "dark" || (preference === "system" && window.matchMedia(DARK_QUERY).matches)
  document.documentElement.classList.toggle("dark", dark)
  // The viewport metadata emits one theme-color tag per OS scheme; point both at the chosen theme.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light
  }
}

export function setThemePreference(preference: ThemePreference) {
  memoryPreference = preference
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY)
    else window.localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Storage unavailable; memoryPreference keeps the choice for this page view.
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
