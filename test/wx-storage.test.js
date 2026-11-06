const {createWxStorageAdapter} = require('../src/persistence')

test('wx adapter preserves method receivers and forwards keys and string values', () => {
  const calls = []
  const api = {
    getStorageSync(key) { expect(this).toBe(api); calls.push(['get', key]); return '{"score":8}' },
    setStorageSync(key, value) { expect(this).toBe(api); calls.push(['set', key, value]) },
    removeStorageSync(key) { expect(this).toBe(api); calls.push(['remove', key]) },
  }
  const adapter = createWxStorageAdapter(api)
  expect(adapter.getItem('user')).toBe('{"score":8}')
  adapter.setItem('user', 'serialized')
  adapter.removeItem('user')
  expect(calls).toEqual([['get', 'user'], ['set', 'user', 'serialized'], ['remove', 'user']])
})

test.each(['', {}, 0, false, null, undefined])('empty strings are missing; other non-string values are rejected: %p', value => {
  const adapter = createWxStorageAdapter({getStorageSync() { return value }, setStorageSync() {}, removeStorageSync() {}})
  if (value === '') expect(adapter.getItem('user')).toBeNull()
  else expect(() => adapter.getItem('user')).toThrow(TypeError)
})

test('wx adapter propagates native failures to the persistence controller', () => {
  const error = new Error('wx storage')
  const fail = () => { throw error }
  const adapter = createWxStorageAdapter({getStorageSync: fail, setStorageSync: fail, removeStorageSync: fail})
  expect(() => adapter.getItem('user')).toThrow(error)
  expect(() => adapter.setItem('user', 'value')).toThrow(error)
  expect(() => adapter.removeItem('user')).toThrow(error)
})

test('requires an explicit complete API rather than reading global wx', () => {
  expect(global.wx).toBeUndefined()
  expect(() => createWxStorageAdapter()).toThrow(TypeError)
  expect(() => createWxStorageAdapter({getStorageSync() { return '' }})).toThrow(TypeError)
})
