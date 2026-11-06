const path = require('path')
const typescript = require('typescript')

const options = {
  strict: true,
  noEmit: true,
  types: [],
  target: typescript.ScriptTarget.ES2015,
  moduleResolution: typescript.ModuleResolutionKind.NodeJs,
  module: typescript.ModuleKind.CommonJS,
}

function diagnostics(filename) {
  const program = typescript.createProgram([path.resolve(__dirname, '../test/types', filename)], options)
  return typescript.getPreEmitDiagnostics(program)
}

const valid = diagnostics('valid.ts')
const invalid = diagnostics('invalid.ts')
const expected = [2322, 2322, 2322, 2322, 2322, 2322, 2322, 2322, 2322, 2345, 2345, 2345, 2540, 2542, 2554, 2554]
const actual = invalid.map(issue => issue.code).sort((left, right) => left - right)
if (valid.length || JSON.stringify(expected) !== JSON.stringify(actual)) {
  const host = {getCanonicalFileName: filename => filename, getCurrentDirectory: () => process.cwd(), getNewLine: () => '\n'}
  console.error(typescript.formatDiagnostics(valid.concat(invalid), host))
  console.error('Expected negative diagnostics:', expected, 'received:', actual)
  process.exitCode = 1
} else {
  console.log('Type consumers passed: valid entrypoint, expected negative diagnostics', expected.join(', '))
}
