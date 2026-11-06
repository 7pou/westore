jest.mock('../tools/config', () => ({
  entry: ['index'], copy: [], srcPath: require('path').resolve('src'),
  distPath: require('path').resolve('miniprogram_dist'),
  demoSrc: require('path').resolve('tools/demo'), demoDist: require('path').resolve('miniprogram_dev'),
  js: {webpack: true}, wxss: {}, webpack: {output: {}}, isWatch: false,
}))
jest.mock('webpack', () => jest.fn())

const gulp = require('gulp')
const webpack = require('webpack')
const config = require('../tools/config')
const BuildTask = require('../tools/build')
let sequence = 0
let compile
let complete
let name
const stats = errors => ({hasErrors: () => errors, toString: () => errors ? 'compile failed' : 'compiled'})
const tick = () => new Promise(resolve => setImmediate(resolve))
const gulpErrors = jest.fn()

beforeAll(() => gulp.on('error', gulpErrors))
afterAll(() => gulp.removeListener('error', gulpErrors))

beforeEach(() => {
  config.isWatch = false
  webpack.mockImplementation(() => ({
    run(callback) { compile = callback },
    watch(options, callback) { compile = callback; return {close: jest.fn()} },
  }))
  name = 'test-' + sequence++
  const builder = new BuildTask(name, ['index'])
  builder.componentListMap = {jsFileList: ['index.ts'], jsFileMap: {index: 'index.ts'}}
  complete = jest.fn()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  gulp.series(name + '-component-js')(complete)
})

afterEach(() => { console.log.mockRestore() })

test('Gulp waits for successful compilation', async () => {
  await tick()
  expect(complete).not.toHaveBeenCalled()
  compile(null, stats(false))
  await tick()
  expect(complete).toHaveBeenCalledTimes(1)
  expect(complete.mock.calls[0][0]).toBeFalsy()
})

test('compiler errors fail the Gulp task', async () => {
  await tick()
  const error = new Error('compiler failure')
  compile(error)
  await tick()
  expect(complete.mock.calls[0][0]).toBeTruthy()
})

test('compilation stats errors fail the Gulp task', async () => {
  await tick()
  compile(null, stats(true))
  await tick()
  expect(complete.mock.calls[0][0]).toBeTruthy()
})

test('watch mode completes the Gulp task once, not on every rebuild', async () => {
  config.isWatch = true
  await tick()
  compile(null, stats(false))
  await tick()
  compile(null, stats(true))
  await tick()
  expect(complete).toHaveBeenCalledTimes(1)
})
