import WeStore from '@7pound/westore'

class AppStore extends WeStore {
  data = {
    SDKVersion: '2.10.4',
    batteryLevel: 100,
    brand: 'devtools',
    language: 'zh_CN'
  }
}

const appStore = new AppStore()

export default appStore
