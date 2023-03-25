
const {default: userStore} = require('../../stores/user')

Component({
  lifetimes: {
    ready() {
      userStore.bind(this, '$user')
    },
    detached() {
      userStore.unBind(this)
    }
  },
  methods: {
    handleGetScore() {
      wx.showLoading({title: '加载中'})
      userStore.getUserScore().then(() => {
        wx.hideLoading()
      }).catch(() => {})
    }

  }
})
