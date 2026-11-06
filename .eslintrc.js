module.exports = {
  'extends': [
    'airbnb-base',
    'plugin:promise/recommended'
  ],
  'parser': '@typescript-eslint/parser',
  'parserOptions': {
    'ecmaVersion': 9,
    'ecmaFeatures': {
      'jsx': false
    },
    'sourceType': 'module'
  },
  'env': {
    'es6': true,
    'node': true,
    'jest': true
  },
  'plugins': [
    '@typescript-eslint',
    'import',
    'node',
    'promise'
  ],
  'settings': {
    'import/resolver': {node: {extensions: ['.js', '.json', '.ts']}}
  },
  'overrides': [{
    files: ['*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {args: 'none'}],
      'import/extensions': ['error', 'ignorePackages', {ts: 'never'}]
    }
  }],
  'rules': {
    'arrow-parens': 'off',
    'comma-dangle': [
      'error',
      'only-multiline'
    ],
    'complexity': ['error', 20],
    'func-names': 'off',
    'global-require': 'off',
    'handle-callback-err': [
      'error',
      '^(err|error)$'
    ],
    'import/no-unresolved': [
      'error',
      {
        'caseSensitive': true,
        'commonjs': true,
        'ignore': ['^[^.]']
      }
    ],
    'import/prefer-default-export': 'off',
    'linebreak-style': 'off',
    'no-catch-shadow': 'error',
    'no-continue': 'off',
    'no-div-regex': 'warn',
    'no-else-return': 'off',
    'no-param-reassign': 'off',
    'no-plusplus': 'off',
    'no-shadow': 'off',
    'no-multi-assign': 'off',
    'no-underscore-dangle': 'off',
    'node/no-deprecated-api': 'error',
    'node/process-exit-as-throw': 'error',
    'object-curly-spacing': [
      'error',
      'never'
    ],
    'operator-linebreak': [
      'error',
      'after',
      {
        'overrides': {
          ':': 'before',
          '?': 'before'
        }
      }
    ],
    'prefer-arrow-callback': 'off',
    'prefer-destructuring': 'off',
    'prefer-template': 'off',
    'quote-props': [
      1,
      'as-needed',
      {
        'unnecessary': true
      }
    ],
    'semi': [
      'error',
      'never'
    ],
    'no-await-in-loop': 'off',
    'no-restricted-syntax': 'off',
    'promise/always-return': 'off',
  },
  'globals': {
    'window': true,
    'document': true,
    'App': true,
    'Page': true,
    'Component': true,
    'Behavior': true,
    'wx': true,
    'getCurrentPages': true,
  }
}
