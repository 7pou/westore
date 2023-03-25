
# westore

基于发布订阅简单实现的状态管理，支持多模块，计算属性。

# 小程序状态管理

* API简单
* 压缩后仅有1kb, 无其它依赖
* 可按模块划分

## 使用

1. 安装

``` js
npm install --save @7pound/westore
```


2. 定义store

``` js
import WeStore from '@7pound/westore'

const fetchUserScore = () => new Promise((resolve) => {
  setTimeout(() => {
    const score = Math.floor(Math.random() * 101)
    resolve({code: 0, message: 'ok', data: {score}})
  }, 500)
})
class UserStore extends WeStore {
  data = {
    name: 'xigua',
    age: 10,
    score: 0,
    say() {
      // the this is UserStore instance
      return this.data.name + ' say: my score is ' + this.data.score + '!'
    }
  }

  getUserScore = async () => {
    const res = await fetchUserScore()
    this.data.score = res.data.score
    this.update()
  }

  setName = (name) => {
    this.data.name = name
    this.update()
  }
}

const userStore = new UserStore()

export default userStore
```

3. 使用

在page中使用

``` js
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
```

``` html
<view class="container">
    <!-- <view class="page-card">
      <UserInfo />
    </view> -->


    <view class="p">
      <text>userStore.name: </text>
      <text>{{ $user.name }}</text>
    </view>

    <button type="primary" bindtap="handleSetName" class="btn">更新name</button>
    <button type="primary" bindtap="handleNavMine" class="btn">跳转个人中心页</button>
</view>
```

在Component中使用

```js
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
```

```html
<view class="contaienr">

  <view class="title">UserInfo组件</view>
  <view class="p">
    <text>userStore.name: </text>
    <text>{{ $user.name }}</text>
  </view>
   <view class="p">
    <text>userStore.score: </text>
    <text>{{ $user.score }}</text>
  </view>
  <view class="p">
    <text>userStore.say: </text>
    <text>{{ $user.say }}</text>
  </view>

  <button class="btn" type="primary" size="mini" bindtap="handleGetScore" >更新score</button>
</view>
```

## DEMO示例
1. 下载仓库
```
git clone https://github.com/7pou/westore
```


2. 安装依赖
```
npm install or yarn
```
3. 执行编译

```
npm run dev or yarn dev
```
4. 导入项目

打开微信开发工具，导入项目、目录在 `/miniprogram_dev`

5. 编译

## API说明

store.data

> store中元数据

store.bind(instance, store_name)

> 在页面中加载（onLoad）、组件挂载（lifetimes.ready）中调用。

> 绑定store到 page 或 component 的data 中，data中的键值为store_name

| 参数          | 说明           | 必填     |
| ------------  | ------------- | ---------------  |
| instance   |  page实例 or component实例        | 是   |
| store_name   |  绑定到page实例 or component实例上data的名称        | 是   |

store.unBind(instance)

> 在页面卸载（onUnload）、组件销毁（lifetimes.detached）调用。

> 取消页面或组件中store绑定

| 参数          | 说明           | 必填     |
| ------------  | ------------- | ---------------  |
| instance   |  page实例 or component实例        | 是   |

store.update()

> 更新store的值到页面或组件的 data 中（修改store.data 后调用）

基于[小程序npm模板](https://github.com/wechat-miniprogram/miniprogram-custom-component.git) 开发

架构实现参考[Tencent/westore](https://github.com/Tencent/westore)

下期计划

* [ ] 加入diff算法，优化update方法中setData一把梭的性能问题
* [ ] 加入action log
* [ ] 支持class 和 defineStore() 两种store定义方法
