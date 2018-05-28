import Composer from 'telegraf/composer'
import Extra from 'telegraf/extra'

import { Groups, Polls, Schedules, Visiting } from './models'

const Handler = new Composer()

// VISITNG
Handler.action(/^visiting/, async ctx => {
  const visiting = ctx.session.visiting
  if(visiting) {
    const { message_id, chat } = ctx.update.callback_query.message
    const action = ctx.match.input.split('-')[1]
    const day = new Date()
    const msg = [ `Студент, ${ visiting.student.last_name } ${ visiting.student.first_name }`, '\`Пара | 0 | 1 | 2 | 3 | 4 |\`', '\`--------------------------\`' ]
    const stack = {}
    if(action === 'skipleft') {
      day.setDate(day.getDate()+visiting.offset*7-28)
      visiting.offset -= 4
    } else if(action === 'left') {
      day.setDate(day.getDate()+visiting.offset*7-7)
      visiting.offset -= 1
    } else if(action === 'right') {
      day.setDate(day.getDate()+visiting.offset*7+7)
      visiting.offset += 1
    } else if(action === 'skipright') {
      day.setDate(day.getDate()+visiting.offset*7+28)
      visiting.offset += 4
    } else visiting.offset = 0
    const to = parseInt(''+day.getFullYear()+('0'+(day.getMonth()+1)).slice(-2)+('0'+day.getDate()).slice(-2))
    day.setDate(day.getDate()-7)
    const from = parseInt(''+day.getFullYear()+('0'+(day.getMonth()+1)).slice(-2)+('0'+day.getDate()).slice(-2))
    const absent = await Visiting.find({ group_id: visiting.group_id, day: { $gt: from-1, $lt: to+1 }, absent: { $in: visiting.student._id } })
    if(absent[0]) {
      absent.forEach(e => stack[e.day] ? stack[e.day].push(e.lesson) : stack[e.day] = [e.lesson] )
      Object.entries(stack).sort((a, b) => b[0]-a[0]).forEach(d => msg.push(`\`${ d[0].slice(4, 6)+'/'+d[0].slice(6,8) }| ${ [0,1,2,3,4].map(n => stack[d[0]].indexOf(n) === -1 ? ' ' : 'н').join(' | ') } |\``))
      msg.push(`Всього пропущено: ${ absent.length } ${ absent.length > 4 || absent.length === 0 ? 'занять' : 'заняття' }`)
      msg.push(`За період від ${ Object.keys(stack).shift().slice(4, 6)+'/'+Object.keys(stack).shift().slice(6,8) } до ${
        Object.keys(stack).pop().slice(4, 6)+'/'+Object.keys(stack).pop().slice(6,8) }`)
      } else msg.push('Інформація відсутня')
      ctx.telegram.editMessageText(chat.id, message_id, null, msg.join('\n'), Extra.markdown().markup(m => m.inlineKeyboard([
        m.callbackButton('<<', 'visiting-skipleft'),
        m.callbackButton('<', 'visiting-left'),
        m.callbackButton('🏠', 'visiting-home'),
        m.callbackButton('>', 'visiting-right'),
        m.callbackButton('>>', 'visiting-skipright')]
      ))).catch(() => ctx.answerCbQuery())
  } else ctx.answerCbQuery()
})

// VOTE
Handler.action(/^vote/, async ctx => {
  const answer = ctx.match.input.split('-')[1]
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
      ctx.telegram.editMessageText(message.chat.id, message.message_id, null, `\`Голосування\`\n*${ poll.title }*\n\`Варіанти відповідей:\`\n${
        ans.map((e, n) => { return `${ e.votes === top ? `\`>\`` : `\` \`` } ${ String.fromCharCode(65+n) } \`[${
        (e.votes/length*100).toFixed(0) }%]\`: ${ e.text }`}).join('\n') }\n\`Всього голосів: ${ length }\``,
        Extra.markdown().markup(m => m.inlineKeyboard(ans.map((e, n) => { return  m.callbackButton(String.fromCharCode(65+n), `vote-${ n }`) }))))
    })
  } else ctx.answerCbQuery()
})

// SCHEDULE
Handler.action(/^schedule/, async ctx => {
  const [ day, media ] = ctx.match.input.split('-').slice(1)
  const { message, from } = ctx.update.callback_query
  if(message.chat.type === 'private') {
    const schedule = ctx.session.schedule
    if(schedule) {
      if(day === 'left') schedule.day < 1 ? schedule.day = 4 : schedule.day--
      else if(day === 'up') schedule.n < 1 ? schedule.n = 4 : schedule.n--
      else if(day === 'down') schedule.n > 3 ? schedule.n = 0 : schedule.n++
      else if(day === 'right') schedule.day > 3 ? schedule.day = 0 : schedule.day++
      if(day === 'left' || day === 'right') schedule.n = 1
      ctx.telegram.editMessageText(message.chat.id, message.message_id, null, `\`Розклад\`\n*${ schedule.days[schedule.day] }:*\n${ schedule.schedule[schedule.day].map((sub, n) => {
        return `${ n === schedule.n ? `\`>\`` : `\` \`` } ${ n }) ${ sub ? sub : `\`[вікно]\`` }` }).join('\n')}\n/done \`- для збереження\``,
        Extra.markdown().markup(m => m.inlineKeyboard([
          m.callbackButton('⬅️', `schedule-left`),
          m.callbackButton('⬆️', `schedule-up`),
          m.callbackButton('⬇️', `schedule-down`),
          m.callbackButton('➡️', `schedule-right`)])))
    } else ctx.answerCbQuery()
  } else {
    if(media) {
      const { schedule, homework } = await Schedules.findOne({ group_id: message.chat.id })
      homework[day].map(sub => { if(sub) return sub.media }).forEach((sub, n) => {
        if(sub && sub[0])
          if(sub.length > 1) ctx.replyWithMediaGroup(sub.map(m => { return { type: 'photo', media: m, caption: schedule[day][n] }}))
          else ctx.replyWithPhoto(sub[0], { caption: schedule[day][n] })
      })
      ctx.answerCbQuery()
    } else {
      const emoji = [ '🎑', '🏞', '🌅', '🌄', '🌇', '🏙', '🌃', '🌌', '🌉', '🌁' ]
      const days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
      const { schedule, homework } = await Schedules.findOne({ group_id: message.chat.id })
      const str = schedule[day].map((sub, n) => { if(sub || n>0) return `${ n }) ${
        sub ? homework[day][n] ? `${ sub } \`-\` ${ homework[day][n].text.join(' \`-\` ') } ${
        homework[day][n].media.map(() => { return emoji[Math.floor(Math.random()*10)]}).join('') }` : sub : `\`[вікно]\`` }` })
      if(!str[0]) str.shift()
      ctx.telegram.editMessageText(message.chat.id, message.message_id, null, `\`Розклад - ${ days[day] }:\`\n${ str.join('\n') }`,
        Extra.markdown().markup(m => m.inlineKeyboard([
          m.callbackButton('💬', `schedule-${ day }-m`),
          m.callbackButton('Пн', 'schedule-0'),
          m.callbackButton('Вт', 'schedule-1'),
          m.callbackButton('Ср', 'schedule-2'),
          m.callbackButton('Чт', 'schedule-3'),
          m.callbackButton('Пт', 'schedule-4')]
      ))).catch(err => ctx.answerCbQuery())
    }
  }
})

// REG
Handler.action(/^reg/, async ctx => {
  const type = ctx.match.input.split('-')[1] === 'teacher' ? true : false
  const { message, from } = ctx.update.callback_query
  const group = await Groups.findOne({ group_id: message.chat.id })
  if(!group) {
    const admins = (await ctx.getChatAdministrators()).map(({ user }) => user.id)
    if(admins.includes(from.id)) {
      const empty = [ undefined, undefined, undefined, undefined, undefined ]
      Groups.create({
        group_id: message.chat.id,
        type: type,
        group_title: message.chat.title,
        admins: admins
      }).then(() => {
        if(!type) Schedules.create({
          group_id: message.chat.id,
          schedule: [ empty, empty, empty, empty, empty ],
          homework: [ empty, empty, empty, empty, empty ]
        }).catch(err => console.log(err))
      }).catch(err => console.log(err)).then(() => ctx.leaveChat(message.chat.id)))
      // }).catch(err => ctx.reply('Помилка при створенні запису в базі даних. Спробуйте, будь ласка, пізніше.').then(() => ctx.leaveChat(message.chat.id)))
        .then(() => ctx.editMessageText('Реєстрацію *успішно* завершено.', Extra.markdown()))
    } else ctx.answerCbQuery()
  } else ctx.editMessageText('Ви уже зареєстрували *дану бесіду*.', Extra.markdown())
})


export default Handler
