const {default: WeStore, defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test('synchronous actions preserve values and observe before, action, after in order', () => {
  const events = []
  const store = defineStore({actions: {sum(left, right) { events.push('action'); return left + right }}})
  store.onAction(context => {
    expect(context.name).toBe('sum')
    expect(context.args).toEqual([2, 3])
    expect(context.store).toBe(store)
    events.push('before')
    context.after(value => events.push(['after', value]))
    context.onError(() => events.push('unexpected failure'))
  })
  expect(store.sum(2, 3)).toBe(5)
  expect(events).toEqual(['before', 'action', ['after', 5]])
})

test('synchronous failures retain the exact thrown value without returning a Promise', () => {
  const error = new Error('business failure')
  const events = []
  const store = defineStore({actions: {fail() { events.push('action'); throw error }}})
  store.onAction(({after, onError}) => {
    events.push('before')
    after(() => events.push('unexpected success'))
    onError(received => { expect(received).toBe(error); events.push('failure') })
  })
  let caught
  try { store.fail() } catch (failure) { caught = failure }
  expect(caught).toBe(error)
  expect(events).toEqual(['before', 'action', 'failure'])
})

test('registered actions bind their owner when detached but never update automatically', () => {
  const store = defineStore({state: {score: 1}, actions: {increment(amount) { this.data.score += amount; return this.data.score }}})
  const page = createPage()
  store.bind(page, '$user')
  const {increment} = store
  expect(increment.call({data: {score: 100}}, 2)).toBe(3)
  expect(store.data.score).toBe(3)
  expect(page.calls).toHaveLength(1)
  store.update()
  expect(page.data.$user.score).toBe(3)
})

test('class methods are observed only after explicit registration and keep lexical arrows unchanged', () => {
  class ScoreStore extends WeStore {
    constructor() { super(); this.data = {score: 1} }
    increment(amount) { this.data.score += amount; return this.data.score }
  }
  const store = new ScoreStore()
  const hook = jest.fn()
  store.onAction(hook)
  expect(store.increment(1)).toBe(2)
  expect(hook).not.toHaveBeenCalled()
  store.registerActions({increment: store.increment})
  const {increment} = store
  expect(increment(2)).toBe(4)
  expect(hook).toHaveBeenCalledTimes(1)
  const owner = {value: 7, action() { return () => this.value }}
  store.registerActions({lexical: owner.action()})
  expect(store.lexical()).toBe(7)
})

test.each(['data', 'pages', 'logger', 'listeners', 'initialState', 'watch', 'update', 'registerActions', 'onAction', 'actionRegistry', '__proto__', 'toString', 'constructor'])('reserved action %s fails before installing any functions', name => {
  const store = new WeStore()
  const actions = {allowed() { return 1 }}
  Object.defineProperty(actions, name, {value() {}, enumerable: true})
  expect(() => store.registerActions(actions)).toThrow(/Reserved action name/)
  expect(store.allowed).toBeUndefined()
})

test('duplicate names and non-functions fail atomically', () => {
  const store = new WeStore()
  store.registerActions({first() { return 1 }})
  const original = store.first
  expect(() => store.registerActions({second() {}, first() { return 2 }})).toThrow(/already registered/)
  expect(store.first).toBe(original)
  expect(store.second).toBeUndefined()
  expect(() => store.registerActions({second() {}, invalid: 2})).toThrow(TypeError)
  expect(store.second).toBeUndefined()
  expect(() => defineStore({actions: {onAction() {}}})).toThrow(/Reserved action name/)
})

test('registration rejects fields, accessors, locked properties and non-extensible targets before writing', () => {
  const store = new WeStore()
  store.label = 'business field'
  Object.defineProperty(store, 'accessor', {get() { throw new Error('do not invoke getters') }, configurable: true})
  Object.defineProperty(store, 'locked', {value() {}, configurable: false})
  for (const name of ['label', 'accessor', 'locked']) {
    expect(() => store.registerActions({allowed() {}, [name]() {}})).toThrow()
    expect(store.allowed).toBeUndefined()
  }
  Object.preventExtensions(store)
  expect(() => store.registerActions({allowed() {}})).toThrow(TypeError)
})

test('argument arrays are frozen shallow copies and completion callbacks use a snapshot', () => {
  const input = {value: 3}
  const events = []
  const store = defineStore({actions: {read(value) { expect(value).toBe(input); return value }}})
  store.onAction(({args, after}) => {
    expect(Object.isFrozen(args)).toBe(true)
    expect(args[0]).toBe(input)
    after(value => { events.push(value); after(() => events.push('late')) })
    after(() => events.push('second'))
  })
  expect(store.read(input)).toBe(input)
  expect(events).toEqual([input, 'second'])
})

function deferred() {
  let resolve
  let reject
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail })
  return {promise, resolve, reject}
}

test('Promise actions notify only on completion and preserve their resolved value or rejection', async () => {
  const pending = deferred()
  const error = new Error('async failure')
  const events = []
  const store = defineStore({actions: {load() { return pending.promise }, fail() { return Promise.reject(error) }}})
  store.onAction(({name, after, onError}) => {
    events.push(['before', name])
    after(value => events.push(['after', name, value]))
    onError(failure => events.push(['error', name, failure]))
  })
  const result = store.load()
  expect(events).toEqual([['before', 'load']])
  pending.resolve(7)
  expect(await result).toBe(7)
  await expect(store.fail()).rejects.toBe(error)
  expect(events).toEqual([['before', 'load'], ['after', 'load', 7], ['before', 'fail'], ['error', 'fail', error]])
})

test('concurrent calls keep their own arguments and completion callbacks', async () => {
  const first = deferred()
  const second = deferred()
  const events = []
  const store = defineStore({actions: {load(name) { return name === 'A' ? first.promise : second.promise }}})
  store.onAction(({args, after}) => { events.push('before' + args[0]); after(value => events.push(['after' + args[0], value])) })
  const firstResult = store.load('A')
  const secondResult = store.load('B')
  second.resolve(2)
  expect(await secondResult).toBe(2)
  first.resolve(1)
  expect(await firstResult).toBe(1)
  expect(events).toEqual(['beforeA', 'beforeB', ['afterB', 2], ['afterA', 1]])
})

test('nested calls each have independent before and after ordering', () => {
  const events = []
  const store = defineStore({actions: {outer() { return this.inner() + 1 }, inner() { return 2 }}})
  store.onAction(({name, after}) => { events.push('before ' + name); after(value => events.push(['after ' + name, value])) })
  expect(store.outer()).toBe(3)
  expect(events).toEqual(['before outer', 'before inner', ['after inner', 2], ['after outer', 3]])
})

test('unsubscribe affects future calls but does not cancel pending completion callbacks', async () => {
  const pending = deferred()
  const events = []
  const store = defineStore({actions: {load() { return pending.promise }}})
  const stop = store.onAction(({after}) => { events.push('before'); after(value => events.push(value)) })
  const result = store.load()
  stop()
  stop()
  pending.resolve(7)
  await result
  await store.load()
  expect(events).toEqual(['before', 7])
})

test('hook additions and removals use the current call snapshot', () => {
  const events = []
  const store = defineStore({actions: {read() { return 1 }}})
  let stopSecond
  store.onAction(() => {
    events.push('first')
    stopSecond()
    store.onAction(() => events.push('added'))
  })
  stopSecond = store.onAction(() => events.push('second'))
  store.read()
  expect(events).toEqual(['first', 'second'])
  events.length = 0
  store.read()
  expect(events).toEqual(['first', 'added'])
})

test('before, after, error and reporter failures cannot replace business results', async () => {
  const beforeError = new Error('before')
  const afterError = new Error('after')
  const observerError = new Error('observer error')
  const businessError = new Error('business')
  const reports = []
  const successes = []
  const failures = []
  const store = defineStore({actions: {
    read() { return 7 },
    fail() { throw businessError },
    load() { return Promise.resolve(8) },
    reject() { return Promise.reject(businessError) },
  }})
  store.onAction(({after, onError}) => {
    after(() => { throw afterError })
    onError(() => { throw observerError })
    throw beforeError
  }, {onHookError(error) { reports.push(error); throw new Error('reporter') }})
  store.onAction(({after, onError}) => { after(value => successes.push(value)); onError(error => failures.push(error)) })
  expect(store.read()).toBe(7)
  expect(() => store.fail()).toThrow(businessError)
  expect(await store.load()).toBe(8)
  await expect(store.reject()).rejects.toBe(businessError)
  expect(successes).toEqual([7, 8])
  expect(failures).toEqual([businessError, businessError])
  expect(reports).toEqual([beforeError, afterError, beforeError, observerError, beforeError, afterError, beforeError, observerError])
})

test('observer failures without a reporter are isolated and invalid callbacks are reported', () => {
  const store = defineStore({actions: {read() { return 7 }}})
  const onHookError = jest.fn()
  store.onAction(() => { throw new Error('ignored') })
  store.onAction(({after}) => after(null), {onHookError})
  expect(store.read()).toBe(7)
  expect(onHookError).toHaveBeenCalledTimes(1)
  expect(onHookError.mock.calls[0][0]).toBeInstanceOf(TypeError)
})

test('foreign thenables are read once, keep their receiver, assimilate values and settle once', async () => {
  const events = []
  let reads = 0
  const thenable = {get then() {
    reads++
    return function (resolve, reject) {
      expect(this).toBe(thenable)
      resolve(Promise.resolve(7))
      reject(new Error('too late'))
      resolve(8)
      throw new Error('also too late')
    }
  }}
  const store = defineStore({actions: {load() { return thenable }}})
  store.onAction(({after, onError}) => { after(value => events.push(value)); onError(() => events.push('failure')) })
  const result = store.load()
  expect(events).toEqual([])
  expect(await result).toBe(7)
  expect(reads).toBe(1)
  expect(events).toEqual([7])
})

test('then property access errors stay synchronous while then invocation errors reject', async () => {
  const accessError = new Error('get then')
  const callError = new Error('call then')
  const errors = []
  const store = defineStore({actions: {
    access() { return {get then() { throw accessError }} },
    call() { return {then() { throw callError }} },
  }})
  store.onAction(({onError}) => onError(error => errors.push(error)))
  expect(() => store.access()).toThrow(accessError)
  await expect(store.call()).rejects.toBe(callError)
  expect(errors).toEqual([accessError, callError])
})

test('function thenables resolve but non-callable then fields remain synchronous data', async () => {
  const thenable = () => {}
  thenable.then = resolve => resolve(9)
  const value = {then: 3}
  const seen = []
  const store = defineStore({actions: {load() { return thenable }, read() { return value }}})
  store.onAction(({after}) => after(result => seen.push(result)))
  expect(store.read()).toBe(value)
  expect(seen).toEqual([value])
  expect(await store.load()).toBe(9)
  expect(seen).toEqual([value, 9])
})

test.each([undefined, null, 0, 'business failure'])('synchronous non-Error throws retain identity: %p', failure => {
  const errors = []
  const store = defineStore({actions: {fail() { throw failure }}})
  store.onAction(({onError}) => onError(error => errors.push(error)))
  let didThrow = false
  try { store.fail() } catch (error) { didThrow = true; expect(error).toBe(failure) }
  expect(didThrow).toBe(true)
  expect(errors).toEqual([failure])
})

test('invalid hooks and action maps fail before subscribing or installing', () => {
  const store = new WeStore()
  for (const actions of [null, undefined, [], 'invalid', () => {}]) expect(() => store.registerActions(actions)).toThrow(TypeError)
  expect(() => store.onAction(null)).toThrow(TypeError)
  expect(() => store.onAction(() => {}, {onHookError: 2})).toThrow(TypeError)
  expect(() => store.onAction(() => {}, null)).toThrow(TypeError)
})

test('business update failures retain M1 propagation even when action observers fail', () => {
  const error = new Error('on update')
  const store = defineStore({state: {score: 0}, actions: {change() { this.patch({score: 1}) }}})
  store.on(() => { throw error })
  store.onAction(({onError}) => onError(() => { throw new Error('observer') }))
  expect(() => store.change()).toThrow(error)
  expect(store.data.score).toBe(1)
})
