const {default: WeStore, defineStore} = require('../src/index')
const {createPage} = require('./helpers/page')

test('unchanged updates skip setData while on and logger still run', () => {
  const logger = jest.fn()
  const listener = jest.fn()
  const store = defineStore({state: {score: 1}, logger})
  const page = createPage()
  store.bind(page, '$user')
  store.on(listener)
  store.update()
  expect(page.calls).toEqual([{$user: {score: 1}}])
  expect(listener).toHaveBeenCalledTimes(1)
  expect(logger).toHaveBeenCalledTimes(1)
  store.patch({score: 2})
  expect(page.calls[1]).toEqual({'$user.score': 2})
})

test('targets have independent baselines and retry failed sends only', () => {
  const store = defineStore({state: {score: 1}})
  const first = createPage()
  const second = createPage()
  store.bind(first, '$user')
  store.data.score = 2
  store.bind(second, '$user')
  store.update()
  expect(first.calls[1]).toEqual({'$user.score': 2})
  expect(second.calls).toHaveLength(1)
  const send = second.setData
  second.setData = () => { throw new Error('send') }
  expect(() => store.patch({score: 3})).toThrow('send')
  second.setData = send
  store.update()
  expect(first.calls).toHaveLength(3)
  expect(second.calls[1]).toEqual({'$user.score': 3})
})

test('target payload mutation never changes snapshots or later targets', () => {
  const store = defineStore({state: {profile: {score: 1, age: 2}}})
  const first = createPage()
  const second = createPage()
  const send = first.setData
  first.setData = function(payload) {
    send.call(this, payload)
    Object.values(payload).forEach(value => { if (value && typeof value === 'object') value.corrupt = true })
  }
  store.bind(first, '$user')
  store.bind(second, '$user')
  store.update()
  expect(first.calls).toHaveLength(1)
  store.patch({profile: {score: 2}})
  store.update()
  expect(first.calls).toHaveLength(2)
  expect(second.data.$user).toEqual({profile: {score: 2}})
})

test('getter evaluation happens once per round and finishes before any send', () => {
  const getter = jest.fn(state => state.score * 2)
  const store = defineStore({state: {score: 1}, getters: {double: getter}})
  const first = createPage()
  const second = createPage()
  store.bind(first, '$user')
  store.bind(second, '$user')
  getter.mockClear()
  store.patch({score: 2})
  expect(getter).toHaveBeenCalledTimes(1)
  getter.mockImplementation(() => { throw new Error('getter') })
  expect(() => store.update()).toThrow('getter')
  expect(first.calls).toHaveLength(2)
  expect(second.calls).toHaveLength(2)
})

test.each([1, [1, 2]])('class roots still support bind and update: %p', initial => {
  const store = new WeStore()
  const page = createPage()
  store.data = initial
  store.bind(page, '$user')
  store.update()
  expect(page.calls).toHaveLength(1)
  store.data = Array.isArray(initial) ? [1] : 2
  store.update()
  expect(page.data.$user).toEqual(store.data)
})

test('array root changes replace the namespace even when the length is unchanged', () => {
  const store = new WeStore()
  const page = createPage()
  store.data = [1, 2]
  store.bind(page, '$user')
  store.data[1] = 3
  store.update()
  expect(page.calls[1]).toEqual({$user: [1, 3]})
})

test('unbinding during a send does not leave a stale baseline on rebind', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.bind(page, '$user')
  const send = page.setData
  page.setData = function(payload) { send.call(this, payload); store.unBind(this) }
  store.patch({score: 2})
  page.setData = send
  store.bind(page, '$again')
  store.patch({score: 3})
  expect(page.data.$again.score).toBe(3)
  expect(store.pages.get(page)).toBe('$again')
})

test('on payload mutation cannot corrupt successfully sent baselines', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.bind(page, '$user')
  store.on(data => { data.score = 99 })
  store.patch({score: 2})
  store.update()
  expect(page.calls).toHaveLength(2)
  expect(page.data.$user.score).toBe(2)
})

test('pick filters top-level fields and getters before per-target comparison', () => {
  const store = defineStore({state: {name: 'A', score: 1, age: 2}, getters: {double(state) { return state.score * 2 }}})
  const selected = createPage()
  const full = createPage()
  const empty = createPage()
  store.bind(selected, '$user', {pick: ['name', 'score', 'double', 'score']})
  store.bind(full, '$user')
  store.bind(empty, '$user', {pick: []})
  expect(selected.data.$user).toEqual({name: 'A', score: 1, double: 2})
  expect(empty.data.$user).toEqual({})
  store.patch({age: 3})
  expect(selected.calls).toHaveLength(1)
  expect(empty.calls).toHaveLength(1)
  expect(full.data.$user.age).toBe(3)
  store.patch({score: 2})
  expect(selected.calls[1]).toEqual({'$user.score': 2, '$user.double': 4})
})

test('unknown picks appear later and deleted selected fields replace the namespace', () => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  const pick = ['later']
  store.bind(page, '$user', {pick})
  pick.push('score')
  expect(page.data.$user).toEqual({})
  store.patch({later: true})
  expect(page.calls[1]).toEqual({'$user.later': true})
  delete store.data.later
  store.update()
  expect(page.calls[2]).toEqual({$user: {}})
})

test('duplicate bind retains name and pick; unBind releases both', () => {
  const store = defineStore({state: {score: 1, age: 2}})
  const page = createPage()
  store.bind(page, '$user', {pick: ['score']})
  store.bind(page, '$other', {pick: ['age']})
  store.patch({score: 3, age: 4})
  expect(page.data).toEqual({$user: {score: 3}})
  store.unBind(page)
  store.bind(page, '$other', {pick: ['age']})
  store.patch({age: 5})
  expect(page.data.$other).toEqual({age: 5})
})
