# westore

微信小程序的轻量状态管理库。零运行时依赖，支持 class / `defineStore`、计算属性、多 Store 绑定、差量同步、批处理、精确监听、Action 生命周期钩子和可选持久化，附带 TypeScript 声明。

## 安装

```sh
npm install --save @7pound/westore
```

在微信开发者工具中选择「工具 → 构建 npm」。本仓库新增能力尚未自动发布，请以实际安装版本为准。

## 快速入门

```js
import {defineStore} from '@7pound/westore'

export const userStore = defineStore({
  state: {name: 'xigua', score: 0, level: 1},
  getters: {
    greeting(state) {
      return state.name + ': ' + state.score
    }
  },
  actions: {
    setName(name) {
      this.patch({name})
    },
    levelUp() {
      this.batch(() => {
        this.patch({score: this.data.score + 10})
        this.data.level++
      })
    }
  }
})
```

```js
import {userStore} from '../../stores/user'

Page({
  data: {lastScore: 0},
  onLoad() {
    userStore.bind(this, '$user', {pick: ['name', 'score', 'greeting']})
    this.stopScore = userStore.watch(data => data.score, value => {
      this.setData({lastScore: value})
    }, {immediate: true})
  },
  onUnload() {
    userStore.unBind(this)
    this.stopScore()
  },
  handleLevelUp() {
    userStore.levelUp()
  },
  handleReset() {
    userStore.reset()
  }
})
```

```html
<view>{{ $user.greeting }}</view>
<button bindtap="handleLevelUp">升级</button>
<button bindtap="handleReset">重置</button>
```

组件在 `lifetimes.ready` 中绑定，在 `lifetimes.detached` 中 `unBind` 并取消 watch。多个 Store 可绑定同一页面的不同命名空间。

## class 用法

```js
import WeStore from '@7pound/westore'

class UserStore extends WeStore {
  constructor() {
    super()
    this.data = {
      score: 0,
      double(state) { return state.score * 2 }
    }
    this.initialize()
    this.registerActions({increment: this.increment})
  }

  increment() {
    this.data.score++
    this.update()
  }
}

export default new UserStore()
```

`defineStore` 自动记录初始值。class 在首次公共操作时懒初始化；需要恢复构造后的值时，务必在第一次直接修改 `data` **之前**调用 `initialize()` 或完成绑定。

## 核心 API

| API | 行为 |
| --- | --- |
| `data` + `update()` | 保留直接修改再同步的用法；首次绑定全量，后续仅发送变化路径 |
| `patch(partial)` | 顶层浅合并、克隆输入并同步；不能覆盖 getter，不解释点路径 |
| `batch(callback)` | 同步嵌套批处理；最外层退出时更新一次并返回回调结果 |
| `watch(selector, callback, options?)` | 仅选中值结构变化时通知；返回幂等取消函数，支持 `immediate` |
| `bind(instance, name, {pick}?)` | 可选择顶层字段和 getter；省略 pick 选全部，空数组选空对象 |
| `unBind(instance)` | 释放该目标的绑定和比较快照，不清除页面已有数据 |
| `initialize()` / `reset()` | 幂等捕获初始状态 / 恢复状态并更新，保留监听与 action |
| `on(fn)` / `off(fn)` | 每轮显式更新通知 / 取消监听；无变化也通知，区别于 watch |
| `logger` | 更新通知结束后调用；可设为函数或 null |
| `registerActions(actions)` | 显式安装可观察且绑定所属 Store 的 action；defineStore 自动注册 |
| `onAction(hook, options?)` | 观察调用开始、成功或失败；返回幂等取消函数 |

**边界：** `batch` 不是事务，不回滚、不接受 async/Promise/thenable。回调抛错仍尝试同步并保留原异常；不能取消已经启动的异步工作。异步 action 应先 `await`，再调用同步 `patch` / `batch`。`actions` 使用普通方法，不要用依赖 `this` 的箭头函数；注册后的普通 action 解构调用仍绑定所属 Store，但注册不能修复箭头函数的词法 this。action 本身不会自动触发更新。

视图值支持 null、布尔、字符串、有限数值、普通对象和稠密数组；拒绝 undefined、循环引用、Date/Map/Set、嵌套函数等。顶层函数表示 getter。新增 API 名与 action 冲突会显式报错；数据校验收紧也属于迁移约束。

详见 [API 文档](https://github.com/7pou/westore/blob/master/docs/api.md) 与 [迁移说明](https://github.com/7pou/westore/blob/master/docs/migration.md)（本地开发时查看 `docs/` 中对应文件）。

## 可选持久化

从独立子入口导入，核心不会自动保存状态，也不会在导入时访问全局 `wx`。

```js
import {persistStore, createWxStorageAdapter} from '@7pound/westore/persistence'
import {userStore} from './stores/user'

const persistence = persistStore(userStore, {
  key: 'user-progress',
  pick: ['score', 'level'],
  storage: createWxStorageAdapter(wx),
  version: 2,
  migrate(state, fromVersion) {
    if (fromVersion === 1 && typeof state.points === 'number') {
      return {score: state.points, level: 1}
    }
    throw new Error('Unsupported saved version')
  },
  onError(error) { console.warn('Persistence failed', error) }
})
```

默认同步恢复后才开始监听；设置 `autoHydrate: false` 可延后调用 `persistence.hydrate()`，返回是否成功。必填 `pick` 只选顶层原始字段，不能选 getter；空数组不保存业务字段。选中值变化才写入，`batch` 只保存一次最终值。版本相同时不调用 migrate；迁移不支持 Promise。

`clear()` 只删缓存，不重置 Store；`reset()` 改状态，监听未停止时可能再次写入。`stop()` 幂等停止自动写入，之后仍可显式 hydrate/clear。控制器应由 Store 所有者创建一次：页面私有 Store 在 onUnload、组件私有 Store 在 detached 调用 stop；应用共享 Store 不要随某一页面退出停用。退出登录若需同时清理，应先 stop，再 clear/reset。

同步 Storage、克隆和 JSON 处理占用主线程，避免高频保存大对象。本功能不加密，不建议持久化 token、密码等敏感数据。读取、格式、迁移或写入错误交给 onError，不清除原缓存；普通 Store 更新不因存储错误失败。不同控制器使用相同 key 的覆盖由应用负责。

## Action 生命周期

`defineStore({actions})` 自动注册；class 只观察显式 `registerActions({increment: this.increment})` 的方法，不扫描所有方法。

```js
const stopObserving = userStore.onAction(({name, args, after, onError}) => {
  const started = Date.now()
  console.log('Action started', name, args)
  after(result => {
    console.log('Action completed', name, Date.now() - started, result)
  })
  onError(error => {
    console.warn('Action failed', name, error)
  })
}, {onHookError(error) { console.warn('Observer failed', error) }})
```

在拥有这份订阅的页面 `onUnload` 或组件 `detached` 中调用 `stopObserving()`。取消仅影响未来调用，不取消正在执行的 action，也不取消它已经登记的完成回调。

同步 action 仍同步返回或抛错；Promise/thenable action 在完成后通知，返回保留原结果/原拒因的 Promise，不保证 Promise 引用不变。同名并发与嵌套调用独立跟踪。钩子、after、onError、onHookError 使用同步回调，不要传 async 函数；它们同步抛出的错误不会替换业务结果。args 是冻结的浅副本，参数对象仍是原引用，观察者不可修改它们。钩子不能替换参数/返回值，不是拦截器或自动更新机制。

## 开发与 Demo

```sh
npm install
npm test -- --runInBand
npm run lint
npm run typecheck
npm run build
npm run test:types
npm run test:package
npm pack --dry-run --ignore-scripts
npm run dev
```

微信开发者工具导入 `miniprogram_dev`。首页展示 patch、batch、watch、pick、reset，退出页面会清理订阅；`npm run coverage` 运行源码覆盖率检查。正式构建输出 `miniprogram_dist` 中的 CommonJS 与 `.d.ts`，不需要 OpenSSL legacy 环境变量。发布前必须先 build 和验证产物，`npm pack --dry-run` 不会替你构建。

VS Code 中请选择「使用工作区版本」的 TypeScript（当前锁定 3.9.10），与构建保持一致；仓库的工作区设置会提示选择。本项目显式启用 `strictNullChecks`。编辑器内置 TS 6 对旧 `moduleResolution` / `baseUrl` 有配置弃用提示，不要为消除提示直接写入 TS 3.9 不支持的 `ignoreDeprecations` 或更换构建模块解析方式。

当前实现核心能力 M1、可选持久化 M2 与 Action 钩子 M3；Demo 未默认开启持久化。微信开发者工具及真机的重启恢复、版本升级、生命周期清理和异步 action 观察需要另行实测。基于[小程序 npm 模板](https://github.com/wechat-miniprogram/miniprogram-custom-component.git)，架构参考 [Tencent/westore](https://github.com/Tencent/westore)。
