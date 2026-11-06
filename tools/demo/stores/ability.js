import {defineStore} from '@7pound/westore'
const abilityStore = defineStore({
  state: {
    kun: {
      level: 1,
      use: 'use'
    },
    sing: 'sing',
    jump: 'jump',
    rap: 'rap',
    privateNote: 'not bound to the page'
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
    },
    levelUp() {
      this.batch(() => {
        this.patch({sing: 'sing+'})
        this.data.kun.level++
        this.data.kun.use = 'used'
      })
    }
  }
})

export default abilityStore
