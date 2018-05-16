import Views from './views'
import { Groups, Schedules, Announcements } from './models'

export default class Watcher {
  constructor(telegram) {
    this.telegram = telegram
    // STARTUP
    console.log(`> Starting up WATCH @ ${ new Date() }`)

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
      setInterval(() => this.schedule(), 864e5)
    }, Math.abs(new Date().setHours(20,0,0,0) - new Date()))

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
      groups.forEach((group, n) => setTimeout(() => Views.groupSchedule({ group_id: group.group_id, telegram: this.telegram }), Math.trunc(n/10)*5e3))
    }).catch(err => console.error(`! Error: while sending out schedules: ${ err.message }`))
  }
  announcements() {
    Announcements.find({}).then(a => {
      const date = new Date()
      let counter = [0, 0]
      a.forEach(({ _id, group_id, text, min, hour, day, month, year }) => {
        const diff = new Date(year, month, day, hour, min) - date
        if(diff > 0) {
          if(diff < 864e5)
            if(Views.announcement(_id, group_id, text, diff, this.telegram)) counter[0]++
        } else Announcements.remove({ _id: _id }).then(() => counter[1]++)
      })
      setTimeout(() => {
        console.log(`# WATCH: Loaded ${ counter[0] } announcements`)
        console.log(`# WATCH: Removed ${ counter[1] } outdated announcements`)
      }, 5000)
    })
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
