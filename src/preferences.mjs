export const DEFAULT_PREFERENCES = Object.freeze({
  captureEnabled: true,
  captureAfter: 'stay',
  defaultColor: 'yellow',
  showGrid: true,
  snapToGrid: true,
  wheelBehavior: 'pan',
  openingView: 'restore',
  provider: '',
  model: '',
  distillLength: 'standard',
  distillLanguage: 'zh',
  distillInstructions: '',
  historyLimit: 50,
})

export const PREFERENCE_CHOICES = Object.freeze({
  captureAfter: ['stay', 'open'],
  defaultColor: ['yellow', 'pink', 'blue', 'green', 'orange', 'purple', 'gray'],
  wheelBehavior: ['pan', 'zoom'],
  openingView: ['restore', 'fit'],
  distillLength: ['short', 'standard', 'detailed'],
  distillLanguage: ['source', 'zh', 'en'],
  historyLimit: [50, 100, 200],
})

export function resolvePreferences(raw = {}) {
  const value = { ...DEFAULT_PREFERENCES }
  for (const [key, fallback] of Object.entries(DEFAULT_PREFERENCES)) {
    const candidate = raw?.[key]
    if (typeof candidate === typeof fallback && (!PREFERENCE_CHOICES[key] || PREFERENCE_CHOICES[key].includes(candidate))) value[key] = candidate
  }
  return value
}

export const DISTILL_LENGTHS = Object.freeze({
  short: { words: 100, tokens: 800 },
  standard: { words: 200, tokens: 1200 },
  detailed: { words: 400, tokens: 2000 },
})
