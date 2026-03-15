import { performance } from "perf_hooks";

interface OpenRouterModelEntry {
  id: string
  name?: string
  context_length?: number
  pricing?: Record<string, unknown>
  supported_parameters?: string[]
}

const N = 100; // number of modelIds
const M = 10000; // number of models in body.data

const modelIds = Array.from({ length: N }, (_, i) => `model-${i}`);
const bodyData: OpenRouterModelEntry[] = Array.from({ length: M }, (_, i) => ({
  id: `model-${i}`,
  context_length: 1000,
  supported_parameters: []
}));

function original() {
  const catalog = new Set(bodyData.map((m) => m.id))
  const snapshot: Record<string, unknown> = {}
  const missing: string[] = []

  for (const id of modelIds) {
    if (catalog.has(id)) {
      const entry = bodyData.find((m) => m.id === id)
      snapshot[id] = {
        context_length: entry?.context_length,
        supported_parameters: entry?.supported_parameters,
      }
    } else {
      missing.push(id)
    }
  }
}

function optimized() {
  const catalog = new Map<string, OpenRouterModelEntry>();
  for (const m of bodyData) {
    catalog.set(m.id, m);
  }

  const snapshot: Record<string, unknown> = {}
  const missing: string[] = []

  for (const id of modelIds) {
    const entry = catalog.get(id);
    if (entry !== undefined) {
      snapshot[id] = {
        context_length: entry.context_length,
        supported_parameters: entry.supported_parameters,
      }
    } else {
      missing.push(id)
    }
  }
}

// Warmup
for (let i = 0; i < 10; i++) {
  original();
  optimized();
}

const t0 = performance.now();
for (let i = 0; i < 100; i++) original();
const t1 = performance.now();
const origTime = t1 - t0;

const t2 = performance.now();
for (let i = 0; i < 100; i++) optimized();
const t3 = performance.now();
const optTime = t3 - t2;

console.log(`Original: ${origTime.toFixed(2)} ms`);
console.log(`Optimized: ${optTime.toFixed(2)} ms`);
console.log(`Improvement: ${(origTime / optTime).toFixed(2)}x`);
