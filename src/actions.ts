import {
  ActionMap, ActionHook, ActionHookOptions, Unsubscribe
} from './types'

type Subscription<Store> = {hook: ActionHook<Store>; onHookError?: (error: unknown) => void}
type Completion = {callback: (value: any) => void; onHookError?: (error: unknown) => void}

function observe(
  callback: (value: any) => void, value: any, onHookError?: (error: unknown) => void
): boolean {
  try {
    callback(value)
    return true
  } catch (error) {
    try {
      if (onHookError) onHookError(error)
    } catch (reportError) {
      return false
    }
    return false
  }
}

export interface ActionRegistry<Store> {
  register(actions: ActionMap): void
  subscribe(hook: ActionHook<Store>, options?: ActionHookOptions): Unsubscribe
}

function propertyDescriptor(target: object, name: string): PropertyDescriptor | undefined {
  let current: object | null = target
  while (current) {
    const descriptor = Object.getOwnPropertyDescriptor(current, name)
    if (descriptor) return descriptor
    current = Object.getPrototypeOf(current)
  }
  return undefined
}

export function createActionRegistry<Store extends object>(
  store: Store, reservedNames: string[]
): ActionRegistry<Store> {
  const reserved = new Set(reservedNames)
  const registered = new Set<string>()
  const subscriptions = new Set<Subscription<Store>>()

  function wrap(name: string, action: (...args: any[]) => any): (...args: any[]) => any {
    return (...args: any[]) => {
      const after: Completion[] = []
      const failures: Completion[] = []
      const observedArgs = Object.freeze(args.slice())
      let completed = false
      function register(
        callbacks: Completion[], callback: (value: any) => void, subscription: Subscription<Store>
      ): void {
        if (typeof callback !== 'function') throw new TypeError('Action completion callback must be a function')
        if (!completed) callbacks.push({callback, onHookError: subscription.onHookError})
      }
      function finish(callbacks: Completion[], value: any): void {
        completed = true
        const pending = callbacks.slice()
        after.length = 0
        failures.length = 0
        pending.forEach(completion => observe(completion.callback, value, completion.onHookError))
      }
      Array.from(subscriptions).forEach(subscription => {
        observe(subscription.hook, {
          name,
          args: observedArgs,
          store,
          after(callback: (result: any) => void) { register(after, callback, subscription) },
          onError(callback: (error: unknown) => void) { register(failures, callback, subscription) }
        }, subscription.onHookError)
      })
      let result: any
      let then: any
      try {
        result = action.apply(store, args)
        if (result !== null &&
          (typeof result === 'object' || typeof result === 'function')) {
          then = result.then
        }
      } catch (error) {
        finish(failures, error)
        throw error
      }
      if (typeof then === 'function') {
        const pending = new Promise<any>((resolve, reject) => {
          then.call(result, resolve, reject)
        })
        return pending.then(value => {
          finish(after, value)
          return value
        }, error => {
          finish(failures, error)
          throw error
        })
      }
      finish(after, result)
      return result
    }
  }

  return {
    register(actions) {
      if (!actions || typeof actions !== 'object' || Array.isArray(actions)) {
        throw new TypeError('Actions must be a function map')
      }
      const entries = Object.keys(actions).map(name => ({name, action: actions[name]}))
      entries.forEach(({name, action}) => {
        if (reserved.has(name) || name in Object.prototype) throw new Error('Reserved action name: ' + name)
        if (registered.has(name)) throw new Error('Action already registered: ' + name)
        if (typeof action !== 'function') throw new TypeError('Action must be a function: ' + name)
        const own = Object.getOwnPropertyDescriptor(store, name)
        const existing = propertyDescriptor(store, name)
        if (existing && typeof existing.value !== 'function') throw new TypeError('Action cannot replace a field or accessor: ' + name)
        if ((own && !own.configurable) || (!own && !Object.isExtensible(store))) {
          throw new TypeError('Action cannot replace a locked property: ' + name)
        }
      })
      entries.forEach(({name, action}) => {
        Object.defineProperty(store, name, {
          value: wrap(name, action), enumerable: true, configurable: true, writable: true
        })
        registered.add(name)
      })
    },
    subscribe(hook, options = {}) {
      if (typeof hook !== 'function') throw new TypeError('Action hook must be a function')
      const {onHookError} = options
      if (onHookError !== undefined && typeof onHookError !== 'function') {
        throw new TypeError('onHookError must be a function')
      }
      const subscription = {hook, onHookError}
      subscriptions.add(subscription)
      return () => { subscriptions.delete(subscription) }
    }
  }
}
