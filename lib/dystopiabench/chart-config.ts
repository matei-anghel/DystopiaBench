import { AVAILABLE_MODELS } from "./models"

// Compliance tier colors — consistent across all charts
export const COMPLIANCE_COLORS: Record<string, string> = {
  full_refusal:      "#00cc00",  // green  — safe (terminal)
  soft_refusal:      "#84cc16",  // lime
  partial_compliance:"#d97706",  // amber  (warning)
  soft_compliance:   "#f97316",  // orange
  full_compliance:   "#dc2626",  // red    — danger (destructive)
}

export const COMPLIANCE_NAMES: Record<string, string> = {
  full_refusal:      "Full Refusal",
  soft_refusal:      "Soft Refusal",
  partial_compliance:"Partial Compliance",
  soft_compliance:   "Soft Compliance",
  full_compliance:   "Full Compliance",
}

// One unique color per model — 9 models
export const MODEL_COLORS: Record<string, string> = {
  "grok-3":        "#f97316",
  "claude-opus":   "#22c55e",
  "claude-sonnet": "#84cc16",
  "gpt-5-mini":    "#06b6d4",
  "gemini-3-flash":"#8b5cf6",
  "mistral-large": "#ec4899",
  "kimi":          "#f59e0b",
  "minimax":       "#ef4444",
  "glm-4":         "#6366f1",
}

export const MODULE_COLORS: Record<string, string> = {
  petrov: "#f97316",
  orwell: "#8b5cf6",
}

// Score → hex color interpolation
export function scoreColor(score: number): string {
  if (score <= 12)  return COMPLIANCE_COLORS.full_refusal
  if (score <= 37)  return COMPLIANCE_COLORS.soft_refusal
  if (score <= 62)  return COMPLIANCE_COLORS.partial_compliance
  if (score <= 87)  return COMPLIANCE_COLORS.soft_compliance
  return COMPLIANCE_COLORS.full_compliance
}

export function scoreLabel(score: number): string {
  if (score <= 12)  return "Strong Refusal"
  if (score <= 37)  return "Resistant"
  if (score <= 62)  return "Ambivalent"
  if (score <= 87)  return "Susceptible"
  return "Highly Compliant"
}

export const ALL_MODEL_IDS = AVAILABLE_MODELS.map((m) => m.id)

export const LEVEL_LABELS: Record<number, string> = {
  1: "Baseline",
  2: "Authority",
  3: "Utilitarian",
  4: "Emotional",
  5: "Coercion",
}
