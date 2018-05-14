import WizardScene from 'telegraf/scenes/wizard'
import Scene from 'telegraf/scenes/base'
import Markup from 'telegraf/markup'
import Stage from 'telegraf/stage'
import Extra from 'telegraf/extra'

import { Groups, Polls, Schedules } from './models'

const _Stage = new Stage()

// REGISTER
const reg = new Scene('reg')

reg.enter(async ctx => {
  console.log('entered reg scene')
  const msg = ctx.message
  const members = {
    reg: (await Groups.findOne({ group_id: msg.chat.id })).members.length,
    all: await ctx.getChatMembersCount(msg.chat.id)
  }
  ctx.reply('debugging sucks...')
  ctx.reply(`\`Реєстрація користувачів\`\nДля реєстрації натисніть, будь ласка, на чекмарк\n/cancel\` - для зупинки процесу\`\n\`Статус: ${ members.reg }/${ members.all-1 }\``,
    Extra.markdown().markup(m => m.inlineKeyboard([ m.callbackButton('✔️', 'register') ])))
    .then(({ message_id }) => Groups.update({ group_id: msg.chat.id }, { reg_id: message_id }))
})
reg.leave(ctx => {
  const msg = ctx.message || ctx.update.callback_query.message
  Groups.findOne({ group_id: msg.chat.id }).then(async group => {
    await ctx.telegram.deleteMessage(msg.chat.id, group.reg_id)
    await Groups.update({ group_id: msg.chat.id }, { reg_id: undefined })
  }).catch(err => console.log(err))
})
reg.command('cancel', ctx => ctx.scene.leave())

// NEW POLL
const poll = new WizardScene('newpoll',
  async (ctx) => {
    const q = await Polls.findOne({ user_id: ctx.message.from.id })
    if(q) await ctx.reply('Ваше попереднє опитування досі активне, воно буде автоматично видалене при створенні нового.')
    ctx.reply('Напишіть мені, будь ласка, запитання для опитування.')
    ctx.wizard.next()
  },
  async (ctx) => {
    const { id, from, chat, text } = ctx.message
    ctx.session.poll = {
      user_id: from.id,
      title: text,
      answers: [],
      voters: []
    }
    ctx.reply('Добре, а тепер напишіть мені варіанти відповідей (кожне у окремому повідомленні).')
    ctx.wizard.next()
  },
  async (ctx) => {
    const msg = ctx.message
    const length = ctx.session.poll.answers.length
    if(msg.text === '/done' || length > 6) {
      if(length > 6) ctx.session.poll.answers.push({ text: msg.text, votes: 0 })
      if(length < 2) ctx.reply('Необхідно мінімум два варіанти відповідей.')
      else {
        const q = await Groups.find({ members: ctx.message.from.id })
        ctx.reply('Вкажіть, будь ласка, в котрій бесіді в бажаєте провести опитування:',
          Markup.keyboard(q.map(({ group_title }) => { return group_title })).oneTime().resize().extra())
        ctx.wizard.next()
      }
    } else {
      ctx.session.poll.answers.push({ text: msg.text, votes: 0 })
      ctx.replyWithMarkdown(`Відповідь успішно добавлена.${ length > 5 ? `\nВи можете добавити ще один варіант відповіді \`(7/8)\`` : `` }\n/done \`- для закінчення\``)
    }
  },
  async (ctx) => {
    const group = await Groups.findOne({ group_title: ctx.message.text })
    if(group) {
      const poll = ctx.session.poll
      ctx.telegram.sendMessage(group.group_id,
        `\`Голосування\`\n*${ poll.title }*\n\`Варіанти відповідей:\`\n${ poll.answers.map((e, n) => { return `${ `\` \` ` }${ String.fromCharCode(65+n) } \`[0%]\`: ${ e.text } `}).join('\n') }\n\`Всього голосів: 0\``,
        Extra.markdown().markup(m => m.inlineKeyboard(poll.answers.map((e, n) => { return  m.callbackButton(String.fromCharCode(65+n), `vote-${ n }`) }))))
        .then(({ message_id, chat }) =>
          Polls.update({ user_id: ctx.message.from.id }, {
            group_id: chat.id,
            message_id: message_id,
            user_id: poll.user_id,
            title: poll.title,
            answers: poll.answers,
            voters: poll.voters
          }, { upsert: true }))
        .then(() => ctx.replyWithMarkdown('Готово.\n/delpoll \`- для зупинки опитування\`', Extra.markup((m) => m.removeKeyboard())))
        .then(() => ctx.scene.leave())
    }
  }
)
poll.leave(ctx => ctx.session.poll = undefined)
poll.command('cancel', ctx => {
  ctx.reply('Процес створення нового голосування було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// SCHEDULE
const schedule = new Scene('schedule')

schedule.enter(async ctx => {
  const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
  const schedule = await Schedules.findOne({ group_id: group_id })
  Object.assign(schedule, {
    days: [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ],
    day: 0,
    n: 1
  })
  ctx.session.schedule = schedule
  ctx.replyWithMarkdown(`\`Розклад\`\n*${ schedule.days[schedule.day] }:*\n${ schedule.schedule[schedule.day].map((sub, n) => {
    return `${ n === schedule.n ? `\`>\`` : `\` \`` } ${ n }) ${ sub ? sub : `\`[вікно]\`` }` }).join('\n')}\n/done \`- для збереження\``,
    Extra.markdown().markup(m => m.inlineKeyboard([
      m.callbackButton('⬅️', `schedule-left`),
      m.callbackButton('⬆️', `schedule-up`),
      m.callbackButton('⬇️', `schedule-down`),
      m.callbackButton('➡️', `schedule-right`)]))
  ).then(({ message_id }) => ctx.session.schedule.message_id = message_id)
})
schedule.command('done', ctx => {
  const schedule = ctx.session.schedule
  const counter = {}
  schedule.schedule.forEach(day => day.forEach(sub => { if(sub) counter[sub] ? counter[sub]++ : counter[sub] = 1 }))
  const subjects = Object.entries(counter).sort((a,b) => { return b[1] - a[1] }).map(e => e[0])
  Schedules.update({ group_id: schedule.group_id }, {
    subjects: subjects,
    schedule: schedule.schedule
  }).then(() => {
    ctx.telegram.editMessageText(ctx.message.from.id, schedule.message_id, null, 'Розклад успішно налаштовано.')
    ctx.scene.leave()
  }).catch((err) => {
    ctx.reply('Ой... Відбулась невідома помилка при налаштуванні розкладу.')
  })
})
schedule.on('text', ctx => {
  const schedule = ctx.session.schedule
  schedule.schedule[schedule.day][schedule.n] = ctx.message.text.match(/вікно/i) ? undefined : ctx.message.text
  if(schedule.n > 3) {
    schedule.n = 1
    schedule.day > 3 ? schedule.day = 0 : schedule.day++
  } else schedule.n++
  ctx.telegram.deleteMessage(ctx.message.from.id, schedule.message_id)
  ctx.replyWithMarkdown(`\`Розклад\`\n*${ schedule.days[schedule.day] }:*\n${ schedule.schedule[schedule.day].map((sub, n) => {
    return `${ schedule.n === n ? `\`>\`` : `\` \`` } ${ n }) ${ sub ? sub : `\`[вікно]\`` }` }).join('\n')}\n/done \`- для збереження\``,
    Extra.markup(m => m.inlineKeyboard([
      m.callbackButton('⬅️', `schedule-left`),
      m.callbackButton('⬆️', `schedule-up`),
      m.callbackButton('⬇️', `schedule-down`),
      m.callbackButton('➡️', `schedule-right`)]))
  ).then(({ message_id }) => ctx.session.schedule.message_id = message_id)
})
schedule.leave(ctx => ctx.session.schedule = undefined)
schedule.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес налаштування розкладу було перервано.')
  ctx.scene.leave()
})

// HOMEWORK
const homework = new WizardScene('homework',
  async (ctx) => {
    const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
    const schedule = await Schedules.findOne({ group_id: group_id })
    ctx.session.emoji = [ '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣' ]
    ctx.session.days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
    ctx.session.schedule = schedule
    ctx.session.homework = {
      text: [],
      media: []
    }
    ctx.replyWithMarkdown('Надішліть мені, будь ласка, завдання та/або фото')
    ctx.wizard.next()
  },
  (ctx) => {
    const msg = ctx.message
    const { schedule, homework } = ctx.session
    if(msg.text === '/done') {
      ctx.reply('Вкажіть потрібний предмет:',
        Markup.keyboard(schedule.subjects, { columns: 3 }).oneTime().resize().extra())
      ctx.wizard.next()
    } else if(msg.text || msg.photo) {
      let added = false
      if(msg.text) homework.text.push(msg.text)
      else if(homework.media.length < 10) {
        homework.media.push(msg.photo.pop().file_id)
        added = true
      }
      const length = homework.media.length
      ctx.replyWithMarkdown(`\`Успіх!\`\n${ msg.text || added ? `Дані додано` : `Медіа не добавлено`}${
        length > 8 ? `. Медіа ${ length }/10` : `` }\n/done\` - для закінчення\``)
    } else ctx.replyWithMarkdown('Я приймаю виключно *текст* або *фото*!')
  },
  (ctx) => {
    const { schedule, days } = ctx.session
    if(schedule.subjects.includes(ctx.message.text)) {
      const _day = new Date().getDay()
      const day = _day > 0 || _day < 6 ? _day-1 : 0
      const _days = days.slice(day+1).concat(days.slice(0, day+1))
      schedule.schedule = schedule.schedule.concat(schedule.schedule.splice(0, day+1))
      const keyboard = []
      schedule.schedule.forEach((day, dayname) =>
        day.forEach((sub, n) => { if(sub === ctx.message.text) keyboard.push(`${ ctx.session.emoji[n] } ${ days[dayname] }`)}))
      ctx.reply('Вкажіть котру пару ви бажаєте обрати: ',
        Markup.keyboard(keyboard, { columns: 2 }).resize().extra())
      ctx.wizard.next()
    } else ctx.reply('Хмм.. Такого предмету немає.')
  },
  (ctx) => {
    const { emoji, days, schedule, homework } = ctx.session
    const n = emoji.indexOf(ctx.message.text.slice(0, 3))
    if(n !== -1) {
      const day = days.indexOf(ctx.message.text.slice(4))
      if(day !== -1) {
        Schedules.update({ group_id: schedule.group_id } , {
          [`homework.${ day }.${ n }`]: { text: homework.text, media: homework.media }
        }).then(() => {
          ctx.replyWithMarkdown(`\`Успіх!\`\nДомашню роботу збережено`, Extra.markup(Markup.removeKeyboard()))
          ctx.scene.leave()
        }).catch(err => {
          ctx.reply('Відбулась помилка при збереженні домашньої роботи. Спробуйте пізніше.', Extra.markup(Markup.removeKeyboard()))
          ctx.scene.leave()
        })
      } else ctx.reply('Вибачте, але я вас не зрозумів. Спробуйте ще раз.')
    } else ctx.reply('Вибачте, але я вас не зрозумів. Спробуйте ще раз.')
  }
)
homework.leave(ctx => {
  ctx.session.emoji = undefined
  ctx.session.days = undefined
  ctx.session.schedule = undefined
  ctx.session.homework = undefined
})
homework.command('cancel', ctx => {
  ctx.reply('Процес добавлення домашньої роботи було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})


_Stage.register(reg, poll, schedule, homework)



export default _Stage
