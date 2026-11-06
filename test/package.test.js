const {default: WeStore, defineStore} = require('..')
const {createPage} = require('./helpers/page')

test('package entrypoint provides batching, watches, pick, diff and reset', () => {
  expect(typeof WeStore).toBe('function')
  expect(typeof defineStore).toBe('function')
  const store = defineStore({
    state: {score: 1, level: 1, hidden: 'secret'},
    getters: {double(state) { return state.score * 2 }},
  })
  const page = createPage()
  const callback = jest.fn()
  store.bind(page, '$store', {pick: ['score', 'level', 'double']})
  const stop = store.watch(data => data.score, callback)
  store.batch(() => {
    store.patch({score: 2})
    store.patch({level: 3})
  })
  expect(page.data.$store).toEqual({score: 2, level: 3, double: 4})
  expect(page.calls[1]).toEqual({'$store.score': 2, '$store.level': 3, '$store.double': 4})
  expect(callback.mock.calls).toEqual([[2, 1]])
  store.reset()
  expect(page.data.$store).toEqual({score: 1, level: 1, double: 2})
  stop()
  store.patch({score: 4})
  expect(callback).toHaveBeenCalledTimes(2)
  store.unBind(page)
  store.patch({score: 5})
  expect(page.data.$store.score).toBe(4)
})

test('optional persistence subpath works without wx and saves one selected batch snapshot', () => {
  expect(global.wx).toBeUndefined()
  expect(require('..').persistStore).toBeUndefined()
  const {persistStore, createWxStorageAdapter} = require('../persistence')
  expect(typeof persistStore).toBe('function')
  expect(typeof createWxStorageAdapter).toBe('function')
  let cached = JSON.stringify({version: 1, state: {score: 4}})
  const writes = []
  const storage = createWxStorageAdapter({
    getStorageSync() { return cached },
    setStorageSync(key, value) { cached = value; writes.push([key, JSON.parse(value)]) },
    removeStorageSync() { cached = '' },
  })
  const store = defineStore({state: {score: 1, hidden: 'secret'}})
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage})
  expect(store.data).toEqual({score: 4, hidden: 'secret'})
  expect(writes).toEqual([])
  store.batch(() => { store.patch({score: 5}); store.patch({score: 6, hidden: 'private'}) })
  expect(writes).toEqual([['user', {version: 1, state: {score: 6}}]])
  controller.clear()
  expect(cached).toBe('')
  expect(store.data.score).toBe(6)
  controller.stop()
  store.patch({score: 7})
  expect(writes).toHaveLength(1)
})

test('persistence package keeps its baseline current after reentrant writes and cache clearing', () => {
  const {persistStore} = require('../persistence')
  const store = defineStore({state: {score: 0}})
  let cached = null
  let reenter = true
  const storage = {
    getItem() { return cached },
    setItem(key, value) {
      if (JSON.parse(value).state.score === 3) throw new Error('quota')
      cached = value
      if (reenter) { reenter = false; store.patch({score: 2}) }
    },
    removeItem() { cached = null },
  }
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage})
  store.patch({score: 1})
  expect(JSON.parse(cached).state.score).toBe(2)
  store.patch({score: 1})
  expect(JSON.parse(cached).state.score).toBe(1)
  controller.clear()
  store.patch({score: 3})
  store.patch({score: 1})
  expect(JSON.parse(cached).state.score).toBe(1)
  controller.stop()
})

test('package actions observe sync/async success and failure without altering results', async () => {
  const error = new Error('business')
  const events = []
  const store = defineStore({state: {score: 1}, actions: {
    add(amount) { return this.data.score + amount },
    load() { return Promise.resolve(7) },
    fail() { throw error },
    reject() { return Promise.reject(error) },
  }})
  const stop = store.onAction(({name, after, onError}) => {
    events.push(['before', name])
    after(value => events.push(['after', name, value]))
    onError(failure => events.push(['error', name, failure]))
  })
  const {add} = store
  expect(add(2)).toBe(3)
  expect(await store.load()).toBe(7)
  expect(() => store.fail()).toThrow(error)
  await expect(store.reject()).rejects.toBe(error)
  expect(events).toEqual([
    ['before', 'add'], ['after', 'add', 3], ['before', 'load'], ['after', 'load', 7],
    ['before', 'fail'], ['error', 'fail', error], ['before', 'reject'], ['error', 'reject', error],
  ])
  stop()
  expect(add(3)).toBe(4)
  expect(events).toHaveLength(8)
})

test('action batch integrates with watch and optional persistence through real package entries', () => {
  const {persistStore} = require('../persistence')
  const events = []
  const store = defineStore({state: {score: 0}, actions: {advance() {
    this.batch(() => { this.patch({score: 1}); this.patch({score: 2}) })
    return this.data.score
  }}})
  store.onAction(({after}) => { events.push('before'); after(value => events.push(['after', value])) })
  store.watch(data => data.score, value => events.push(['watch', value]))
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage: {
    getItem() { return null },
    setItem(key, value) { events.push(['save', key, JSON.parse(value)]) },
    removeItem() {},
  }})
  expect(store.advance()).toBe(2)
  expect(events).toEqual(['before', ['watch', 2], ['save', 'user', {version: 1, state: {score: 2}}], ['after', 2]])
  controller.stop()
})
