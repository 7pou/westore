export type StateRecord = Record<string, any>
export type WritableState<State> = Pick<State, {
  [Key in keyof State]: State[Key] extends (...args: any[]) => any ? never : Key
}[keyof State]>
export type ResolvedData<State> = {
  [Key in keyof State]: State[Key] extends (...args: any[]) => infer Result ? Result : State[Key]
}
export type Instance = {data: StateRecord; setData(data: StateRecord): void}
export type Unsubscribe = () => void
export type WatchOptions = {immediate?: boolean}
export type BindOptions<State> = {pick?: ReadonlyArray<Extract<keyof State, string>>}
export type GetterMap<State> = Record<string, (state: State) => any>
export type ActionMap = Record<string, (...args: any[]) => any>
type ThenableResult = {then: (...args: any[]) => any}
type FulfillmentValue<Callback> =
  Callback extends (value: infer Value, ...args: any[]) => any ? Value : never
type ActionValue<Result> = {
  direct: Exclude<Result, ThenableResult>
  thenable: Result extends {
    then(onfulfilled: infer Callback, ...args: any[]): any
  } ? ActionValue<FulfillmentValue<Callback>> : never
}[0 extends (1 & Result) ? 'direct' : Result extends ThenableResult ? 'thenable' : 'direct']
type ActionResult<Result> = Result extends ThenableResult ? Promise<ActionValue<Result>> : Result
type RegisteredAction<Action extends (...args: any[]) => any> =
  ReturnType<Action> extends Promise<any>
  ? Action : [Extract<ReturnType<Action>, ThenableResult>] extends [never] ? Action
  : (...args: Parameters<Action>) => ActionResult<ReturnType<Action>>
export type RegisteredActions<Actions> = {
  [Key in keyof Actions]: Actions[Key] extends (...args: any[]) => any
    ? RegisteredAction<Actions[Key]> : never
}
export interface ActionContext<Store> {
  name: string
  args: readonly any[]
  store: Store
  after(callback: (result: any) => void): void
  onError(callback: (error: unknown) => void): void
}
export type ActionHook<Store> = (context: ActionContext<Store>) => void
export type ActionHookOptions = {onHookError?: (error: unknown) => void}
