import WizardScene from 'telegraf/scenes/wizard'
import Scene from 'telegraf/scenes/base'
import Markup from 'telegraf/markup'
import Stage from 'telegraf/stage'
import Extra from 'telegraf/extra'
import Views from './views'
import Sms from './sms'

import { Groups, Polls, Schedules, Announcements, Requisites, Users, Visiting, Parents, GroupSms } from './models'

const _Stage = new Stage()

// REGISTER
const reg = new Scene('reg')

reg.enter(async ctx => {
  const msg = ctx.message
  const members = {
    reg: (await Groups.findOne({ group_id: msg.chat.id })).members.length,
    all: await ctx.getChatMembersCount(msg.chat.id)
  }
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
        `\`Голосування 📢\`\n*${ poll.title }*\n\`Варіанти відповідей:\`\n${ poll.answers.map((e, n) => { return `${ `\` \` ` }${ String.fromCharCode(65+n) } \`[0%]\`: ${ e.text } `}).join('\n') }\n\`Всього голосів: 0\``,
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
schedule.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес налаштування розкладу було перервано.')
  ctx.scene.leave()
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
        day.forEach((sub, n) => { if(sub === ctx.message.text) keyboard.push(`${ ctx.session.emoji[n] } ${ _days[dayname] }`)}))
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

// ANNOUNCE
const announce = new WizardScene('announce',
  async (ctx) => {
    const date = new Date()
    const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
    ctx.session.announce = {
      group_id: group_id,
      text: null,
      hour: null,
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear()
    }
    ctx.replyWithMarkdown('\`Створення оголошення\`\nНапишіть мені, будь ласка, текст вашого оголошення:')
    ctx.wizard.selectStep(2)
  },
  (ctx) => {
    if(ctx.message.text) {
      const date = new Date()
      const split = ctx.message.text.split(' ')
      const day = parseInt(split[0])
      const month = parseInt(split[1])<13 ? parseInt(split[1])-1 : date.getMonth()
      const year = parseInt(split[2]) || date.getFullYear()
      if(day >=0 && day <= 31 && month >= 0 && month <= 11 && year >= date.getFullYear()) {
        ctx.session.announce.day = day
        ctx.session.announce.month = month
        ctx.session.announce.year = year
        const keyboard = []
        for(let i=0; i<24; i++) keyboard.push(i.toString().length>1 ? i.toString() : '0'+i.toString())
        keyboard.push('«')
        ctx.replyWithMarkdown('\`Створення оголошення\`\nОберіть необхідний вам час:\n« - для вибору дня',
          Markup.keyboard(keyboard, { columns: 4 }).resize().extra())
        ctx.wizard.selectStep(3)
      } else ctx.replyWithMarkdown('\`Створення оголошення\`\nПомилка. Я вас не зрозумів!')
    }
  },
  (ctx) => {
    const msg = ctx.message
    if(msg.text) {
      ctx.session.announce.text = ctx.message.text
      const keyboard = []
      for(let i=0; i<24; i++) keyboard.push(i.toString().length>1 ? i.toString() : '0'+i.toString())
      keyboard.splice(0, new Date().getHours())
      keyboard.push('«')
      ctx.replyWithMarkdown('\`Створення оголошення\`\nОберіть необхідний вам час:\n« - для вибору дня',
        Markup.keyboard(keyboard, { columns: 4 }).resize().extra())
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('\`Створення оголошення\`\nПомилка. Оголошення може бути тільки у вигляді тексту!')
  },
  (ctx) => {
    let hour = parseInt(ctx.message.text)
    if(hour >= 0 && hour <= 23) {
      ctx.session.announce.hour = hour
      hour = hour.toString().length > 1 ? hour.toString() : '0'+hour.toString()
      const keyboard = []
      for(let i=0; i<60; i+=15) keyboard.push(i.toString().length>1 ? hour+':'+i.toString() : hour+':'+'0'+i.toString())
      keyboard.push('«')
      ctx.replyWithMarkdown('\`Створення оголошення\`\nОберіть необхідний вам час:\n« - для вибору дня',
        Markup.keyboard(keyboard, { columns: 4 }).resize().extra())
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('\`Створення оголошення\`\nПомилка. Я вас не зрозумів!')
  },
  (ctx) => {
    if(ctx.message.text) {
      const { group_id, text, hour, day, month, year } = ctx.session.announce
      const split = ctx.message.text.split(':')
      const min = parseInt(split[1] ? split[1] : split[0])
      if(min >= 0 && min <= 59) {
        const diff = new Date(year, month, day, hour, min) - new Date()
        if(diff > 0) {
          const announcent = { group_id : group_id, text : text, min : min, hour : hour, day : day, month : month, year : year }
          Announcements.create(announcent).then(({ _id }) => {
            if(diff < 864e5) Views.announcement(_id, group_id, text, diff, ctx.telegram)
            ctx.replyWithMarkdown(`\`Створення оголошення\`\nУспіх! Оголошення створено.\nВоно буде відправлено в бесіду о\` ${
              ('0'+hour).slice(-2) }:${ ('0'+min).slice(-2) } ${ ('0'+day).slice(-2) }/${ ('0'+(month+1)).slice(-2) }/${ year }\``, Extra.markup((m) => m.removeKeyboard()))
          }).catch(err => console.error(err))
        } else ctx.replyWithMarkdown('\`Створення оголошення\`\nПомилка. Спроба створити оголошення в минуле', Extra.markup((m) => m.removeKeyboard()))
        ctx.scene.leave()
      } else ctx.replyWithMarkdown('\`Створення оголошення\`\nПомилка. Я вас не зрозумів!')
    }
  }
)
announce.hears('«', ctx => {
  if(ctx.session.announce.text) {
    ctx.replyWithMarkdown('\`Створення оголошення\`\nЗапишіть бажаний день в форматі:\` ДД ММ РРРР\`', Extra.markup((m) => m.removeKeyboard()))
    ctx.wizard.selectStep(1)
  } else ctx.replyWithMarkdown('\`Створення оголошення\`\nПомилка. Необхідно ввести текст оголошення!')
})
announce.leave(ctx => {
  ctx.session.announce = undefined
})
announce.command('cancel', ctx => {
  ctx.reply('Процес добавлення оголошення було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// REQUISITES
const requisites = new Scene('requisites')

requisites.enter(async ctx => {
  const user = ctx.message.from
  const { group_id } = await Groups.findOne({ admin_id: user.id })
  const req = (await Requisites.findOne({  group_id: group_id })) || {
    group_id: group_id,
    message: `Прошу передати гроші особисто мені - ${ user.first_name } ${ user.last_name || '' }`
  }
  ctx.session.requisites = req
  ctx.replyWithMarkdown(`\`Налаштування реквізитів\n   \`Ви можете вказати вигляд закінчення кожного повідомлення про збір коштів (текст, номер банківської картки).\n\`   \`Вигляд на даний момент:\n\`❕${
    req.message}\`\n/done \`- для збереження\``)
})
requisites.command('done', ctx => {
  const { group_id, message } = ctx.session.requisites
  Requisites.update({ group_id: group_id }, {
    group_id: group_id,
    message: message
  }, { upsert: true })
    .then(() => ctx.replyWithMarkdown(`\`Налаштування реквізитів\`\nРеквізити успішно налаштовано!`))
    .catch(err => ctx.replyWithMarkdown(`\`Налаштування реквізитів\`\nВідбула помилка при налаштуванні реквізитів. Спробуйте пізніше.`))
  ctx.scene.leave()
})
requisites.command('cancel', ctx => {
  ctx.reply('Процес добавлення реквізитів було перервано.')
  ctx.scene.leave()
})
requisites.on('text', ctx => {
  ctx.session.requisites.message = ctx.message.text
  ctx.replyWithMarkdown(`\`Налаштування реквізитів\n   \`Ви можете вказати вигляд закінчення кожного повідомлення про збір коштів (текст, номер банківської картки).\n\`   \`Вигляд на даний момент:\n\`❕${
    ctx.message.text}\`\n/done \`- для збереження\``)
  })
requisites.leave(ctx => ctx.session.requisites = undefined)

// MONEY
const money = new Scene('money')

money.enter(async ctx => {
  const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
  const req = await Requisites.findOne({ group_id: group_id })
  if(req) {
    ctx.session.money = {
      group_id: group_id,
      message: req.message,
      card: req.card
    }
    ctx.replyWithMarkdown('Введіть причину збору коштів та суму:')
  } else ctx.scene.enter('requisites')
})
money.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес було перервано.')
  ctx.scene.leave()
})
money.on('text', ctx => {
  const { group_id, message } = ctx.session.money
  const text = ctx.message.text
  ctx.telegram.sendMessage(group_id, `\`Збір коштів 📢\`\n${ text }\n\`❕${ message }\``, Extra.markdown()).then(() => {
    ctx.reply('Повідомлення успішно відправлено!')
    ctx.scene.leave()
  })
})
money.leave(ctx => ctx.session.money = undefined)

// ADDUSER
const adduser = new Scene('adduser')

adduser.enter(async ctx => {
  const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
  ctx.session.adduser = { group_id: group_id }
  ctx.replyWithMarkdown('Введіть, будь ласка, інформацію про людину (ПІБ, дата народження, стать) в наступному форматі:\n\`Прізвище Ім\'я та по Батькові ДД ММ РРРР Ч/Ж\`')
})
adduser.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес добавлення користувача було перервано.')
  ctx.scene.leave()
})
adduser.on('text', ctx => {
  const { group_id } = ctx.session.adduser
  const text = ctx.message.text.split(' ')
  if(text.length > 6) {
    const dob = [ parseInt(text[3]), parseInt(text[4]), parseInt(text[5]) ]
    if(dob[0] > 0 && dob[0] < 32 && dob[1] > 0 && dob[1] < 13 && dob[2] > 0 && dob[2] <= new Date().getFullYear()) {
      if(text[6] === 'Ж' || text[6] === 'Ч') {
        const sex = text[6] === 'Ч' ? true : false
        Users.create({
          group_id: group_id,
          first_name: text[1],
          last_name: text[0],
          middle_name: text[2],
          dob_day: dob[0],
          dob_month: dob[1],
          dob_year: dob[2],
          sex: sex
        }).then(() => {
          ctx.reply('Людину успішно добавлено!')
          ctx.scene.leave()
        })
      } else ctx.replyWithMarkdown('Вибачте, але я не зумів розпізнати стать (Ч/Ж)\n/cancel - для відміни')
    } else ctx.replyWithMarkdown('Вибачте, але я не зумів розпізнати дату народження\n/cancel - для відміни')
  } else ctx.replyWithMarkdown('Вибачте, але ви вказали неповну інформацію, необхідний формат:\n\`Прізвище Ім\'я та по Батькові ДД ММ РРРР Ч/Ж\`')
})
adduser.leave(ctx => ctx.session.adduser = undefined)

// DELUSER
const deluser = new Scene('deluser')

deluser.enter(async ctx => {
  const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
  const users = await Users.find({ group_id: group_id })
  ctx.session.deluser = {
    group_id: group_id,
    users: users
  }
  ctx.replyWithMarkdown('Виберіть людину, яку ви бажаєте витерти:',
    Markup.keyboard(users.map(({ first_name, last_name, middle_name }) => { return last_name+' '+first_name+' '+middle_name }), { columns: 1 }).resize().extra())
})
deluser.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес видалення користувача було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
deluser.on('text', ctx => {
  const { group_id, users } = ctx.session.deluser
  const text = ctx.message.text.split(' ')
  const user = users.find(u => text[0] === u.last_name && text[1] === u.first_name && u.middle_name === text[2])
  if(user) {
    Users.remove({ _id: user._id }).then(() => {
      ctx.reply('Користувача успішно видалено.', Extra.markup((m) => m.removeKeyboard()))
      ctx.scene.leave()
    })
  } else ctx.reply('Вибачте, але такого користувача немає!\n/cancel - для відміни')
})
deluser.leave(ctx => ctx.session.deluser = undefined)

// ABSENT
const absent = new WizardScene('absent',
  async (ctx) => {
    const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
    const users = await Users.find({ group_id: group_id })
    const day = new Date()
    ctx.session.absent = {
      group_id: group_id,
      day: ''+day.getFullYear()+('0'+(day.getMonth()+1)).slice(-2)+('0'+day.getDate()).slice(-2),
      lesson: null,
      absent: [],
      students: users.map(user => `${ user.last_name } ${ user.first_name }`)
    }
    ctx.replyWithMarkdown('Вкажіть необхідну пару:', Markup.keyboard([['0', '1', '2', '3', '4']]).resize().extra())
    ctx.wizard.next()
  },
  (ctx) => {
    const absent = ctx.session.absent
    const i = parseInt(ctx.message.text)
    if(i >= 0 && i <= 4) {
      absent.lesson = i
      ctx.replyWithMarkdown('Виберіть відсутнього студента:', Markup.keyboard(absent.students, { columns: 2 }).resize().extra())
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Вкажіть необхідну пару (від 0 до 4):')
  },
  async (ctx) => {
    const absent = ctx.session.absent
    const user = ctx.message.text.split(' ')
    const student = await Users.findOne({ group_id: absent.group_id, first_name: user[1], last_name: user[0] })
    if(student) {
      absent.absent.push(student._id)
      absent.students.splice(absent.students.indexOf(user[0]+' '+user[1]),1)
      ctx.replyWithMarkdown('Студента успішно відмічено.\n/done \`- для збереження\`', Markup.keyboard(absent.students, { columns: 2 }).resize().extra())
    } else ctx.replyWithMarkdown('Вибачте, але я не знайшов такого студента')
  }
)
absent.leave(ctx => {
  ctx.session.absent = undefined
})
absent.command('done', ctx => {
  const absent = ctx.session.absent
  if(absent.absent.length > 0)
    Visiting.create({
      group_id: absent.group_id,
      day: absent.day,
      lesson: absent.lesson,
      absent: absent.absent
    }).then(() => ctx.reply('Успіх! Відсутніх студентів відмічено.', Extra.markup((m) => m.removeKeyboard())))
      .catch(() => ctx.reply('Помилка. Щось пішло не так.', Extra.markup((m) => m.removeKeyboard())))
  ctx.scene.leave()
})
absent.command('cancel', ctx => {
  ctx.reply('Процес відмітки відсутніх було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// VISITING
const visiting = new WizardScene('visiting',
  async (ctx) => {
    const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
    const users = await Users.find({ group_id: group_id })
    ctx.session.visiting = { group_id: group_id }
    ctx.replyWithMarkdown('Оберіть бажаного студента:',
      Markup.keyboard(users.map(user => `${ user.last_name } ${ user.first_name }`), { columns: 2 }).resize().extra())
    ctx.wizard.next()
  },
  async (ctx) => {
    const visiting = ctx.session.visiting
    const user = ctx.message.text.split(' ')
    const student = await Users.findOne({ group_id: visiting.group_id, first_name: user[1], last_name: user[0] })
    if(student) {
      const day = new Date()
      const message = [ `Студент, ${ user[0] } ${ user[1] }`, '\`Пара | 0 | 1 | 2 | 3 | 4 |\`', '\`--------------------------\`' ]
      const stack = {}
      let offset = (day.getDay() || 1)-1
      // if(date.getHour() < 16) offset--

      const to = parseInt(''+day.getFullYear()+('0'+(day.getMonth()+1)).slice(-2)+('0'+day.getDate()).slice(-2))
      const from = to - offset

      const absent = await Visiting.find({ group_id: visiting.group_id, day: { $gt: from-1, $lt: to+1 }, absent: { $in: student._id } })
      absent.forEach(e => stack[e.day] ? stack[e.day].push(e.lesson) : stack[e.day] = [e.lesson] )
      Object.entries(stack).sort((a, b) => b[0]-a[0]).forEach(d => message.push(`\`${ d[0].slice(4, 6)+'/'+d[0].slice(6,8) }| ${ [0,1,2,3,4].map(n => stack[d[0]].indexOf(n) === -1 ? ' ' : 'н').join(' | ') } |\``))
      message.push(`Всього пропустив: ${ absent.length } ${ absent.length > 4 || absent.length === 0 ? 'занять' : 'заняття' }`)
      message.push(`За період від ${ (''+from).slice(4, 6)+'/'+(''+from).slice(6,8) } до ${ (''+to).slice(4, 6)+'/'+(''+to).slice(6,8) }`)
      ctx.replyWithMarkdown(message.join('\n'), Extra.markup((m) => m.removeKeyboard()))
      ctx.scene.leave()
    } else ctx.replyWithMarkdown('Вибачте, але я не знайшов такого студента')
  }
)
visiting.leave(ctx => {
  ctx.session.visiting = undefined
})
visiting.command('cancel', ctx => {
  ctx.reply('Процес створення звіту відвідування було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// ADDPARENTS
const addparents = new WizardScene('addparents',
  async (ctx) => {
    const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
    const users = await Users.find({ group_id: group_id })
    ctx.session.addparents = { group_id: group_id }
    ctx.replyWithMarkdown('Оберіть бажаного студента:',
      Markup.keyboard(users.map(user => `${ user.last_name } ${ user.first_name }`), { columns: 2 }).resize().extra())
    ctx.wizard.next()
  },
  async (ctx) => {
    const addparents = ctx.session.addparents
    const user = ctx.message.text.split(' ')
    const student = await Users.findOne({ group_id: addparents.group_id, first_name: user[1], last_name: user[0] })
    const parents = await Parents.find({ group_id: addparents.group_id, user_id: student._id })
    if(student) {
      ctx.session.addparents.student = student
      ctx.replyWithMarkdown(`Запишіть дані в наступному форматі:\` Ім\'я - номер_телефону\`\n${ ''
    }Ви можете внести дані про декількох рідних студента (кожна людина із нового рядка)\nДля видалення номеру телефону конкретної людини запишіть \`Ім\'я\`${
    parents[0] ? `\nДані про рідних на даний момент:\n\`${ parents.map(p => `${ p.name } - ${ p.number }`).join('\n') }\`` : ''
    }\n/cancel - \`для відміни\``,
        Extra.markup((m) => m.removeKeyboard()))
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Вибачте, але я не знайшов такого студента')
  },
  async (ctx) => {
    const text = ctx.message.text
    const addparents = ctx.session.addparents
    const stack = ['\`Статус:\`']
    if(text) {
      const parents = ctx.message.text.split('\n')
      for(let p of parents) {
        const d = p.split(' - ')
        if(d[1] && parseInt(d[1]) && d[1].length === 10) {
          Parents.create({
            group_id: addparents.group_id,
            user_id: addparents.student._id,
            name: d[0].trim(),
            number: +('38'+d[1])
          })
          stack.push(`${ d[0] }: успішно добавлено`)
        } else if(!d[1]) {
          const { n } = await Parents.remove({
            group_id: addparents.group_id,
            user_id: addparents.student._id,
            name: d[0].trim()
          })
          if(n) stack.push(`${ d[0] }: успішно видалено`)
        } else stack.push(`${ d[0] }: помилка в номері телефону (потрібно 10 цифр)`)
      }
      if(!stack[1]) stack.push('Жодних змін не відбулося.')
      ctx.replyWithMarkdown(stack.join('\n'), Extra.markup((m) => m.removeKeyboard()))
      ctx.scene.leave()
    } else ctx.replyWithMarkdown('Я приймаю виключно *текст*!')
  }
)
addparents.leave(ctx => {
  ctx.session.addparents = undefined
})
addparents.command('cancel', ctx => {
  ctx.reply('Процес добавлення мобільних телефонів рідних студента було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// BADGRADE
const badgrade = new WizardScene('badgrade',
  async (ctx) => {
    const { group_id } = await Groups.findOne({ admin_id: ctx.message.from.id })
    const users = await Users.find({ group_id: group_id })
    ctx.session.badgrade = { group_id: group_id }
    ctx.replyWithMarkdown('Оберіть бажаного студента:',
      Markup.keyboard(users.map(user => `${ user.last_name } ${ user.first_name }`), { columns: 2 }).resize().extra())
    ctx.wizard.next()
  },
  async (ctx) => {
    const badgrade = ctx.session.badgrade
    const user = ctx.message.text.split(' ')
    const student = await Users.findOne({ group_id: badgrade.group_id, first_name: user[1], last_name: user[0] })
    if(student) {
      badgrade.student = { _id: student._id, first_name: student.first_name, last_name: student.last_name, sex: student.sex }
      const schedule = await Schedules.findOne({ group_id: badgrade.group_id })
      if(schedule.schedule.find(day => day.find(sub => sub))) {
        const day = new Date().getDay
        const keyboard = day > 0 && day < 6 ? schedule.schedule[day-1].filter(e => e) : schedule.subjects
        ctx.replyWithMarkdown('Оберіть предмет або напишіть його самостійно:',
          Markup.keyboard(keyboard, { columns: 2 }).oneTime().resize().extra())
      } else ctx.replyWithMarkdown('Вкажіть предмет:', Extra.markup((m) => m.removeKeyboard()))
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Вибачте, але я не знайшов такого студента')
  },
  async (ctx) => {
    const badgrade = ctx.session.badgrade
    if(ctx.message.text) {
      badgrade.lesson = ctx.message.text
      const parents = await Parents.find({ group_id: badgrade.group_id, user_id: badgrade.student })
      if(parents[0]) {
        badgrade.hasparent = true
        badgrade.parents = parents.map(p => p.number)
        ctx.replyWithMarkdown('Оберіть кому відправити смс:',
          Markup.keyboard(parents.map(p => p.name).concat('❗️ УСІМ ❗️'), { columns: 2 }).resize().extra())
      } else ctx.replyWithMarkdown('Напишіть телефонний номер отримувача:', Extra.markup((m) => m.removeKeyboard()))
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Я приймаю виключно *текст*!')
  },
  async (ctx) => {
    const badgrade = ctx.session.badgrade
    const text = ctx.message.text
    if(text) {
      if(badgrade.hasparent) {
        if(text === '❗️ УСІМ ❗️') badgrade.toall = true
        else {
          const parent = await Parents.findOne({ group_id: badgrade.group_id, user_id: badgrade.student, name: text })
          if(parent) badgrade.parent = [ parent.number ]
          else ctx.replyWithMarkdown('Помилка. Я не знайшов таку людину.')
        }
      } else {
        if(parseInt(text) && text.length === 10) badgrade.parent = [ +('38'+text) ]
        else ctx.replyWithMarkdown('Помилка в номері телефону (потрібно 10 цифр).')
      }
      const to = badgrade.toall ? badgrade.parents : badgrade.parent
      if(to && to[0]) {
        const msg = `Студент${ badgrade.student.sex ? '' : 'ка' } ${ badgrade.student.last_name } ${
          badgrade.student.first_name } отрима${ badgrade.student.sex ? 'в' : 'ла' } 2 з предмету ${ badgrade.lesson }`.slice(0, 70)
        Sms.send(to, msg)
          .then(ids => {
            GroupSms.create({ group_id: badgrade.group_id, message_ids: ids, to: to, text: msg })
            ctx.reply('СМС успішно відправлено!', Extra.markup((m) => m.removeKeyboard()))
          }).catch(err => ctx.reply(`Error: ${ err.message || err }`, Extra.markup((m) => m.removeKeyboard())))
        ctx.scene.leave()
      }
    } else ctx.replyWithMarkdown('Я приймаю виключно *текст*!')
  }
)
badgrade.leave(ctx => {
  ctx.session.badgrade = undefined
})
badgrade.command('cancel', ctx => {
  ctx.reply('Процес відправки смс було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

_Stage.register(reg, poll, schedule, homework, announce, requisites, money, adduser, deluser, absent, visiting, addparents, badgrade)



export default _Stage
