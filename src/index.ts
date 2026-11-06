import {
  StateRecord, ResolvedData, Instance, GetterMap, ActionMap, WritableState,
  WatchOptions, BindOptions, Unsubscribe, ActionHook, ActionHookOptions, RegisteredActions
} from './types'

import {createActionRegistry, ActionRegistry} from './actions'

import {
  cloneState, cloneView, createViewSnapshot, setOwn, isPlainObject, diffView, equalView
} from './snapshot'

type Binding = {
  name: string
  snapshot: unknown
  pick?: string[]
  revision: number
  sending: number
}
type Watcher<State> = {
  selector: (data: Readonly<ResolvedData<State>>) => any
  callback: (value: any, previous: any) => void
  value: unknown
  revision: number
}

function selectView(data: unknown, pick?: string[]): unknown {
  if (!pick) return data
  const selected: StateRecord = {}
  const source: StateRecord = Object(data)
  pick.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      setOwn(selected, key, source[key])
    }
  })
  return selected
}

class WeStore<State = StateRecord> {
  data: State

  pages: Map<Instance, string>

  logger?: null | ((data: ResolvedData<State>) => void)

  listeners: Array<(data: ResolvedData<State>) => void>

  private initialized = false

  private initialState: {data: State} | undefined = undefined

  private batchDepth = 0

  private bindings = new Map<Instance, Binding>()

  private watchers = new Set<Watcher<State>>()

  private updateRevision = 0

  private actionRegistry: ActionRegistry<this>

  constructor() {
    this.data = {} as State
    this.logger = null
    this.pages = new Map()
    this.listeners = []
    this.actionRegistry = createActionRegistry(this, [
      ...Object.getOwnPropertyNames(this), ...Object.getOwnPropertyNames(WeStore.prototype), 'actionRegistry'
    ])
  }

  registerActions<Actions extends ActionMap>(actions: Actions & ThisType<this>): void {
    this.actionRegistry.register(actions)
  }

  onAction(hook: ActionHook<this>, options?: ActionHookOptions): Unsubscribe {
    return this.actionRegistry.subscribe(hook, options)
  }

  bind(instance: Instance, name: string, options: BindOptions<State> = {}) {
    if (!name) throw new Error('name is undefined')
    if (!this.bindings.has(instance)) {
      this.initialize()
      const pick = options.pick && Array.from(new Set(options.pick))
      const snapshot = selectView(createViewSnapshot(this), pick)
      const binding = {
        name, snapshot: undefined, pick, revision: -1, sending: 0
      }
      this.bindings.set(instance, binding)
      try {
        this.sendView(instance, binding, snapshot, this.updateRevision)
        if (this.bindings.get(instance) === binding) this.pages.set(instance, name)
      } catch (error) {
        if (this.bindings.get(instance) === binding) this.unBind(instance)
        throw error
      }
    }
  }

  unBind(instance: Instance) {
    this.pages.delete(instance)
    this.bindings.delete(instance)
  }

  on(fn: (data: ResolvedData<State>) => void) {
    this.initialize()
    if (this.listeners.find(e => e === fn)) return
    this.listeners.push(fn)
  }

  off(fn: (data: ResolvedData<State>) => void) {
    const index = this.listeners.findIndex(e => e === fn)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  watch<Value>(
    selector: (data: Readonly<ResolvedData<State>>) => Value,
    callback: (value: Value, previousValue: Value | undefined) => void,
    options: WatchOptions = {}
  ): Unsubscribe {
    this.initialize()
    const value = cloneView(selector(createViewSnapshot(this)))
    const watcher = {
      selector, callback, value, revision: this.updateRevision
    }
    this.watchers.add(watcher)
    try {
      if (options.immediate) callback(cloneView(value), undefined)
    } catch (error) {
      this.watchers.delete(watcher)
      throw error
    }
    return () => { this.watchers.delete(watcher) }
  }

  update() {
    this.initialize()
    if (this.batchDepth > 0) return
    const revision = ++this.updateRevision
    const data = createViewSnapshot(this)
    const listeners = this.listeners.slice()
    const selections = Array.from(this.watchers).map(watcher => ({
      watcher,
      value: cloneView(watcher.selector(cloneView(data))),
      previous: watcher.value
    }))
    const notifications = selections.filter(({value, previous}) => !equalView(value, previous))
    Array.from(this.bindings).forEach(([instance, binding]) => {
      this.sendView(instance, binding, selectView(data, binding.pick), revision)
    })
    selections.forEach(({watcher, value}) => {
      if (watcher.revision < revision) {
        watcher.value = value
        watcher.revision = revision
      }
    })
    listeners.forEach(fn => {
      if (typeof fn === 'function') fn(data)
    })
    notifications.forEach(({watcher, value, previous}) => {
      watcher.callback(cloneView(value), cloneView(previous))
    })
    if (typeof this.logger === 'function') {
      this.logger(data)
    }
  }

  private sendView(
    instance: Instance, binding: Binding, snapshot: unknown, revision: number
  ): void {
    if (this.bindings.get(instance) !== binding || binding.revision > revision) return
    const previous = binding.sending > 0 ? undefined : binding.snapshot
    const changes = diffView(previous, snapshot, binding.name)
    if (Object.keys(changes).length > 0) {
      binding.sending++
      try {
        instance.setData(changes)
      } finally {
        binding.sending--
      }
    }
    if (this.bindings.get(instance) === binding && binding.revision <= revision) {
      binding.snapshot = cloneView(snapshot)
      binding.revision = revision
    }
  }

  initialize(): void {
    if (this.initialized) return
    this.initialState = {data: cloneState(this.data)}
    this.initialized = true
  }

  reset(): void {
    this.initialize()
    if (!this.initialState) throw new Error('Store initialization did not capture state')
    this.data = cloneState(this.initialState.data)
    this.update()
  }

  patch(partial: Partial<WritableState<State>>): void {
    this.initialize()
    if (!isPlainObject(this.data) || !isPlainObject(partial)) {
      throw new TypeError('patch requires plain object state and partial values')
    }
    const data = this.data as StateRecord
    const next = cloneView(partial)
    Object.keys(next).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(data, key) && typeof data[key] === 'function') {
        throw new TypeError('Cannot patch getter: ' + key)
      }
    })
    Object.keys(next).forEach(key => setOwn(data, key, next[key]))
    this.update()
  }

  batch<Result>(callback: () => Result): Result {
    this.initialize()
    this.batchDepth++
    let outcome: {value: Result; failed: false} | {error: unknown; failed: true}
    try {
      const result = callback()
      if (result && typeof (result as any).then === 'function') {
        throw new TypeError('batch requires a synchronous callback')
      }
      outcome = {value: result, failed: false}
    } catch (error) {
      outcome = {error, failed: true}
    }
    this.batchDepth--
    if (this.batchDepth === 0) {
      try {
        this.update()
      } catch (error) {
        if (!outcome.failed) throw error
      }
    }
    if (outcome.failed) throw outcome.error
    return outcome.value
  }
}


export type StoreOptions<State, Getters, Actions> = {
  state?: State
  data?: State
  getters?: Getters & GetterMap<State> & ThisType<WeStore<State>> | null
  actions?: Actions & ThisType<WeStore<State & Getters> & Actions> | null
  logger?: ((data: ResolvedData<State & Getters>) => void) | null
}

const defineStore = <
  State extends StateRecord = StateRecord,
  Getters extends GetterMap<State> = {},
  Actions extends ActionMap = {}
>(options: StoreOptions<State, Getters, Actions>):
WeStore<State & Getters> & RegisteredActions<Actions> => {
  const store = new WeStore<State & Getters>()
  const actions: ActionMap = options.actions || {}
  const getters: GetterMap<State> = options.getters || {}
  store.data = (options.state || options.data || {}) as State & Getters
  store.logger = options.logger
  const data = store.data as StateRecord
  Object.keys(getters).forEach(key => {
    setOwn(data, key, getters[key])
  })
  store.registerActions(actions)
  store.initialize()
  return store as WeStore<State & Getters> & RegisteredActions<Actions>
}


export {defineStore}
export * from './types'
export default WeStore
