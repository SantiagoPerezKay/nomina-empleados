import { useSyncExternalStore, useCallback } from 'react'

type ColorScheme = 'light' | 'dark'

const KEY = 'nomina-color-scheme'

function getSnapshot(): ColorScheme {
  return (localStorage.getItem(KEY) as ColorScheme) || 'light'
}

function getServerSnapshot(): ColorScheme {
  return 'light'
}

const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function setColorScheme(cs: ColorScheme) {
  localStorage.setItem(KEY, cs)
  listeners.forEach((cb) => cb())
}

export function useColorSchemeStore<T>(selector: (s: { colorScheme: ColorScheme; toggle: () => void }) => T): T {
  const colorScheme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const toggle = useCallback(() => {
    setColorScheme(colorScheme === 'light' ? 'dark' : 'light')
  }, [colorScheme])
  return selector({ colorScheme, toggle })
}
