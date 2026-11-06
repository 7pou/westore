import abilityStore from '../../stores/ability'
import userStore from '../../stores/user'

Page({
  data: {
    observedLevel: 1
  },
  onLoad() {
    userStore.bind(this, '$user')
    abilityStore.bind(this, '$ability', {pick: ['kun', 'put']})
    this.stopAbilityWatch = abilityStore.watch(data => data.kun.level, level => {
      this.setData({observedLevel: level})
    }, {immediate: true})
  },
  onUnload() {
    userStore.unBind(this)
    abilityStore.unBind(this)
    this.stopAbilityWatch()
  },

  handleSetName() {
    const name = userStore.data.name.split('').reverse().join('')
    userStore.setName(name)
  },
  handleNavMine() {
    wx.navigateTo({url: '/pages/mine/mine'})
  },
  handleLevelUp() {
    abilityStore.levelUp()
  },
  handleResetAbility() {
    abilityStore.reset()
  }

})
