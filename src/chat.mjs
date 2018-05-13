import locale from './locale'

export default new class Chat {
  constructor() {
    this.stack = {}
    this.listeners = {}
    this.lengths = {}
    this.counters = {}
    Object.keys(locale).forEach(pattern => {
      if(locale[pattern].listeners) this.listeners[pattern] = RegExp(locale[pattern].listeners.join('|'), 'i')
      this.lengths[pattern] = locale[pattern].replies.map(val => { return val.length })
      this.counters[pattern] = locale[pattern].counters
    })
    this.lstnr = RegExp(Object.values(this.listeners).map(val => { return val.source }).join('|'), 'i')
    setInterval(() => {
      const date = Math.round(Date.now()/1000)
      Object.keys(this.stack).forEach(id =>
        Object.keys(this.stack[id]).forEach(pattern => {
          if(date - this.stack[id][pattern].date > 20) delete this.stack[id][pattern]
      }))
    }, 3600000)
  }
  count(id, pattern, date) {
    this.stack[id] = this.stack[id] || {}
    this.stack[id][pattern] = this.stack[id][pattern] || {}
    const pttrn = this.stack[id][pattern]
    pttrn.date = pttrn.date || 0
    pttrn.counter = pttrn.counter ? date - pttrn.date < 20 ? ++pttrn.counter : 1 : 1
    pttrn.date = date
    return pttrn.counter
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
    if(locale[pattern].counters) this.counters[pattern].forEach(num => { if(counter > num) rank++ })
    return rank
  }
  reply(pattern, params) {
    const counter = params ? this.count(params.id, pattern, params.date) : 0
    const rank = this.getRank(pattern, counter)
    const msg = Math.floor(Math.random() * this.lengths[pattern][rank])
    return locale[pattern].replies[rank][msg]
  }
}
