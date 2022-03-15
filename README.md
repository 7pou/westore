
# miniprogram-grid-luckdraw

# 小程序九宫格抽奖动画组件

* 支持布局调整
* 带有完整实例代码
* 调用简单, 与业务解耦(只有一个方法)

## 使用

1. 安装

```
npm install --save miniprogram-grid-luckdraw
```

2. 在需要使用 luckdraw 的页面 page.json 中添加 luckdraw 自定义组件配置

```
{
  "usingComponents": {
    "GridLuckdraw": "miniprogram-grid-luckdraw"
  }
}
```

3. 在wxml文件 挂载 luckdraw 组件,并声明id

```
<GridLuckdraw id="GridLuckdrawRef" />
```

4. 在js文件中调用

```
const id = 1
this.selectComponent('#GridLuckdrawRef').setup({ id })
```

## 参数说明

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
    imageSrcKey: {type: String, value: 'src'} // 奖品图片字段名

| 参数          | 类型           | 是否必填 | 默认值    | 说明                    |
| ------------  | ------------- | ------ | -------- | ----------------------------  |
| list          |  array        | 是     | []     | 奖品列表                          |
| uniqueKey     | string        | 否     | 'id'   | 唯一key                           |
| imageSrcKey   | string        | 否     | 'src'  | 奖品图片字段名                      |
| gridItemGap   | number        | 否     | 10     | 奖品布局间隙                      |
| gridItemWidth | number        | 否     | 140    | 奖品宽度                          |
| gridItemHeight| number        | 否     | 130    | 奖品高度                          |
| animated      | boolean       | 否     | false  | 加载动画 (暂不支持)                |
| speed         | number        | 否     | 100    | 运行速度(speed 秒/次)              |
| minRunCount   | number        | 否     | 30     | 最小运行次数                        |
| diminishingCount| number      | 否     | 25     | 开始减速的时机 (当运行多少次后开始减速) |
| deceleration  | string        | 否     | 60     | 每次运行增大间隔时间 (秒/次)          |
| activeStyle   | string        | 否     | 'background-color: rgba(255, 249, 70, 0.7);border-radius: 20rpx;'  | 抽奖动画选中样式                      |
