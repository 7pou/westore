type IInstance = {
  data: AnyObject
  setData: (data) => void
}
const parseData = (store: WeStore) => {
  const data: AnyObject = {}
  Object.keys(store.data).forEach(key => {
    const v = store.data[key]
    data[key] = typeof v === 'function' ? v.apply(store) : v
  })
  return data
}

class WeStore {
  data: AnyObject

  pages: Map<IInstance, string>

  constructor() {
    this.data = {}
    this.pages = new Map()
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

  update() {
    const data = parseData(this)
    this.pages.forEach((value, instance) => {
      instance.setData({[value]: data})
    })
  }
}
export default WeStore
