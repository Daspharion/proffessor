class History {
  constructor() {
    this.stack = {}
    setInterval(() => {
      const date = Math.round(Date.now()/1000)
      Object.keys(this.stack).forEach(id =>
        Object.keys(this.stack[id]).forEach(pattern => {
          if(date - this.stack[id][pattern].date > 20) delete this.stack[id][pattern]
      }))
    }, 3600000)
  }
  count({ id, pattern, date }) {
    this.stack[id] = this.stack[id] || {}
    this.stack[id][pattern] = this.stack[id][pattern] || {}
    const pttrn = this.stack[id][pattern]
    pttrn.date = date || 0
    pttrn.counter = pttrn.counter ? date - pttrn.date < 20 ? ++pttrn.counter : 1 : 1
    pttrn.date = date
    return pttrn.counter
  }
}

export default History
