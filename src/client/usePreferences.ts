import { useSyncExternalStore } from 'react'
import type { PreferenceStore } from './preferences'

export function usePreferences(store: PreferenceStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
