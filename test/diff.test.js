const {diffView} = require('../src/snapshot')

test('diff emits changed leaves and omits equal values', () => {
  expect(diffView({score: 1, profile: {score: 1}}, {score: 2, profile: {score: 2}}, '$user'))
    .toEqual({'$user.score': 2, '$user.profile.score': 2})
  expect(diffView({profile: {score: 1}}, {profile: {score: 1}}, '$user')).toEqual({})
})

test('deleted keys replace the nearest parent without overlapping child paths', () => {
  expect(diffView({profile: {score: 1, age: 2}}, {profile: {score: 3}}, '$user'))
    .toEqual({'$user.profile': {score: 3}})
  expect(diffView({score: 1, age: 2}, {score: 3}, '$user')).toEqual({$user: {score: 3}})
})

test('array length and node type changes replace nodes; equal-length arrays diff elements', () => {
  expect(diffView({list: [1, 2]}, {list: [1]}, '$user')).toEqual({'$user.list': [1]})
  expect(diffView({list: [1, 2]}, {list: [1, 3]}, '$user')).toEqual({'$user.list[1]': 3})
  expect(diffView({value: {}}, {value: []}, '$user')).toEqual({'$user.value': []})
  expect(diffView({value: []}, {value: null}, '$user')).toEqual({'$user.value': null})
})

test.each(['a.b', 'a[0]', '', '__proto__', 'constructor'])('unsafe key %s falls back to a safe parent', key => {
  const previous = {[key]: 1, score: 1}
  const next = {[key]: 2, score: 2}
  expect(diffView(previous, next, '$user')).toEqual({$user: next})
  expect(diffView({profile: previous}, {profile: next}, '$user')).toEqual({'$user.profile': next})
})

test('unchanged unsafe keys do not prevent safe leaf updates', () => {
  expect(diffView({'a.b': 1, score: 1}, {'a.b': 1, score: 2}, '$user')).toEqual({'$user.score': 2})
})
