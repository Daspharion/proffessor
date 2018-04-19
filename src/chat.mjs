import locale from './locale'

class Chat {
  constructor() {
    this.config = {
      lengths: {},
      rates: {}
    }
    for(let key in locale) {
      this.config.lengths[key] = []
      this.config.rates[key] = locale[key][1]
      for(let i in locale[key])
        this.config.lengths[key][i] = locale[key][0][i].length
    }
  }
  getRate(type, counter) {
    let rate = 0
    for(let el of this.config.rates[type])
      if(counter >= el) rate++
    return rate
  }
  reply(type, counter) {
    const i = this.getRate(type, counter)
    const j = Math.floor(Math.random() * this.config.lengths[type][i])
    return locale[type][0][i][j]
  }





}

export default Chat
