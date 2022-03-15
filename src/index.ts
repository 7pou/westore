/*
 * @Author: zhao - 🍉
 * @Date: 2020-03-15 22:48:39
 * @LastEditTime: 2022-03-16 02:21:45
 * @LastEditors: zhao - 🍉
 * @Description:
 * @FilePath: /miniprogram-grid-luckdraw/src/index.ts
 */

const grid = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
]
Component({
  properties: {
    list: {type: Array, value: []},
    gridItemGap: {type: Number, value: 10, observer() { this.parseGridStyle() }},
    gridItemWidth: {type: Number, value: 140, observer() { this.parseGridStyle() }},
    gridItemHeight: {type: Number, value: 130, observer() { this.parseGridStyle() }},
    animated: {type: Boolean, value: false}, // 加载动画 (暂不支持)
    speed: {type: Number, value: 100}, // 运行速度(speed 秒/次)
    minRunCount: {type: Number, value: 30}, // 最小运行次数
    diminishingCount: {type: Number, value: 25}, // 开始减速的时机 (当运行多少次后开始减速)
    deceleration: {type: Number, value: 60}, // 每次运行增大间隔时间 (秒/次)
    uniqueKey: {type: String, value: 'id'}, // 唯一key
    imageSrcKey: {type: String, value: 'src'}, // 奖品图片字段名
    activeStyle: {type: String, value: 'background-color: rgba(255, 249, 70, 0.7);border-radius: 20rpx;'} // 当前选中的样式
  },
  data: {
    created: false,
    currentLuckIndex: null,
    gridStyleList: [],
    gridStyleSlot: ''
  },
  ready() {
    this.parseGridStyle()
  },
  methods: {
    setup<T>(res: T): Promise<T> {
      return this.run(res).then(() => res)
    },
    run<T>(res:T, count = 0, rootResolve, initSpeed) {
      // 运行中不允许再次调用
      if (this.running === true && count === 0) return Promise.reject(new Error('running..'))

      this.running = true


      return new Promise((resolve) => {
        rootResolve = rootResolve || resolve
        const {
          speed, minRunCount, list,
          diminishingCount, uniqueKey, currentLuckIndex,
          deceleration
        } = this.data
        initSpeed = initSpeed || speed // 初始运行速度间隔

        const currentLucky = list[currentLuckIndex] // 当前选中的奖项

        if (count >= minRunCount && currentLucky && currentLucky[uniqueKey] === res[uniqueKey]) {
          this.running = false
          return rootResolve(currentLucky)
        }

        // 当运行到需要减速的次数时, 并且运行间隔小于1000ms 时,增大运行间隔
        if (count >= diminishingCount && initSpeed < 1000) {
          initSpeed += (count - diminishingCount) * deceleration
        }


        this.setData({currentLuckIndex: count % list.length})
        console.log(initSpeed)
        setTimeout(() => {
          this.run(res, count + 1, rootResolve, initSpeed)
        }, initSpeed)
        return null
      })
    },
    parseGridStyle() {
      const gridStyleList = []
      const {gridItemHeight, gridItemWidth, gridItemGap} = this.data
      const styles = [
        `width: ${gridItemWidth}rpx`,
        `height: ${gridItemHeight}rpx`,
        `top: ${gridItemHeight + gridItemGap + gridItemGap}rpx`,
        `left: ${gridItemWidth + gridItemGap + gridItemGap}rpx`,
      ]
      this.setData({gridStyleSlot: styles.join(';')})
      for (let i = 0; i < grid.length; i++) {
        const x = grid[i][0]
        const y = grid[i][1]
        const trans = `transform: translate(${(gridItemWidth + gridItemGap) * x}rpx, ${(gridItemHeight + gridItemGap) * y}rpx);`

        gridStyleList.push([...styles, trans].join(';'))
      }
      this.setData({gridStyleList})
    }
  }

})
