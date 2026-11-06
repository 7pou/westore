const {default: WeStore} = require('../src/index')
const {cloneView, cloneState, equalView, createViewSnapshot} = require('../src/snapshot')
const {createPage} = require('./helpers/page')

test('raw snapshots detach objects and preserve top-level getter identities', () => {
  const getter = () => 3
  const raw = {profile: {score: 1}, getter}
  const copied = cloneState(raw)
  raw.profile.score = 2
  expect(copied.profile.score).toBe(1)
  expect(copied.getter).toBe(getter)
  expect(() => cloneView(raw)).toThrow(TypeError)
})

test('getters receive the real store once per snapshot', () => {
  const store = new WeStore()
  const getter = jest.fn(function (state) { expect(this).toBe(store); return state.score * 2 })
  store.data = {score: 2, double: getter}
  expect(createViewSnapshot(store)).toEqual({score: 2, double: 4})
  expect(getter).toHaveBeenCalledTimes(1)
  expect(store.data.double).toBe(getter)
})

const invalidCases = [
  ['undefined', {bad: undefined}], ['NaN', {bad: NaN}], ['Infinity', {bad: Infinity}],
  ['Date', {bad: new Date()}], ['Map', {bad: new Map()}], ['nested function', {nested: {bad() {}}}],
  ['sparse array', {bad: new Array(2)}], ['symbol', {bad: Symbol('bad')}],
]
invalidCases.forEach(([name, value]) => {
  test('rejects ' + name + ' before sending page data', () => {
    const store = new WeStore()
    store.data = value
    const page = createPage()
    expect(() => store.bind(page, '$store')).toThrow(TypeError)
    expect(page.calls).toHaveLength(0)
  })
})

test('cycles fail but non-cyclic shared references become independent copies', () => {
  const circular = {}
  circular.self = circular
  expect(() => cloneView(circular)).toThrow(/cycl/i)
  const shared = {score: 1}
  const snapshot = cloneView({first: shared, second: shared})
  snapshot.first.score = 2
  expect(snapshot.second.score).toBe(1)
})

test('special own keys are data and do not mutate Object.prototype', () => {
  const raw = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"name":"safe"}}')
  const copied = cloneView(raw)
  expect(Object.prototype.hasOwnProperty.call(copied, '__proto__')).toBe(true)
  expect(Object.getPrototypeOf(copied)).toBe(Object.prototype)
  expect({}.polluted).toBeUndefined()
  expect(copied.__proto__).toEqual({polluted: true})
})

test('structural equality handles nested values, deletions and array/object differences', () => {
  expect(equalView({values: [1, null]}, {values: [1, null]})).toBe(true)
  expect(equalView({score: 1}, {})).toBe(false)
  expect(equalView([1], {0: 1})).toBe(false)
})

test('enumerable symbol keys added after initialization still fail before dispatch', () => {
  const store = new WeStore()
  store.data = {score: 1}
  const page = createPage()
  store.bind(page, '$store')
  store.data[Symbol('hidden')] = 2
  store.data.score = 2
  expect(() => store.update()).toThrow(TypeError)
  expect(page.calls).toHaveLength(1)
})
