const {defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test.each([0, 2])('nested sends keep all targets and watch history at the latest value %i', latest => {
  const store = defineStore({state: {score: 0}})
  const first = createPage()
  const second = createPage()
  const callback = jest.fn()
  store.bind(first, '$store')
  store.bind(second, '$store')
  store.watch(data => data.score, callback)
  const send = first.setData
  first.setData = function(payload) {
    send.call(this, payload)
    if (store.data.score === 1) store.patch({score: latest})
  }
  store.patch({score: 1})
  expect(store.data.score).toBe(latest)
  expect(first.data.$store.score).toBe(latest)
  expect(second.data.$store.score).toBe(latest)
  callback.mockClear()
  const counts = [first.calls.length, second.calls.length]
  store.update()
  expect(callback).not.toHaveBeenCalled()
  expect([first.calls.length, second.calls.length]).toEqual(counts)
})

test('unBind during the initial send cancels registration', () => {
  const store = defineStore({state: {score: 0}})
  const page = createPage()
  const send = page.setData
  page.setData = function(payload) { send.call(this, payload); store.unBind(this) }
  store.bind(page, '$store')
  expect(store.pages.has(page)).toBe(false)
  store.patch({score: 1})
  expect(page.calls).toHaveLength(1)
})

test('updates and duplicate bind during initial sending do not get lost or recurse', () => {
  const store = defineStore({state: {score: 0}})
  const page = createPage()
  const send = page.setData
  let first = true
  page.setData = function(payload) {
    send.call(this, payload)
    if (first) {
      first = false
      store.bind(this, '$ignored')
      store.patch({score: 1})
    }
  }
  store.bind(page, '$store')
  expect(store.pages.get(page)).toBe('$store')
  expect(page.data).toEqual({$store: {score: 1}})
  const sent = page.calls.length
  store.update()
  expect(page.calls).toHaveLength(sent)
})

test('failed initial send removes its pending registration and allows retry', () => {
  const store = defineStore({state: {score: 0}})
  const page = createPage()
  const send = page.setData
  let first = true
  page.setData = function(payload) {
    send.call(this, payload)
    if (first) {
      first = false
      store.patch({score: 1})
      throw new Error('initial send')
    }
  }
  expect(() => store.bind(page, '$store')).toThrow('initial send')
  expect(store.pages.has(page)).toBe(false)
  const sent = page.calls.length
  store.patch({score: 2})
  expect(page.calls).toHaveLength(sent)
  store.bind(page, '$retry')
  expect(page.data.$retry.score).toBe(2)
})

test('unbind and rebind during initialization preserves only the new binding', () => {
  const store = defineStore({state: {score: 0}})
  const page = createPage()
  const send = page.setData
  let first = true
  page.setData = function(payload) {
    send.call(this, payload)
    if (first) {
      first = false
      store.unBind(this)
      store.bind(this, '$new')
    }
  }
  store.bind(page, '$old')
  expect(store.pages.get(page)).toBe('$new')
  store.patch({score: 1})
  expect(page.data.$new.score).toBe(1)
  expect(page.data.$old.score).toBe(0)
})
