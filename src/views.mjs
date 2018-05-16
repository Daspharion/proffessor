import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'
import { Schedules } from './models'

export default new class Views {
  constructor(telegram) {
    this.announcements = []
    this.images = [ '🎑', '🏞', '🌅', '🌄', '🌇', '🏙', '🌃', '🌌', '🌉', '🌁' ]
    this.days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
    this._days = [ 'mo', 'tu', 'we', 'th', 'fr' ]

  }
  async groupSchedule({ group_id, telegram }) {
    const { schedule, homework } = await Schedules.findOne({ group_id: group_id })
    const _day = new Date().getDay()
    const hour = new Date().getHours()
    const day = _day > 0 && _day < 6 ? hour > 14 && _day < 5 ? _day : _day-1 : 0
    const str = schedule[day].map((sub, n) => { if(sub || n>0) return `${ n }) ${
      sub ? homework[day][n] ? `${ sub } \`-\` ${ homework[day][n].text.join(' \`-\` ') } ${
      homework[day][n].media.map(() => { return this.images[Math.floor(Math.random() * 10)]}).join('')}` : sub : `\`[вікно]\`` }` })
    if(!str[0]) str.shift()
    telegram.sendMessage(group_id, `\`Розклад - ${ this.days[day] }:\`\n${ str.join('\n') }`,
      Extra.markdown().markup(m => m.inlineKeyboard([
        m.callbackButton('💬', `schedule-media-${ this._days[day] }`),
        m.callbackButton('Пн', `schedule-mo`),
        m.callbackButton('Вт', `schedule-tu`),
        m.callbackButton('Ср', `schedule-we`),
        m.callbackButton('Чт', `schedule-th`),
        m.callbackButton('Пт', `schedule-fr`)]
      )))
  }
  announcement(_id, group_id, text, diff, telegram) {
    const index = this.announcements.indexOf(_id.toString())
    if(index === -1) {
      this.announcements.push(_id.toString())
      setTimeout(() => {
        telegram.sendMessage(group_id, `\`Оголошення 📢\`\n${ text }`, Extra.markdown())
        this.announcements.splice(index, 1)
      }, diff)
      return true
    }
    return false
  }


}
