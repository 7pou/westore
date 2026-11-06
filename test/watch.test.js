const {default: WeStore, defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test('watch notifies only changed selections and supports immediate delivery', () => {
  const store = defineStore({state: {score: 1, name: 'A'}})
  const callback = jest.fn()
  store.watch(data => data.score, callback, {immediate: true})
  expect(callback.mock.calls).toEqual([[1, undefined]])
  store.patch({name: 'B'})
  store.patch({score: 2})
  store.update()
  expect(callback.mock.calls).toEqual([[1, undefined], [2, 1]])
})

test('nested mutations are detected and callback copies do not corrupt history', () => {
  const store = defineStore({state: {profile: {score: 1}}})
  const calls = []
  store.watch(data => data.profile, (value, previous) => {
    calls.push([value.score, previous.score])
    value.score = 99
    previous.score = 99
  })
  store.data.profile.score = 2
  store.update()
  store.data.profile.score = 3
  store.update()
  expect(calls).toEqual([[2, 1], [3, 2]])
  expect(store.data.profile.score).toBe(3)
})

test('unsubscribe is idempotent and does not alter the current notification list', () => {
  const store = defineStore({state: {score: 1}})
  const calls = []
  let stopSecond
  const stopFirst = store.watch(data => data.score, () => { calls.push('first'); stopSecond() })
  stopSecond = store.watch(data => data.score, () => calls.push('second'))
  store.patch({score: 2})
  stopSecond()
  store.patch({score: 3})
  stopFirst()
  stopFirst()
  store.patch({score: 4})
  expect(calls).toEqual(['first', 'second', 'first'])
})

test('round snapshot and callback order survive on mutations and late registration', () => {
  const calls = []
  const store = defineStore({state: {score: 1}, logger: () => calls.push('logger')})
  const later = jest.fn()
  store.on(data => {
    calls.push('on')
    data.score = 98
    store.data.score = 99
    store.watch(state => state.score, later)
  })
  store.watch(data => data.score, (value, previous) => calls.push([value, previous]))
  store.patch({score: 2})
  expect(calls).toEqual(['on', [2, 1], 'logger'])
  expect(later).not.toHaveBeenCalled()
})

test('selectors cannot mutate other watchers, page values or store state', () => {
  const store = defineStore({state: {profile: {score: 1}}})
  const callback = jest.fn()
  const page = createPage()
  store.bind(page, '$user')
  store.watch(data => { data.profile.score = 99; return data.profile.score }, () => {})
  store.watch(data => data.profile.score, callback)
  store.patch({profile: {score: 2}})
  expect(callback).toHaveBeenCalledWith(2, 1)
  expect(page.data.$user.profile.score).toBe(2)
  expect(store.data.profile.score).toBe(2)
})

test('invalid selector values fail without leaving subscriptions or sending pages', () => {
  const store = defineStore({state: {score: 1}})
  const callback = jest.fn()
  const page = createPage()
  store.bind(page, '$user')
  expect(() => store.watch(() => undefined, callback)).toThrow(TypeError)
  store.patch({score: 2})
  expect(callback).not.toHaveBeenCalled()
  const stop = store.watch(data => { if (data.score > 2) throw new Error('selector'); return data.score }, callback)
  expect(() => store.patch({score: 3})).toThrow('selector')
  expect(page.calls).toHaveLength(2)
  stop()
  store.update()
  expect(page.data.$user.score).toBe(3)
})

test('immediate callback failure leaves no inaccessible subscription', () => {
  const store = defineStore({state: {score: 1}})
  const callback = jest.fn(() => { throw new Error('immediate') })
  expect(() => store.watch(data => data.score, callback, {immediate: true})).toThrow('immediate')
  store.patch({score: 2})
  expect(callback).toHaveBeenCalledTimes(1)
})

test('watch initializes class baseline and reset keeps the subscription', () => {
  const store = new WeStore()
  store.data = {score: 1}
  const callback = jest.fn()
  store.watch(data => data.score, callback)
  store.patch({score: 2})
  store.reset()
  expect(callback.mock.calls).toEqual([[2, 1], [1, 2]])
})

test('nested updates do not regress watcher history', () => {
  const store = defineStore({state: {score: 1}})
  const callback = jest.fn()
  store.on(data => { if (data.score === 2) store.patch({score: 3}) })
  store.watch(data => data.score, callback)
  store.patch({score: 2})
  callback.mockClear()
  store.update()
  expect(callback).not.toHaveBeenCalled()
})
