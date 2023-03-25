

import WeStore from '../utils/index'

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
