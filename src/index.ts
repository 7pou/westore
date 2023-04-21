type IInstance = {
  data: AnyObject
  setData: (data) => void
}
const parseData = (store: WeStore) => {
  const data: AnyObject = {}
  if (Array.isArray(store.data)) return store.data
  if (typeof store.data !== 'object') return store.data
  Object.keys(store.data).forEach(key => {
    const v = store.data[key]
    data[key] = typeof v === 'function' ? v.call(store, store.data) : v
  })
  return data
}

class WeStore {
  data: AnyObject

  pages: Map<IInstance, string>

  listeners: Array<(data)=>void>

  constructor() {
    this.data = {}
    this.pages = new Map()
    this.listeners = []
  }

  bind(instance: IInstance, name: string) {
    if (!name) throw new Error('name is undefined')
    if (this.pages.has(instance) === false) {
      this.pages.set(instance, name)
      instance.setData({[name]: parseData(this)})
    }
  }

  unBind(instance: IInstance) {
    this.pages.delete(instance)
  }

  on(fn: ()=> void) {
    if (this.listeners.find(e => e === fn)) return
    this.listeners.push(fn)
  }

  off(fn: () => void) {
    const index = this.listeners.findIndex(e => e === fn)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }

  update() {
    const data = parseData(this)
    this.pages.forEach((value, instance) => {
      instance.setData({[value]: data})
    })
    this.listeners.forEach(fn => {
      if (typeof fn === 'function') fn(data)
    })
  }
}


const defineStore = (options) => {
  const store = new WeStore()
  store.data = options.state || options.data || {}
  Object.keys(options.getters).forEach(key => {
    store.data[key] = options.getters[key]
  })
  Object.keys(options.actions).forEach(key => {
    store[key] = options.actions[key]
  })
  return store
}


export {defineStore}
export default WeStore
