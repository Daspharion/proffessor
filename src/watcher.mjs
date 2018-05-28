import Telegraf from 'telegraf'
import Extra from 'telegraf/extra'
import Calendar from './calendar'
import { TELEGRAM } from './config'
import { Groups, Schedules, Announcements, Users } from './models'

export default new class Watcher {
  constructor() {
    this.Bot = new Telegraf(TELEGRAM)
    this.announceStack = []
    const now = new Date()
    // STARTUP
    console.log(`> Starting up WATCH @ ${ now }`)

    // REG_ID CLEANUP
    Groups.update({}, { reg_id: undefined })
      .then(({ nModified }) => console.log(`# WATCH: Cleaned reg_id's for ${ nModified } groups`))
      .catch(err => console.error(`! Error: while cleaning reg_id's: ${ err.message }`))

    // ANNOUNCEMENTS
    this.announcements()
    setInterval(() => this.announcements(), 864e5)

    // HOMEWORK CLEANUP
    setTimeout(() => {
      this.cleanhw()
      setInterval(() => this.cleanhw(), 864e5)
    }, new Date().setHours(24,0,0,0) - new Date())

    // AUTO SCHEDULE
    setTimeout(() => {
      this.schedule()
      setInterval(() => { if(now.getDay() < 5) this.schedule() }, 864e5)
    }, now.getHours() < 20 ? new Date().setHours(20,0,0,0) - now : new Date().setHours(24,0,0,0) - now + 72e6)

    // GOOD MORNING
    setTimeout(() => {
      this.goodmorning()
      setInterval(() => this.goodmorning(), 864e5)
    }, now.getHours() < 7 ? new Date().setHours(7,0,0,0) - now : new Date().setHours(24,0,0,0) - now + 252e5)
  }
  cleanhw() {
    const day = new Date().getDay()-1
    if(day >= 0 || day <= 4)
      Schedules.update({}, { [`homework.${ day }`]: [ undefined, undefined, undefined, undefined, undefined ] })
      .then(({ nModified }) => console.log(`# WATCH: Cleaned homework for ${ nModified } groups`))
      .catch(err => console.error(`! Error: while cleaning homeworks: ${ err.message }`))
  }
  schedule() {
    Groups.find({ group_id: { $ne: null }}).then(groups => {
      console.log(`# WATCH: Sending schedules for ${ groups.length } groups`)
      groups.forEach((group, n) => setTimeout(() => Views.groupSchedule(group.group_id), Math.trunc(n/10)*5e3))
    }).catch(err => console.error(`! Error: while sending out schedules: ${ err.message }`))
  }
  announcements() {
    Announcements.find({}).then(a => {
      const date = new Date()
      let counter = [0, 0]
      for(let { _id, group_id, text, min, hour, day, month, year } of a) {
        const diff = new Date(year, month, day, hour, min) - date
        if(diff > 0) {
          if(diff < 864e5)
            if(this.sendAnnouncement(_id, group_id, text, diff)) counter[0]++
        } else Announcements.remove({ _id: _id }).then(() => counter[1]++)
      }
      console.log(`# WATCH: Loaded ${ counter[0] } announcements`)
      console.log(`# WATCH: Removed ${ counter[1] } outdated announcements`)
    })
  }
  goodmorning() {
    const now = new Date()
    Groups.find({}).then(groups => {
      groups.forEach(async (group, n) => {
        const message = [ '*Доброго ранку!* 🌤' ]
        const holidays = []
        const birthdays = []
        // ABOUT TODAY
        const m = new Date().getMonth()+1
        const d = new Date().getDate()
        const i = `${ m > 9 ? m : '0'+m }${ d > 9 ? d : '0'+d }`
        if(Calendar[i]) message.push('Сьогодні '+Calendar[i][0])
        else message.push('Цитата дня: '+Calendar.default[Math.floor(Math.random() * Calendar.default.length)])
        // HOLIDAYS CHECK
        if(Calendar[i] && Calendar[i][1]) {
          for(let name of Calendar[i][1])
            (await Users.find({ first_name: { $regex: new RegExp(name, 'i') }}))
              .forEach(({ first_name, last_name, middle_name }) => holidays.push(`${ last_name } ${ first_name } ${ middle_name }`))
          const l = holidays.length
          if(l > 0) {
            if(l > 1) holidays[l-2] += ` та ${ holidays.pop() }`
            message.push('Сьогодні святкує свої іменини '+holidays.join(', ')+' 🎉')
          }
        }
        // BIRTHDAY CHECK
        (await Users.find({ dob_day: now.getDate(), dob_month: now.getMonth()+1 }))
          .forEach(({ first_name, last_name, middle_name, dob_year }) => birthdays.push(`${ last_name } ${ first_name } ${ middle_name }${
            (now.getFullYear() - dob_year)%10 ? '' : ` (ювілей - ${ now.getFullYear() - dob_year } років 🙌)` }`))
        const l = birthdays.length
        if(l > 0) {
          if(l > 1) birthdays[l-2] += ` та ${ birthdays.pop() }`
          message.push(`Також ${ birthdays.join(', ') } ${ l > 1 ? 'святкують свої дні народження' : 'святкує свій день народження' } 🎂`)
        }


        setTimeout(() => this.Bot.telegram.sendMessage(group.group_id, message.join('\n\` \`'), Extra.markdown()), Math.trunc(n/10)*5e3)
      })
    }).catch(err => console.error(err))
  }
  sendAnnouncement(_id, group_id, text, diff) {
    const index = this.announceStack.indexOf(_id.toString())
    if(index === -1) {
      this.announceStack.push(_id.toString())
      setTimeout(() => {
        this.Bot.telegram.sendMessage(group_id, `\`Оголошення 📢\`\n${ text }`, Extra.markdown())
        this.announceStack.splice(index, 1)
      }, diff)
      return true
    }
    return false
  }
}

/*
KEEP COUNTERS ->
  groups: removed: x
  members: removed: x | new: y
MAIN CYCLE:
  1. GetChatMemberCount ->
    true: -> 2
    false -> Group.remove({ group_id: id })
  2. forEach member GetChatMember(id) ->
    true: next()
    false: Group.update({ group_id: id }, { $pull: member_id })
    finally ->
      if(GetChatMemberCount > group.members.length) ->
      true: tlg.sendMessage(group_id, New users detected, please register, *registration form(inline button)*)
      false: next()
*/
