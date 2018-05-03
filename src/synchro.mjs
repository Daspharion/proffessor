import { Groups } from './models'

export default class Synchro {
  constructor(tlg) {
    this.tlg = tlg
  }
  start() {
    return Promise((resolve, reject) => {
      console.log('> Starting synchronization')

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
