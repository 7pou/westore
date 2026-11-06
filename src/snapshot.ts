import {StateRecord, ResolvedData} from './types'

export function isPlainObject(value: unknown): value is StateRecord {
  if (value === null || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function setOwn(target: object, key: string, value: any): void {
  Object.defineProperty(target, key, {
    value, enumerable: true, writable: true, configurable: true
  })
}

function validateKeys(value: object): void {
  const symbols = Object.getOwnPropertySymbols(value)
  if (symbols.some(key => Object.prototype.propertyIsEnumerable.call(value, key))) {
    throw new TypeError('Enumerable symbol keys are not supported')
  }
}

function cloneValue(value: any, parents: Set<object>, rootGetters: boolean): any {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const array = Array.isArray(value)
  if (!array && !isPlainObject(value)) throw new TypeError('Unsupported state value')
  if (parents.has(value)) throw new TypeError('Cyclic state is not supported')
  const keys = Object.keys(value)
  if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) {
    throw new TypeError('State arrays must be dense and contain only indexed values')
  }
  validateKeys(value)
  parents.add(value)
  const copied = array ? [] : {}
  keys.forEach(key => {
    const child = value[key]
    const next = rootGetters && !array && typeof child === 'function' ? child : cloneValue(child, parents, false)
    setOwn(copied, key, next)
  })
  parents.delete(value)
  return copied
}

export function cloneState<State>(data: State): State {
  return cloneValue(data, new Set(), true)
}

export function cloneView<Value>(value: Value): Value {
  return cloneValue(value, new Set(), false)
}

export function createViewSnapshot<State>(store: {data: State}): ResolvedData<State> {
  if (!isPlainObject(store.data)) return cloneView(store.data) as ResolvedData<State>
  validateKeys(store.data as StateRecord)
  const parsed: StateRecord = {}
  Object.keys(store.data).forEach(key => {
    const value = store.data[key]
    setOwn(parsed, key, typeof value === 'function' ? value.call(store, store.data) : value)
  })
  return cloneView(parsed) as ResolvedData<State>
}

export function equalView(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (typeof left !== 'object' || typeof right !== 'object') return false
  if (left === null || right === null) return false
  if (Array.isArray(left) !== Array.isArray(right)) return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every(key => (
    Object.prototype.hasOwnProperty.call(right, key) && equalView(left[key], right[key])
  ))
}

function safeKey(key: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key)
}

export function diffView(previous: unknown, next: unknown, namespace: string): StateRecord {
  const changes: StateRecord = {}
  function compare(before: any, after: any, path: string): void {
    if (equalView(before, after)) return
    const arrays = Array.isArray(before) && Array.isArray(after)
    const objects = isPlainObject(before) && isPlainObject(after)
    const replaceArray = arrays && (path === namespace || before.length !== after.length)
    if ((!arrays && !objects) || replaceArray) {
      setOwn(changes, path, cloneView(after))
      return
    }
    const keys = Object.keys(after)
    const removed = Object.keys(before).some(key => (
      !Object.prototype.hasOwnProperty.call(after, key)
    ))
    const unsafe = keys.some(key => !safeKey(key) && (
      !Object.prototype.hasOwnProperty.call(before, key) || !equalView(before[key], after[key])
    ))
    if (objects && (removed || unsafe)) {
      setOwn(changes, path, cloneView(after))
      return
    }
    keys.forEach(key => {
      const childPath = arrays ? path + '[' + key + ']' : path + '.' + key
      const prior = Object.prototype.hasOwnProperty.call(before, key) ? before[key] : undefined
      compare(prior, after[key], childPath)
    })
  }
  compare(previous, next, namespace)
  return changes
}
