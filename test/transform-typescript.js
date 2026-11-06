const typescript = require('typescript')

module.exports = {
  process(source, filename) {
    return typescript.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: typescript.ModuleKind.CommonJS,
        target: typescript.ScriptTarget.ES2015,
        inlineSourceMap: true,
        inlineSources: true,
      },
    }).outputText
  },
}
