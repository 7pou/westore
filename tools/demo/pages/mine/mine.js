/*
 * @Author: zhao - 🍉
 * @Date: 2022-03-16 00:59:39
 * @LastEditTime: 2023-03-25 17:50:26
 * @LastEditors: zhao - 🍉
 * @Description:
 * @FilePath: /westore/tools/demo/pages/mine/mine.js
 */
const {default: userStore} = require('../../stores/user')
const {default: appStore} = require('../../stores/app')

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
