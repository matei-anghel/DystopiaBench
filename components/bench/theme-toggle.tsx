"use client"

import { useEffect, useSyncExternalStore } from "react"
import { Monitor, Moon, Sun } from "lucide-react"
import {
  applyPreference,
  getServerThemePreference,
  getThemePreference,
  setThemePreference,
  subscribeToTheme,
  type ThemePreference,
} from "./theme"

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
}

const LABELS: Record<ThemePreference, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference, getServerThemePreference)
  // Sync the browser theme-color with a stored choice that differs from the OS scheme.
  useEffect(() => applyPreference(getThemePreference()), [])
  const Icon = preference === "light" ? Sun : preference === "dark" ? Moon : Monitor
  const next = NEXT_PREFERENCE[preference]

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`${LABELS[preference]} (switch to ${LABELS[next].toLowerCase()})`}
      title={`${LABELS[preference]}: click for ${LABELS[next].toLowerCase()}`}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:bg-muted/50 hover:text-foreground ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}
