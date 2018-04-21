import locale from './locale'

class Chat {
  constructor() {
    this.listeners = {}
    this.lengths = {}
    this.counters = {}
    Object.keys(locale).forEach(pattern => {
      this.listeners[pattern] = RegExp(Object.values(locale[pattern].listeners).join('|'), 'i')
      this.lengths[pattern] = locale[pattern].replies.map(val => { return val.length })
      this.counters[pattern] = locale[pattern].counters
    })
    this.lstnr = RegExp(Object.values(this.listeners).map(val => { return val.source }).join('|'), 'i')
  }
  parse(match) {
    match = match.toLowerCase()
    const pattern = Object.keys(this.listeners).find(key => {
      if(this.listeners[key].test(match)) return key
    })
    return pattern || 'default'
  }
  getRank(pattern, counter) {
    let rank = 0
    this.counters[pattern].forEach(num => { if(counter > num) rank++ })
    return rank
  }
  reply(pattern, counter) {
    const rank = this.getRank(pattern, counter)
    const msg = Math.floor(Math.random() * this.lengths[pattern][rank])
    return locale[pattern].replies[rank][msg]
  }
}

export default Chat
