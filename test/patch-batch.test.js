const {default: WeStore, defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test('patch shallow-merges, clones inputs and synchronizes once', () => {
  const store = defineStore({state: {name: 'A', profile: {score: 1, age: 2}}})
  const page = createPage()
  store.bind(page, '$store')
  const partial = {profile: {score: 3}}
  store.patch(partial)
  partial.profile.score = 4
  expect(store.data).toEqual({name: 'A', profile: {score: 3}})
  expect(page.data.$store).toEqual({name: 'A', profile: {score: 3}})
  expect(page.calls).toHaveLength(2)
})

test('patch validates all values and getter keys before changing any field', () => {
  const store = defineStore({state: {score: 1}, getters: {double(state) { return state.score * 2 }}})
  expect(() => store.patch({score: 2, double: 3})).toThrow(/getter/i)
  expect(store.data.score).toBe(1)
  expect(() => store.patch({score: 2, bad: undefined})).toThrow(TypeError)
  expect(store.data.score).toBe(1)
  expect(() => store.patch(() => {})).toThrow(TypeError)
})

test('non-object roots reject patch', () => {
  const store = new WeStore()
  store.data = [1, 2]
  expect(() => store.patch({0: 3})).toThrow(TypeError)
  expect(store.data).toEqual([1, 2])
})

test('nested batch coalesces patch, update and direct changes synchronously', () => {
  const store = defineStore({state: {score: 1, level: 1}})
  const page = createPage()
  const listener = jest.fn()
  const logger = jest.fn()
  store.bind(page, '$store')
  store.on(listener)
  store.logger = logger
  const result = store.batch(() => {
    store.patch({score: 2})
    store.batch(() => { store.data.level = 3; store.update() })
    expect(page.calls).toHaveLength(1)
    return 7
  })
  expect(result).toBe(7)
  expect(page.data.$store).toEqual({score: 2, level: 3})
  expect(page.calls).toHaveLength(2)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(logger).toHaveBeenCalledTimes(1)
})

test('batch exceptions keep changes, flush and release future synchronization', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.bind(page, '$store')
  const error = new Error('original')
  expect(() => store.batch(() => { store.data.score = 2; throw error })).toThrow(error)
  expect(page.data.$store.score).toBe(2)
  store.patch({score: 3})
  expect(page.data.$store.score).toBe(3)
})

test('callback error wins over a flush error, including thrown undefined', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.bind(page, '$store')
  page.setData = () => { throw new Error('flush') }
  const original = new Error('callback')
  expect(() => store.batch(() => { store.data.score = 2; throw original })).toThrow(original)
  let caught = false
  try { store.batch(() => { store.data.score = 3; throw undefined }) } catch (error) { caught = true; expect(error).toBeUndefined() }
  expect(caught).toBe(true)
  expect(() => store.batch(() => { store.data.score = 4 })).toThrow('flush')
})

test('thenable batches are rejected and do not strand later patches', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.bind(page, '$store')
  expect(() => store.batch(() => ({then() {}}))).toThrow(/synchronous/i)
  store.patch({score: 2})
  expect(page.data.$store.score).toBe(2)
})

test.each([undefined, null, false, 0, '', {score: 2}])('batch preserves callback return value %p', value => {
  const store = defineStore({state: {score: 1}})
  const listener = jest.fn()
  store.on(listener)
  expect(store.batch(() => value)).toBe(value)
  expect(listener).toHaveBeenCalledTimes(1)
})

test('first binding inside batch sees intermediate state then receives final state', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.batch(() => {
    store.data.score = 2
    store.bind(page, '$store')
    expect(page.data.$store.score).toBe(2)
    store.patch({score: 3})
  })
  expect(page.data.$store.score).toBe(3)
})

test('reset joins a batch and baseline is captured before direct callback mutations', () => {
  const store = new WeStore()
  store.data = {score: 1}
  const callback = jest.fn()
  store.on(callback)
  store.batch(() => { store.data.score = 5; store.reset() })
  expect(store.data.score).toBe(1)
  expect(callback).toHaveBeenCalledTimes(1)
})

test('patch special own keys does not change the state prototype', () => {
  const store = defineStore({state: {score: 1}})
  store.patch(JSON.parse('{"__proto__":{"polluted":true}}'))
  expect(Object.getPrototypeOf(store.data)).toBe(Object.prototype)
  expect(store.data.__proto__).toEqual({polluted: true})
  expect({}.polluted).toBeUndefined()
})

test('empty batch skips unchanged pages but not on and logger', () => {
  const logger = jest.fn()
  const listener = jest.fn()
  const store = defineStore({state: {score: 1}, logger})
  const page = createPage()
  store.bind(page, '$user')
  store.on(listener)
  store.batch(() => {})
  expect(page.calls).toHaveLength(1)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(logger).toHaveBeenCalledTimes(1)
})
