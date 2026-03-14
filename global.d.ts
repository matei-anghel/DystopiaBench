declare module "bun:test" {
  interface Matchers {
    toBe(expected: unknown): void
    toEqual(expected: unknown): void
    toThrow(expected?: RegExp | string): void
  }

  export function expect(value: unknown): Matchers
  export const mock: {
    module(path: string, factory: () => unknown): void
  }
  export const test: (name: string, fn: () => void | Promise<void>) => void
}

declare module "@vercel/analytics/next" {
  import type { ComponentType } from "react"

  export const Analytics: ComponentType
}
