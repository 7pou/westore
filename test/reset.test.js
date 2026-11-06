const {default: WeStore, defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test('class initialization captures populated fields and reset uses independent copies', () => {
  class UserStore extends WeStore {
    constructor() { super(); this.data = {profile: {score: 1}} }
  }
  const store = new UserStore()
  store.initialize()
  store.data.profile.score = 2
  store.data.extra = true
  store.initialize()
  store.reset()
  expect(store.data).toEqual({profile: {score: 1}})
  store.data.profile.score = 9
  store.reset()
  expect(store.data.profile.score).toBe(1)
})

test('defineStore captures state before its first direct mutation', () => {
  const state = {score: 1}
  const store = defineStore({state})
  state.score = 3
  store.reset()
  expect(store.data.score).toBe(1)
})

test('reset restores getters and preserves actions, targets and subscriptions', () => {
  const getter = state => state.score * 2
  const logger = jest.fn()
  const store = defineStore({state: {score: 1}, getters: {double: getter}, actions: {increment() { this.data.score++ }}, logger})
  const page = createPage()
  const listener = jest.fn()
  store.bind(page, '$user')
  store.on(listener)
  store.data.score = 4
  delete store.data.double
  store.data.extra = true
  store.reset()
  expect(store.data.double).toBe(getter)
  expect(page.data.$user).toEqual({score: 1, double: 2})
  expect(listener).toHaveBeenCalledTimes(1)
  expect(logger).toHaveBeenCalledTimes(1)
  store.increment()
  expect(store.data.score).toBe(2)
})

test('first bind initializes a class and duplicate bind remains a no-op', () => {
  const store = new WeStore()
  store.data = {score: 4}
  const page = createPage()
  store.bind(page, '$user')
  store.bind(page, '$other')
  store.data.score = 8
  store.reset()
  expect(page.data).toEqual({$user: {score: 4}})
})

test('reserved action names cannot overwrite store API or state', () => {
  expect(() => defineStore({actions: {reset() {}}})).toThrow(/reset/)
  expect(() => defineStore({actions: {update() {}}})).toThrow(/update/)
  expect(() => defineStore({actions: {data() {}}})).toThrow(/data/)
  expect(() => defineStore({actions: {initialState() {}}})).toThrow(/initialState/)
  expect(() => defineStore({actions: {watch() {}}})).toThrow(/watch/)
})

test('a failed initial send does not prevent binding again', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  const send = page.setData
  page.setData = () => { throw new Error('send failure') }
  expect(() => store.bind(page, '$user')).toThrow('send failure')
  expect(store.pages.has(page)).toBe(false)
  page.setData = send
  store.bind(page, '$user')
  expect(page.data.$user.score).toBe(1)
})
