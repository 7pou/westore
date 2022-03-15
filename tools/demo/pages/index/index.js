/*
 * @Author: zhao - 🍉
 * @Date: 2020-06-16 21:36:10
 * @LastEditTime: 2022-03-16 01:10:20
 * @LastEditors: zhao - 🍉
 * @Description:
 * @FilePath: /miniprogram-grid-luckdraw/tools/demo/pages/index/index.js
 */
Page({
  data: {
    prizeList: []
  },
  onLoad() {
    this.postPrizeList().then(prizeList => {
      this.setData({prizeList})
    }).catch((err) => {
      console.log(err)
    })
  },
  postPrizeList() {
    const prizeList = [
      {id: 1, name: '奖品-1', src: '/assets/prize-1.png'},
      {id: 2, name: '奖品-2', src: '/assets/prize-1.png'},
      {id: 3, name: '奖品-3', src: '/assets/prize-1.png'},
      {id: 4, name: '奖品-4', src: '/assets/prize-1.png'},
      {id: 5, name: '奖品-5', src: '/assets/prize-1.png'},
      {id: 6, name: '奖品-6', src: '/assets/prize-1.png'},
      {id: 7, name: '奖品-7', src: '/assets/prize-1.png'},
      {id: 8, name: '奖品-8', src: '/assets/prize-1.png'},
    ]
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(prizeList)
      }, 1000)
    })
  },
  postLottery() {
    return new Promise((resolve) => {
      const randomId = Math.ceil(Math.random() * 8)
      const res = {id: randomId}
      setTimeout(() => {
        resolve(res)
      }, 1000)
    })
  },
  handleLottery() {
    this.postLottery().then(res => this.selectComponent('#GridLuckdrawRef').setup(res)).then((res) => {
      wx.showModal({
        title: '提示',
        content: '恭喜您抽中' + res.id,
      })
    }).catch(() => {

    })
  },
  handleNavCustomPage() {
    wx.navigateTo({
      url: '/pages/custom/custom'
    })
  }
})
