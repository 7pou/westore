import type WeStore from './index'
import {StateRecord, WritableState} from './types'
import {
  cloneView, equalView, isPlainObject, setOwn
} from './snapshot'

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface WxStorageApi {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: string): void
  removeStorageSync(key: string): void
}

export function createWxStorageAdapter(api: WxStorageApi): StorageAdapter {
  if (!api || ['getStorageSync', 'setStorageSync', 'removeStorageSync'].some(method => typeof api[method] !== 'function')) {
    throw new TypeError('An explicit synchronous wx storage API is required')
  }
  return {
    getItem(key) {
      const value = api.getStorageSync(key)
      if (value === '') return null
      if (typeof value !== 'string') throw new TypeError('wx storage value must be a string')
      return value
    },
    setItem(key, value) { api.setStorageSync(key, value) },
    removeItem(key) { api.removeStorageSync(key) }
  }
}

export interface PersistenceController {
  hydrate(): boolean
  clear(): void
  stop(): void
}

export interface PersistenceOptions<State> {
  key: string
  pick: Array<Extract<keyof WritableState<State>, string>>
  storage: StorageAdapter
  version?: number
  autoHydrate?: boolean
  migrate?: (state: StateRecord, fromVersion: number) => Partial<WritableState<State>>
  onError?: (error: unknown) => void
}

function validVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function writableData(data: unknown, pick: string[]): StateRecord {
  if (!isPlainObject(data)) throw new TypeError('Persistence requires plain object state')
  pick.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(data, key) && typeof data[key] === 'function') {
      throw new TypeError('Cannot persist getter: ' + key)
    }
  })
  return data
}

function selectFields(data: StateRecord, pick: string[]): StateRecord {
  const selected: StateRecord = {}
  pick.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(data, key)) setOwn(selected, key, data[key])
  })
  return cloneView(selected)
}

export function persistStore<State>(
  store: WeStore<State>, options: PersistenceOptions<State>
): PersistenceController {
  const {
    key, storage, onError, migrate
  } = options
  const version = options.version === undefined ? 1 : options.version
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new TypeError('Persistence key must be a non-empty string')
  }
  if (!validVersion(version)) throw new TypeError('Persistence version must be a positive safe integer')
  if (!Array.isArray(options.pick) || Array.from(options.pick).some(field => typeof field !== 'string')) {
    throw new TypeError('Persistence pick must be an array of field names')
  }
  if (!storage || ['getItem', 'setItem', 'removeItem'].some(method => typeof storage[method] !== 'function')) {
    throw new TypeError('Persistence storage must provide synchronous getItem/setItem/removeItem')
  }
  if (onError !== undefined && typeof onError !== 'function') {
    throw new TypeError('Persistence onError must be a function')
  }
  if (migrate !== undefined && typeof migrate !== 'function') {
    throw new TypeError('Persistence migrate must be a synchronous function')
  }
  if (options.autoHydrate !== undefined && typeof options.autoHydrate !== 'boolean') {
    throw new TypeError('Persistence autoHydrate must be a boolean')
  }
  const pick = Array.from(new Set(options.pick))
  let latest = selectFields(writableData(store.data, pick), pick)
  let persisted: StateRecord | undefined
  let restoredNotification: StateRecord | undefined
  let operationRevision = 0
  let baselineRevision = 0
  let stopped = false
  let hydrating = 0

  function report(error: unknown): boolean {
    try {
      if (onError) onError(error)
      return true
    } catch (reportError) {
      return false
    }
  }

  function commitBaseline(revision: number, value: StateRecord | undefined): boolean {
    if (revision < baselineRevision) return false
    baselineRevision = revision
    persisted = value
    return true
  }

  function hydrate(): boolean {
    try {
      const serialized = storage.getItem(key)
      if (serialized === null) return false
      if (typeof serialized !== 'string') throw new TypeError('Stored value must be a string or null')
      const envelope: unknown = JSON.parse(serialized)
      if (!isPlainObject(envelope) || !Object.prototype.hasOwnProperty.call(envelope, 'version') ||
        !validVersion(envelope.version) || !Object.prototype.hasOwnProperty.call(envelope, 'state') ||
        !isPlainObject(envelope.state)) {
        throw new TypeError('Invalid persistence envelope')
      }
      let state = cloneView(envelope.state)
      if (envelope.version !== version) {
        if (!migrate) throw new Error('Persistence version mismatch without migration')
        const migrated = migrate(state, envelope.version)
        if (!isPlainObject(migrated)) throw new TypeError('Persistence migration must return plain object state')
        state = cloneView(migrated)
      }
      const restored = selectFields(state, pick)
      const expected = selectFields(writableData(store.data, pick), pick)
      Object.keys(restored).forEach(field => setOwn(expected, field, restored[field]))
      const revision = ++operationRevision
      hydrating++
      try {
        store.patch(restored as Partial<WritableState<State>>)
        if (commitBaseline(revision, expected)) restoredNotification = expected
      } finally {
        hydrating--
      }
      return true
    } catch (error) {
      report(error)
      return false
    }
  }

  function save(value: StateRecord): void {
    if (stopped || hydrating > 0 || !equalView(value, latest)) return
    const restored = equalView(value, restoredNotification)
    restoredNotification = undefined
    if (restored || equalView(value, persisted)) return
    const revision = ++operationRevision
    try {
      storage.setItem(key, JSON.stringify({version, state: value}))
      commitBaseline(revision, cloneView(value))
    } catch (error) {
      report(error)
    }
  }

  if (options.autoHydrate !== false) hydrate()
  const unsubscribe = store.watch(data => {
    try {
      writableData(store.data, pick)
      latest = selectFields(data as StateRecord, pick)
    } catch (error) {
      report(error)
    }
    return latest
  }, save)

  return {
    hydrate,
    clear() {
      const revision = ++operationRevision
      try {
        storage.removeItem(key)
        commitBaseline(revision, undefined)
      } catch (error) {
        report(error)
      }
    },
    stop() {
      if (stopped) return
      stopped = true
      unsubscribe()
    }
  }
}
