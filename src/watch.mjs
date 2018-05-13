import { Groups, Schedules } from './models'

export default new class Watch {
  constructor() {
    // STARTUP
    console.log(`> Starting up WATCH @ ${ new Date() }`)

    // REG_ID CLEANUP
    Groups.update({}, { reg_id: undefined })
      .then(({ nModified }) => console.log(`# WATCH: Cleaned reg_id's for ${ nModified } groups`))
      .catch(err => console.error(`! Error: while cleaning reg_id's: ${ err.message }`))

    // HOMEWORK CLEANUP
    setTimeout(() => {
      this.cleanhw()
      setInterval(() => this.cleanhw(), 864e5)
    }, new Date().setHours(24,0,0,0) - new Date())
  }
  cleanhw() {
    const day = new Date().getDay()-1
    if(day >= 0 || day <= 4)
      Schedules.update({}, { [`homework.${ day }`]: [ undefined, undefined, undefined, undefined, undefined ] })
      .then(({ nModified }) => console.log(`# WATCH: Cleaned homework for ${ nModified } groups`))
      .catch(err => console.error(`! Error: while cleaning homeworks: ${ err.message }`))
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
