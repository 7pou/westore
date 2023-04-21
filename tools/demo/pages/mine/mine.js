import userStore from '../../stores/user'
import appStore from '../../stores/app'

Page({
  data: {

  },
  onLoad() {
    userStore.bind(this, '$user')
    appStore.bind(this, '$app')
  },
  onUnload() {
    userStore.unBind(this)
    appStore.unBind(this)
  },

  handleSetName() {
    const name = userStore.data.name.split('').reverse().join('')
    userStore.setName(name)
  },
  handleSetVersion() {
    appStore.data.SDKVersion = 2.10 + '.' + Date.now().toString().slice(-2)
    appStore.update()
  },
  handleNavHome() {
    wx.navigateBack()
  }
})
