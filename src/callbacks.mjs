import Extra from 'telegraf/extra'

import { Groups, Polls, Schedules } from './models'

export default new class Callbacks {
  answer(ctx) {
    const id = ctx.update.callback_query.data.split('-')
    const params = id.splice(1)
    if(this[id[0]]) params[0] ? this[id[0]](ctx, params) : this[id[0]](ctx)
    else throw new Error(`Unexpected callback query: ${ id[0] }`)
  }

  // REGISTER
  async register(ctx) {
    const { message, from } = ctx.update.callback_query
    const group = await Groups.findOne({ group_id: message.chat.id })
    if(group.reg_id === message.message_id) {
      const { nModified } = await Groups.update({ group_id: message.chat.id }, { $addToSet: { members: from.id } })
      ctx.answerCbQuery()
      if(nModified) {
        const members = {
          reg: (await Groups.findOne({ group_id: message.chat.id })).members.length,
          all: await ctx.getChatMembersCount(message.chat.id)
        }
        ctx.telegram.sendMessage(from.id, `Привіт, ${ from.first_name }, мене звати \`PROFFESSOR\`, будемо знайомі 🤠`, Extra.markdown())
        await ctx.telegram.editMessageText(message.chat.id, message.message_id, null,
          `\`Реєстрація користувачів\`\nДля реєстрації натисніть, будь ласка, на чекмарк\n/cancel\` - для зупинки процесу\`\n\`Статус: ${ members.reg }/${ members.all-1 }\``,
          Extra.markdown().markup(m => m.inlineKeyboard([ m.callbackButton('✔️', 'register') ])))
        if(members.reg >= members.all) ctx.scene.leave()
      }
    } else ctx.telegram.editMessageText(message.chat.id, message.message_id, null,
        `\`Реєстрація користувачів\`\nФорма для реєстрації застаріла.\n/register\` - для відкриття реєстраційної форми\``, Extra.markdown())
  }

  // VOTE
  async vote(ctx, params) {
    const [ answer ]  = params
    const { message, from } = ctx.update.callback_query
    const poll = await Polls.findOne({ group_id: message.chat.id, message_id: message.message_id })
    if(poll && !poll.voters.includes(from.id)) {
      Polls.update({ group_id: message.chat.id, message_id: message.message_id }, {
        $push: { voters: from.id },
        $inc: { [`answers.${ answer }.votes`]: 1 }
      }).then(() => {
        const ans = poll.answers
        const length = ++poll.voters.length
        ++ans[answer].votes
        const top = ans.map(e => { return e.votes }).reduce((a, b) => { return Math.max(a,b) })
        ctx.telegram.editMessageText(message.chat.id, message.message_id, null,
          `\`Голосування\`\n*${ poll.title
          }*\n\`Варіанти відповідей:\`\n${
          ans.map((e, n) => { return `${ e.votes === top ? `\`>\`` : `\` \`` } ${ String.fromCharCode(65+n) } \`[${ (e.votes/length*100).toFixed(0) }%]\`: ${ e.text }`}).join('\n')
          }\n\`Всього голосів: ${ length }\``,
          Extra.markdown().markup(m => m.inlineKeyboard(ans.map((e, n) => { return  m.callbackButton(String.fromCharCode(65+n), `vote-${ n }`) }))))
      })

    } else ctx.answerCbQuery()
  }

  // SCHEDULE
  async schedule(ctx, params) {
    const [ button, _day ] = params
    const { message, from } = ctx.update.callback_query
    if(message.chat.type === 'private') {
      const schedule = ctx.session.schedule
      if(schedule) {
        if(button === 'left') schedule.day < 1 ? schedule.day = 4 : schedule.day--
        else if(button === 'up') schedule.n < 1 ? schedule.n = 4 : schedule.n--
        else if(button === 'down') schedule.n > 3 ? schedule.n = 0 : schedule.n++
        else if(button === 'right') schedule.day > 3 ? schedule.day = 0 : schedule.day++
        if(button === 'left' || button === 'right') schedule.n = 1
        ctx.telegram.editMessageText(message.chat.id, message.message_id, null, `\`Розклад\`\n*${ schedule.days[schedule.day] }:*\n${ schedule.schedule[schedule.day].map((sub, n) => {
          return `${ n === schedule.n ? `\`>\`` : `\` \`` } ${ n }) ${ sub ? sub : `\`[вікно]\`` }` }).join('\n')}\n/done \`- для збереження\``,
          Extra.markdown().markup(m => m.inlineKeyboard([
            m.callbackButton('⬅️', `schedule-left`),
            m.callbackButton('⬆️', `schedule-up`),
            m.callbackButton('⬇️', `schedule-down`),
            m.callbackButton('➡️', `schedule-right`)])))
      } else ctx.answerCbQuery()
    } else {
      if(button === 'media') {
        const { schedule, homework } = await Schedules.findOne({ group_id: message.chat.id })
        const day = [ 'mo', 'tu', 'we', 'th', 'fr' ].indexOf(_day)
        homework[day].map(sub => { if(sub) return sub.media }).forEach((sub, n) => {
          if(sub[0])
            if(sub.length > 1) ctx.replyWithMediaGroup(sub.map(m => { return { type: 'photo', media: m, caption: schedule[day][n] }}))
            else ctx.replyWithPhoto(sub[0], { caption: schedule[day][n] })
        })
        ctx.answerCbQuery()
      } else {
        const emoji = [ '🎑', '🏞', '🌅', '🌄', '🌇', '🏙', '🌃', '🌌', '🌉', '🌁' ]
        const days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
        const day = [ 'mo', 'tu', 'we', 'th', 'fr' ].indexOf(button)
        const { schedule, homework } = await Schedules.findOne({ group_id: message.chat.id })
        const str = schedule[day].map((sub, n) => { if(sub || n>0) return `${ n }) ${
          sub ? homework[day][n] ? `${ sub } \`-\` ${ homework[day][n].text.join(' \`-\` ') } ${
          homework[day][n].media.map(() => { return emoji[Math.floor(Math.random()*10)]}).join('')}` : sub : `\`[вікно]\`` }` })
        if(!str[0]) str.shift()
        ctx.telegram.editMessageText(message.chat.id, message.message_id, null, `\`Розклад - ${ days[day] }:\`\n${ str.join('\n') }`,
          Extra.markdown().markup(m => m.inlineKeyboard([
            m.callbackButton('💬', `schedule-media-${ button }`),
            m.callbackButton('Пн', `schedule-mo`),
            m.callbackButton('Вт', `schedule-tu`),
            m.callbackButton('Ср', `schedule-we`),
            m.callbackButton('Чт', `schedule-th`),
            m.callbackButton('Пт', `schedule-fr`)]
        ))).catch(err => ctx.answerCbQuery())
      }
    }
  }


}
