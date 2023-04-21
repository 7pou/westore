import abilityStore from '../../stores/ability'
import userStore from '../../stores/user'

Page({
  data: {

  },
  onLoad() {
    userStore.bind(this, '$user')
    abilityStore.bind(this, '$ability')
  },
  onUnload() {
    userStore.unBing(this)
    abilityStore.bind(this)
  },

  handleSetName() {
    const name = userStore.data.name.split('').reverse().join('')
    userStore.setName(name)
  },
  handleNavMine() {
    wx.navigateTo({url: '/pages/mine/mine'})
  }

})
