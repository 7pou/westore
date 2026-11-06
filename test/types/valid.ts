import WeStore, {defineStore} from '../..'
import {persistStore, createWxStorageAdapter, StorageAdapter, PersistenceController} from '../../persistence'

const store = defineStore({
  state: {score: 1},
  getters: {double(state) { return state.score * 2 }},
  actions: {increment() { this.data.score++; this.update() }},
})
store.increment()
store.on(data => { const score: number = data.double; void score })
const basic = new WeStore<{name: string}>()
basic.data = {name: 'typed'}
store.initialize()
store.patch({score: 2})
const result: number = store.batch(() => { store.patch({score: 3}); return 7 })
void result
store.reset()
const page = {data: {}, setData(data: object) { void data }}
store.bind(page, '$store', {pick: ['score', 'double']})
const stop = store.watch(data => data.double, (value, previous) => {
  const current: number = value
  const prior: number | undefined = previous
  void current
  void prior
}, {immediate: true})
stop()
const usingThis = defineStore({
  state: {score: 1},
  getters: {double() { return this.data.score * 2 }},
  actions: {inc() { this.data.score++ }},
})
usingThis.inc()
usingThis.bind(page, '$this', {pick: ['double']})
usingThis.on(data => { const doubled: number = data.double; void doubled })
usingThis.watch(data => data.double, value => { const doubled: number = value; void doubled })
const storage: StorageAdapter = {
  getItem(key) { void key; return null },
  setItem(key, value) { void key; void value },
  removeItem(key) { void key },
}
const persistence: PersistenceController = persistStore(store, {
  key: 'score', pick: ['score'], storage, version: 2, autoHydrate: false,
  migrate(state, fromVersion) { return {score: fromVersion === 1 ? Number(state.points) : Number(state.score)} },
  onError(error) { const received: unknown = error; void received },
})
const hydrated: boolean = persistence.hydrate()
void hydrated
persistence.clear()
persistence.stop()
const wxStorage = createWxStorageAdapter({
  getStorageSync(key) { void key; return '' as unknown },
  setStorageSync(key, value) { void key; void value },
  removeStorageSync(key) { void key },
})
persistStore(store, {key: 'wx-score', pick: ['score'], storage: wxStorage})
const observed = defineStore({
  state: {score: 1},
  actions: {
    sum(left: number, right: number) { return this.data.score + left + right },
    async load(amount: number) { return this.data.score + amount },
  },
})
const sum: number = observed.sum(2, 3)
const loaded: Promise<number> = observed.load(4)
void sum
void loaded
const stopAction = observed.onAction(context => {
  const score: number = context.store.data.score
  const total: number = context.store.sum(1, 2)
  const args: readonly any[] = context.args
  context.after(result => { void result })
  context.onError(error => { const failure: unknown = error; void failure })
  void score
  void total
  void args
}, {onHookError(error) { const failure: unknown = error; void failure }})
stopAction()
class ScoreStore extends WeStore<{score: number}> {
  constructor() {
    super()
    this.data = {score: 1}
    this.registerActions({increment: this.increment})
  }
  increment(amount: number) { this.data.score += amount; return this.data.score }
}
const classStore = new ScoreStore()
const {increment} = classStore
const classResult: number = increment(2)
void classResult
classStore.onAction(({store}) => { const score: number = store.data.score; void score })
classStore.registerActions({dynamic(amount: number) { this.data.score += amount }})
const thenableActions = defineStore({actions: {
  load(amount: number) { return {then(resolve: (value: number) => void) { resolve(amount) }} },
  nested() { return {then(resolve: (value: Promise<number>) => void) { resolve(Promise.resolve(7)) }} },
  generic<Value>(value: Value) { return value },
  async genericAsync<Value>(value: Value) { return value },
  maybe(flag: boolean) { return flag ? 1 : {then(resolve: (value: number) => void) { resolve(7) }} },
  recover(this: {load(amount: number): Promise<number>}): Promise<number> { return this.load(7).catch(() => 0) },
  chained(): number { return this.generic(7) + 1 },
}})
const fromThenable: Promise<number> = thenableActions.load(7)
const caughtThenable: Promise<number> = thenableActions.load(7).catch(() => 0)
const nestedThenable: Promise<number> = thenableActions.nested()
const preservedGeneric: string = thenableActions.generic('value')
const preservedAsyncGeneric: Promise<string> = thenableActions.genericAsync('value')
const maybeThenable: number | Promise<number> = thenableActions.maybe(true)
const recoveredThenable: Promise<number> = thenableActions.recover()
const chainedAction: number = thenableActions.chained()
void fromThenable
void caughtThenable
void nestedThenable
void preservedGeneric
void preservedAsyncGeneric
void maybeThenable
void recoveredThenable
void chainedAction
