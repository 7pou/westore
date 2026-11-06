const gulp = require('gulp')
const clean = require('gulp-clean')
const {spawn} = require('child_process')

const config = require('./tools/config')
const BuildTask = require('./tools/build')
const id = require('./package.json').name || 'miniprogram-custom-component'

// 构建任务实例
// eslint-disable-next-line no-new
new BuildTask(id, config.entry)

function compileTypes(argumentsList) {
  return new Promise((resolve, reject) => {
    const compiler = spawn(process.execPath, [require.resolve('typescript/bin/tsc')].concat(argumentsList), {stdio: 'inherit'})
    compiler.once('error', reject)
    compiler.once('exit', code => {
      if (code === 0) resolve()
      else reject(new Error('TypeScript failed with exit code ' + code))
    })
  })
}

gulp.task('typecheck', () => compileTypes(['--noEmit']))
gulp.task('declarations', () => compileTypes(['-p', 'tsconfig.build.json']))

// 清空生成目录和文件
gulp.task('clean', gulp.series(() => gulp.src(config.distPath, {read: false, allowEmpty: true}).pipe(clean()), done => {
  if (config.isDev) {
    return gulp.src(config.demoDist, {read: false, allowEmpty: true})
      .pipe(clean())
  }

  return done()
}))
// 监听文件变化并进行开发模式构建
gulp.task('watch', gulp.series(`${id}-watch`))
// 开发模式构建
gulp.task('dev', gulp.series(`${id}-dev`))
// 生产模式构建
gulp.task('default', gulp.series('typecheck', `${id}-default`, 'declarations'))
