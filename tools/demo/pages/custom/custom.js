/*
 * @Author: zhao - 🍉
 * @Date: 2020-06-16 21:36:10
 * @LastEditTime: 2022-03-16 02:02:02
 * @LastEditors: zhao - 🍉
 * @Description:
 * @FilePath: /miniprogram-grid-luckdraw/tools/demo/pages/custom/custom.js
 */
Page({
  data: {
    prizeList: [],

    gridItemGap: 10, // 奖品布局间隙
    gridItemWidth: 140,
    gridItemHeight: 130,
    speed: 100, // 运行速度(speed 秒/次)
    minRunCount: 30, // 最小运行次数
    diminishingCount: 25, // 开始减速的时机 (当运行多少次后开始减速)
    deceleration: 60, // 每次运行增大间隔时间 (秒/次)
    uniqueKey: 'id', // 唯一key
    imageSrcKey: 'prizeImageSrc' // 奖品图片字段名
  },
  onLoad() {
    this.postPrizeList().then(prizeList => {
      this.setData({prizeList})
    }).catch(() => {

    })
  },
  postPrizeList() {
    const prizeList = [
      {id: 1, prizeImageSrc: '/assets/prize-1.png'},
      {id: 2, prizeImageSrc: '/assets/prize-1.png'},
      {id: 3, prizeImageSrc: '/assets/prize-1.png'},
      {id: 4, prizeImageSrc: '/assets/prize-1.png'},
      {id: 5, prizeImageSrc: '/assets/prize-1.png'},
      {id: 6, prizeImageSrc: '/assets/prize-1.png'},
      {id: 7, prizeImageSrc: '/assets/prize-1.png'},
      {id: 8, prizeImageSrc: '/assets/prize-1.png'},
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
  }
})
