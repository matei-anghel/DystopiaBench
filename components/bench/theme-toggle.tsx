"use client"

import { useEffect, useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import {
  applyPreference,
  getIsDark,
  getServerIsDark,
  getThemePreference,
  setThemePreference,
  subscribeToTheme,
} from "./theme"

/**
 * Light/dark switch. Until the visitor clicks it the site follows the system setting; a click
 * stores the opposite of what is on screen, and that choice sticks.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const isDark = useSyncExternalStore(subscribeToTheme, getIsDark, getServerIsDark)
  // Sync the browser theme-color with a stored choice that differs from the OS scheme.
  useEffect(() => applyPreference(getThemePreference()), [])
  const Icon = isDark ? Moon : Sun
  const label = isDark ? "Switch to light theme" : "Switch to dark theme"

  return (
    <button
      type="button"
      onClick={() => setThemePreference(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/50 hover:text-foreground ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}
