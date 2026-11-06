const {default: WeStore, defineStore} = require('../src/index')
const {persistStore} = require('../src/persistence')
const {createPage} = require('./helpers/page')

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  const writes = []
  const reads = []
  const removals = []
  return {
    values, writes, reads, removals,
    getItem(key) { reads.push(key); return values.has(key) ? values.get(key) : null },
    setItem(key, value) { writes.push([key, value]); values.set(key, value) },
    removeItem(key) { removals.push(key); values.delete(key) },
  }
}

test('persists only selected fields on change, without an initial write', () => {
  const store = defineStore({state: {score: 1, name: 'A', token: 'private'}})
  const storage = memoryStorage()
  const pick = ['score', 'score']
  persistStore(store, {key: 'user', pick, storage})
  pick.push('token')
  expect(storage.reads).toEqual(['user'])
  expect(storage.writes).toEqual([])
  store.patch({name: 'B'})
  store.update()
  expect(storage.writes).toEqual([])
  store.patch({score: 2})
  expect(storage.writes).toHaveLength(1)
  expect(storage.writes[0][0]).toBe('user')
  expect(JSON.parse(storage.values.get('user'))).toEqual({version: 1, state: {score: 2}})
})

test('clear invalidates the saved baseline even when the next save fails', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage()
  const onError = jest.fn()
  const write = storage.setItem
  storage.setItem = (key, value) => {
    if (JSON.parse(value).state.score === 2) throw new Error('quota')
    write(key, value)
  }
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, onError})
  store.patch({score: 1})
  controller.clear()
  store.update()
  expect(storage.getItem('user')).toBeNull()
  store.patch({score: 2})
  expect(onError).toHaveBeenCalledTimes(1)
  store.patch({score: 1})
  expect(JSON.parse(storage.getItem('user'))).toEqual({version: 1, state: {score: 1}})
  expect(storage.writes).toHaveLength(2)
})

test('older save completions cannot replace a newer reentrant saved baseline', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage()
  const write = storage.setItem
  let reenter = true
  storage.setItem = (key, value) => {
    write(key, value)
    if (reenter) { reenter = false; store.patch({score: 2}) }
  }
  persistStore(store, {key: 'user', pick: ['score'], storage})
  store.patch({score: 1})
  expect(store.data.score).toBe(2)
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(2)
  store.patch({score: 1})
  expect(storage.writes.map(entry => JSON.parse(entry[1]).state.score)).toEqual([1, 2, 1])
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(1)
})

test('older hydrate completions cannot replace a newer nested restored baseline', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage({user: JSON.stringify({version: 1, state: {score: 1}})})
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, autoHydrate: false})
  let reenter = true
  store.on(data => {
    if (data.score === 1 && reenter) {
      reenter = false
      storage.values.set('user', JSON.stringify({version: 1, state: {score: 2}}))
      expect(controller.hydrate()).toBe(true)
    }
  })
  expect(controller.hydrate()).toBe(true)
  expect(store.data.score).toBe(2)
  expect(storage.writes).toEqual([])
  store.patch({score: 1})
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(1)
  expect(storage.writes).toHaveLength(1)
})

test('clear during a save prevents the interrupted completion reviving a deleted baseline', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage()
  const write = storage.setItem
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage})
  let reenter = true
  storage.setItem = (key, value) => {
    if (JSON.parse(value).state.score === 2) throw new Error('quota')
    write(key, value)
    if (reenter) { reenter = false; controller.clear() }
  }
  store.patch({score: 1})
  expect(storage.getItem('user')).toBeNull()
  store.patch({score: 2})
  store.patch({score: 1})
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(1)
})

test('clear does not discard a newer baseline saved inside the storage deletion', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage()
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage})
  store.patch({score: 1})
  const remove = storage.removeItem
  storage.removeItem = key => { remove(key); store.patch({score: 2}) }
  controller.clear()
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(2)
  store.patch({score: 1})
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(1)
  expect(storage.writes.map(entry => JSON.parse(entry[1]).state.score)).toEqual([1, 2, 1])
})

test('clear inside a hydration batch keeps the restored notification from rewriting the cache', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage({user: JSON.stringify({version: 1, state: {score: 1}})})
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, autoHydrate: false})
  store.batch(() => { expect(controller.hydrate()).toBe(true); controller.clear() })
  expect(store.data.score).toBe(1)
  expect(storage.getItem('user')).toBeNull()
  expect(storage.writes).toEqual([])
  store.patch({score: 2})
  expect(JSON.parse(storage.getItem('user')).state.score).toBe(2)
})

test('batch writes one final envelope and nested values are tracked structurally', () => {
  const store = defineStore({state: {profile: {score: 1}}})
  const storage = memoryStorage()
  persistStore(store, {key: 'user', pick: ['profile'], storage})
  store.batch(() => {
    store.patch({profile: {score: 2}})
    store.data.profile.score = 3
    store.update()
  })
  expect(storage.writes).toHaveLength(1)
  expect(JSON.parse(storage.values.get('user'))).toEqual({version: 1, state: {profile: {score: 3}}})
})

test('empty pick never writes state and missing fields can appear or be deleted', () => {
  const store = defineStore({state: {score: 1}})
  const empty = memoryStorage()
  const selected = memoryStorage()
  persistStore(store, {key: 'empty', pick: [], storage: empty})
  persistStore(store, {key: 'optional', pick: ['later'], storage: selected})
  store.patch({score: 2, later: true})
  expect(empty.writes).toEqual([])
  expect(JSON.parse(selected.values.get('optional')).state).toEqual({later: true})
  delete store.data.later
  store.update()
  expect(JSON.parse(selected.values.get('optional')).state).toEqual({})
})

test('current-version auto hydration precedes subscription and does not overwrite cache', () => {
  const cached = JSON.stringify({version: 1, state: {score: 8, token: 'do not restore'}})
  const storage = memoryStorage({user: cached})
  const store = defineStore({state: {score: 1, name: 'A'}})
  const page = createPage()
  store.bind(page, '$user')
  persistStore(store, {key: 'user', pick: ['score'], storage})
  expect(store.data).toEqual({score: 8, name: 'A'})
  expect(page.data.$user).toEqual({score: 8, name: 'A'})
  expect(storage.writes).toEqual([])
  expect(storage.values.get('user')).toBe(cached)
})

test('stop is idempotent; clear and explicit hydrate still work after stopping', () => {
  const store = defineStore({state: {score: 1}})
  const storage = memoryStorage()
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage})
  store.patch({score: 2})
  controller.stop()
  controller.stop()
  store.patch({score: 3})
  expect(storage.writes).toHaveLength(1)
  expect(controller.hydrate()).toBe(true)
  expect(store.data.score).toBe(2)
  controller.clear()
  expect(storage.removals).toEqual(['user'])
  expect(storage.values.has('user')).toBe(false)
  expect(store.data.score).toBe(2)
  expect(controller.hydrate()).toBe(false)
})

test('stop during on prevents an already snapshotted save callback from writing', () => {
  const store = defineStore({state: {score: 1}})
  const storage = memoryStorage()
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage})
  store.on(() => controller.stop())
  store.patch({score: 2})
  expect(storage.writes).toEqual([])
})

test('storage and error-reporter exceptions never break normal state updates', () => {
  const store = defineStore({state: {score: 1}})
  const storage = memoryStorage()
  const failure = new Error('quota')
  const errors = []
  storage.setItem = () => { throw failure }
  persistStore(store, {key: 'user', pick: ['score'], storage, onError(error) { errors.push(error); throw new Error('report') }})
  expect(() => store.patch({score: 2})).not.toThrow()
  expect(store.data.score).toBe(2)
  expect(errors).toEqual([failure])
})

test('read and clear failures are reported without corrupting store state', () => {
  const store = defineStore({state: {score: 1}})
  const storage = memoryStorage()
  const failure = new Error('storage unavailable')
  const onError = jest.fn()
  storage.getItem = () => { throw failure }
  storage.removeItem = () => { throw failure }
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, onError})
  expect(controller.hydrate()).toBe(false)
  expect(() => controller.clear()).not.toThrow()
  expect(onError).toHaveBeenCalledTimes(3)
  expect(store.data.score).toBe(1)
  store.patch({score: 2})
  expect(storage.writes).toHaveLength(1)
})

test.each([{key: ''}, {key: '  '}, {version: 0}, {version: 1.5}, {version: Infinity}, {pick: ['double']}, {pick: null}, {storage: {}}])('invalid options fail before subscribing: %p', patch => {
  const store = defineStore({state: {score: 1}, getters: {double(state) { return state.score * 2 }}})
  const storage = memoryStorage()
  expect(() => persistStore(store, Object.assign({key: 'user', pick: ['score'], storage}, patch))).toThrow()
  store.patch({score: 2})
  expect(storage.reads).toEqual([])
  expect(storage.writes).toEqual([])
})

test('persistence rejects non-object roots', () => {
  const store = new WeStore()
  store.data = [1, 2]
  expect(() => persistStore(store, {key: 'user', pick: ['0'], storage: memoryStorage()})).toThrow(TypeError)
})

test('reentrant on updates cannot overwrite newer saved values with old notifications', () => {
  const store = defineStore({state: {score: 0}})
  const storage = memoryStorage()
  persistStore(store, {key: 'user', pick: ['score'], storage})
  store.on(data => { if (data.score === 1) store.patch({score: 2}) })
  store.patch({score: 1})
  expect(storage.writes).toHaveLength(1)
  expect(JSON.parse(storage.values.get('user')).state).toEqual({score: 2})
})

test('a selected field changed into a getter is reported, not persisted as computed data', () => {
  const store = defineStore({state: {score: 1}})
  const storage = memoryStorage()
  const onError = jest.fn()
  persistStore(store, {key: 'user', pick: ['score'], storage, onError})
  store.data.score = () => 9
  expect(() => store.update()).not.toThrow()
  expect(storage.writes).toEqual([])
  expect(onError).toHaveBeenCalledTimes(1)
  store.data.score = 2
  store.update()
  expect(JSON.parse(storage.values.get('user')).state).toEqual({score: 2})
})

test('explicit hydration applies one partial patch without rewriting or deleting missing fields', () => {
  const storage = memoryStorage({user: JSON.stringify({version: 1, state: {score: 8, token: 'ignore', double: 99}})})
  const store = defineStore({state: {score: 1, name: 'A'}, getters: {double(state) { return state.score * 2 }}})
  const page = createPage()
  const listener = jest.fn()
  store.bind(page, '$user')
  store.on(listener)
  const controller = persistStore(store, {key: 'user', pick: ['score', 'name'], storage, autoHydrate: false})
  expect(storage.reads).toEqual([])
  expect(store.data.score).toBe(1)
  expect(controller.hydrate()).toBe(true)
  expect(listener).toHaveBeenCalledTimes(1)
  expect(page.data.$user).toEqual({score: 8, name: 'A', double: 16})
  expect(page.calls).toHaveLength(2)
  expect(storage.writes).toEqual([])
})

test('version migration validates and filters before applying; later writes use the new version', () => {
  const cached = JSON.stringify({version: 1, state: {points: 8}})
  const storage = memoryStorage({user: cached})
  const store = defineStore({state: {score: 1, name: 'A'}})
  const migrate = jest.fn((state, fromVersion) => {
    expect(fromVersion).toBe(1)
    return {score: state.points, token: 'ignore'}
  })
  persistStore(store, {key: 'user', pick: ['score'], storage, version: 2, migrate})
  expect(store.data).toEqual({score: 8, name: 'A'})
  expect(migrate).toHaveBeenCalledTimes(1)
  expect(storage.writes).toEqual([])
  expect(storage.values.get('user')).toBe(cached)
  store.patch({score: 9})
  expect(JSON.parse(storage.values.get('user'))).toEqual({version: 2, state: {score: 9}})
})

test('current-version caches do not call migrate', () => {
  const storage = memoryStorage({user: JSON.stringify({version: 2, state: {score: 8}})})
  const store = defineStore({state: {score: 1}})
  const migrate = jest.fn(() => ({score: 9}))
  persistStore(store, {key: 'user', pick: ['score'], storage, version: 2, migrate})
  expect(store.data.score).toBe(8)
  expect(migrate).not.toHaveBeenCalled()
})

test.each(['{', 'null', '[]', '{"state":{"score":8}}', '{"version":0,"state":{"score":8}}', '{"version":1,"state":[]}', '{"version":1,"state":{"score":8,"other":1e400}}', '{"version":9,"state":{"score":8}}'])('invalid caches leave state, page and storage unchanged: %s', cached => {
  const store = defineStore({state: {score: 1}})
  const page = createPage()
  store.bind(page, '$user')
  const storage = memoryStorage({user: cached})
  const onError = jest.fn()
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, autoHydrate: false, onError})
  expect(controller.hydrate()).toBe(false)
  expect(store.data.score).toBe(1)
  expect(page.calls).toHaveLength(1)
  expect(storage.values.get('user')).toBe(cached)
  expect(storage.writes).toEqual([])
  expect(onError).toHaveBeenCalledTimes(1)
})

test.each([
  () => { throw new Error('migration failed') },
  () => ({score: 8, invalid: undefined}),
  () => ({score: 8, invalid: new Date()}),
  () => ({score: 8, invalid() {}}),
  () => { const state = {score: 8}; state.circular = state; return state },
  () => [],
  () => Promise.resolve({score: 8}),
])('invalid migrations are atomic and release hydration suppression', migrate => {
  const cached = JSON.stringify({version: 1, state: {points: 8}})
  const storage = memoryStorage({user: cached})
  const store = defineStore({state: {score: 1}})
  const onError = jest.fn()
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, version: 2, migrate, onError, autoHydrate: false})
  expect(controller.hydrate()).toBe(false)
  expect(store.data.score).toBe(1)
  expect(storage.values.get('user')).toBe(cached)
  expect(storage.writes).toEqual([])
  expect(onError).toHaveBeenCalledTimes(1)
  store.patch({score: 3})
  expect(JSON.parse(storage.values.get('user'))).toEqual({version: 2, state: {score: 3}})
})

test('invalid unselected cached data is rejected before migrate can hide it', () => {
  const cached = '{"version":1,"state":{"points":8,"invalid":1e400}}'
  const storage = memoryStorage({user: cached})
  const store = defineStore({state: {score: 1}})
  const migrate = jest.fn(() => ({score: 8}))
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, version: 2, migrate, autoHydrate: false})
  expect(controller.hydrate()).toBe(false)
  expect(migrate).not.toHaveBeenCalled()
  expect(store.data.score).toBe(1)
})

test('hydrating during batch suppresses restored-state writes but not subsequent changes', () => {
  const storage = memoryStorage({user: JSON.stringify({version: 1, state: {score: 8}})})
  const store = defineStore({state: {score: 1}})
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, autoHydrate: false})
  store.batch(() => expect(controller.hydrate()).toBe(true))
  expect(storage.writes).toEqual([])
  store.batch(() => { controller.hydrate(); store.patch({score: 9}) })
  expect(storage.writes).toHaveLength(1)
  expect(JSON.parse(storage.values.get('user')).state).toEqual({score: 9})
})

test('hydrating during an on callback cannot be overwritten by the interrupted round', () => {
  const storage = memoryStorage({user: JSON.stringify({version: 1, state: {score: 8}})})
  const store = defineStore({state: {score: 1}})
  const controller = persistStore(store, {key: 'user', pick: ['score'], storage, autoHydrate: false})
  store.on(data => { if (data.score === 2) controller.hydrate() })
  store.patch({score: 2})
  expect(store.data.score).toBe(8)
  expect(storage.writes).toEqual([])
})

test('special own keys stay data when hydrated and saved', () => {
  const storage = memoryStorage({user: '{"version":1,"state":{"__proto__":{"polluted":true}}}'})
  const store = defineStore({state: {score: 1}})
  persistStore(store, {key: 'user', pick: ['__proto__'], storage})
  expect(Object.getPrototypeOf(store.data)).toBe(Object.prototype)
  expect({}.polluted).toBeUndefined()
  expect(Object.prototype.hasOwnProperty.call(store.data, '__proto__')).toBe(true)
  store.data.__proto__.polluted = false
  store.update()
  const saved = JSON.parse(storage.values.get('user'))
  expect(Object.prototype.hasOwnProperty.call(saved.state, '__proto__')).toBe(true)
  expect(saved.state.__proto__).toEqual({polluted: false})
})

test.each([{pick: new Array(1)}, {pick: ['score', 1]}, {migrate: true}, {onError: true}, {autoHydrate: 'false'}])('invalid option shapes do not read storage or subscribe: %p', patch => {
  const storage = memoryStorage()
  const store = defineStore({state: {score: 1}})
  expect(() => persistStore(store, Object.assign({key: 'user', pick: ['score'], storage}, patch))).toThrow(TypeError)
  store.patch({score: 2})
  expect(storage.reads).toEqual([])
  expect(storage.writes).toEqual([])
})
