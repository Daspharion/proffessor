import Telegraf from 'telegraf'
import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'
import Sms from './sms'
import { TELEGRAM } from './config'
import { Schedules, GroupSms } from './models'

export default new class Views {
  constructor() {
    this.Bot = new Telegraf(TELEGRAM)
    this.announcements = []
    this.images = [ '🎑', '🏞', '🌅', '🌄', '🌇', '🏙', '🌃', '🌌', '🌉', '🌁' ]
    this.days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
  }
  async groupSchedule(group_id) {
    const { schedule, homework } = await Schedules.findOne({ group_id: group_id })
    const _day = new Date().getDay()
    const hour = new Date().getHours()
    const day = _day > 0 && _day < 6 ? hour > 14 && _day < 5 ? _day : _day-1 : 0
    const str = schedule[day].map((sub, n) => { if(sub || n>0) return `${ n }) ${
      sub ? homework[day][n] ? `${ sub } \`-\` ${ homework[day][n].text.join(' \`-\` ') } ${
      homework[day][n].media.map(() => { return this.images[Math.floor(Math.random() * 10)]}).join('')}` : sub : `\`[вікно]\`` }` })
    if(!str[0]) str.shift()
    this.Bot.telegram.sendMessage(group_id, `\`Розклад - ${ this.days[day] }:\`\n${ str.join('\n') }`,
      Extra.markdown().markup(m => m.inlineKeyboard([
        m.callbackButton('💬', `schedule-${ day }-m`),
        m.callbackButton('Пн', `schedule-0`),
        m.callbackButton('Вт', `schedule-1`),
        m.callbackButton('Ср', `schedule-2`),
        m.callbackButton('Чт', `schedule-3`),
        m.callbackButton('Пт', `schedule-4`)]
      )))
  }
  announcement(_id, group_id, text, diff) {
    const index = this.announcements.indexOf(_id.toString())
    if(index === -1) {
      this.announcements.push(_id.toString())
      setTimeout(() => {
        this.Bot.telegram.sendMessage(group_id, `\`Оголошення 📢\`\n${ text }`, Extra.markdown())
        this.announcements.splice(index, 1)
      }, diff)
      return true
    }
    return false
  }
  async smsStatus(group_id, user_id) {
    const messages = await GroupSms.find({ group_id: group_id }, null, { limit: 14, sort: '-date' })
    const state = await Sms.state(messages.reduce((result, item) => { return result.concat(item.message_ids) }, []))
    const stack = [ 'Статус останніх 15-ти повідомлень:', '\`\`\`   КОМУ   | ДАТА  |   ПРО   |  СТАТУС' ]
    messages.forEach(m =>
      m.to.forEach((num, n) =>
        stack.push(`${ (''+num).slice(-10) }| ${ ('0'+(m.date.getMonth()+1)).slice(-2) }/${ ('0'+m.date.getDate()).slice(-2) } |${
          (m.text.split(' ')[1]+'         ').slice(0, 9)}|${ state[m.message_ids[n]] }`)
      ))
    this.Bot.telegram.sendMessage(user_id, stack.join('\n')+'\`\`\`', Extra.markdown())
  }


}
