import {defineStore} from '../..'
import {persistStore, StorageAdapter} from '../../persistence'

const store = defineStore({state: {score: 1}, actions: {increment() { this.data.score++ }}})
store.increment('unexpected')
store.data.score = 'wrong'
store.patch({score: 'wrong'})
const computed = defineStore({state: {score: 1}, getters: {double(state) { return state.score * 2 }}})
computed.patch({double: 3})
computed.bind({data: {}, setData() {}}, '$store', {pick: ['missing']})
computed.watch(data => { data.score = 2; return data.score }, () => {})
computed.watch(() => null as unknown, value => { const score: number = value; void score })
const usingThis = defineStore({state: {score: 1}, getters: {double() { return this.data.score * 2 }}})
usingThis.on(data => { const wrong: string = data.double; void wrong })
const storage: StorageAdapter = {getItem() { return null }, setItem() {}, removeItem() {}}
persistStore(computed, {key: 'score', pick: ['double'], storage})
const asyncStorage: StorageAdapter = {getItem() { return Promise.resolve('value') }, setItem() {}, removeItem() {}}
void asyncStorage
const observed = defineStore({state: {score: 1}, actions: {add(amount: number) { return this.data.score + amount }}})
observed.add()
observed.add('wrong')
observed.onAction(({args}) => { args[0] = 1 })
observed.registerActions({invalid: 7})
const thenableActions = defineStore({actions: {load(amount: number) { return {then(resolve: (value: number) => void) { resolve(amount) }} }}})
thenableActions.load('wrong')
const wrongThenable: Promise<string> = thenableActions.load(7)
void wrongThenable
