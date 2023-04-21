import {defineStore} from '@7pound/westore'
// 使用 defineStore定义store
const abilityStore = defineStore({
  state: {
    kun: {
      level: 1,
      use: 'use'
    },
    sing: 'sing',
    jump: 'jump',
    rap: 'rap'
  },
  getters: {
    put(state) {
      return [state.sing, state.jump, state.rap].join('、')
    }
  },
  actions: {
    postAbilityGet() {
      setTimeout(() => {
        this.data.kun = {level: 2, use: 'used'}
        this.update()
      })
    }
  }
})

export default abilityStore
