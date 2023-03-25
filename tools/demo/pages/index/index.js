
const {default: userStore} = require('../../stores/user')


Page({
  data: {

  },
  onLoad() {
    userStore.bind(this, '$user')
  },
  onUnload() {
    userStore.unBing(this)
  },

  handleSetName() {
    const name = userStore.data.name.split('').reverse().join('')
    userStore.setName(name)
  },
  handleNavMine() {
    wx.navigateTo({url: '/pages/mine/mine'})
  }

})
