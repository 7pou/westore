const {default: WeStore, defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test('bind, getter evaluation, actions and unBind retain their behavior', () => {
  const store = defineStore({
    state: {score: 1},
    getters: {double(state) { return state.score * 2 }},
    actions: {increment() { this.data.score++; this.update() }},
  })
  const page = createPage()
  store.bind(page, '$user')
  expect(page.data).toEqual({$user: {score: 1, double: 2}})
  store.increment()
  expect(page.data.$user).toEqual({score: 2, double: 4})
  store.unBind(page)
  store.increment()
  expect(page.calls).toHaveLength(2)
})

test('self-unsubscription does not skip the next listener', () => {
  const store = new WeStore()
  const calls = []
  const first = () => { calls.push('first'); store.off(first) }
  store.on(first)
  store.on(() => calls.push('second'))
  store.update()
  store.update()
  expect(calls).toEqual(['first', 'second', 'second'])
})

test('duplicate listeners and removing absent listeners are safe', () => {
  const store = new WeStore()
  const callback = jest.fn()
  store.on(callback)
  store.on(callback)
  store.off(() => {})
  store.update()
  expect(callback).toHaveBeenCalledTimes(1)
  store.off(callback)
  store.update()
  expect(callback).toHaveBeenCalledTimes(1)
})

test('optional sections, legacy data and logger work', () => {
  expect(defineStore({state: {score: 1}}).data).toEqual({score: 1})
  expect(defineStore({getters: null, actions: null}).data).toEqual({})
  const calls = []
  const store = defineStore({data: {score: 3}, logger(data) { calls.push(data.score) }})
  store.on(data => calls.push(data.score * 2))
  store.update()
  expect(calls).toEqual([6, 3])
})

test('class getters receive the store as this and multiple stores can bind one page', () => {
  class UserStore extends WeStore {
    constructor() {
      super()
      this.data = {name: 'A', greeting() { return 'Hello ' + this.data.name }}
    }
  }
  const user = new UserStore()
  const app = defineStore({state: {version: 1}})
  const page = createPage()
  user.bind(page, '$user')
  app.bind(page, '$app')
  expect(page.data).toEqual({$user: {name: 'A', greeting: 'Hello A'}, $app: {version: 1}})
})
