import WizardScene from 'telegraf/scenes/wizard'
import Scene from 'telegraf/scenes/base'
import Markup from 'telegraf/markup'
import Stage from 'telegraf/stage'
import Extra from 'telegraf/extra'
import Watcher from './watcher'
import Sms from './sms'

import { Groups, Polls, Schedules, Announcements, Requisites, Users, Visiting, Parents, GroupSms, Cources, Docs, TeacherSchedule, Links } from './models'

const _Stage = new Stage()

//GET GROUP
const getgroup = new Scene('getgroup')

getgroup.enter(async ctx => {
  const getgroup = ctx.session.getgroup
  if(getgroup) {
    const groups = await Groups.find({ admins: getgroup.user_id })
    if('type' in getgroup) groups.filter(g => g.type === type)
    getgroup.groups = groups
    ctx.reply('Виберіть, будь ласка, необхідну бесіду:',
      Markup.keyboard(groups.map(({ group_title }) => group_title), { columns: 2 }).resize().extra())
  } else {
    ctx.reply('Відбулась невідома помилка. Спробуйте, будь ласка, ще раз.')
    ctx.scene.leave()
  }
})
getgroup.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес вибору бесіди було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
getgroup.on('text', ctx => {
  const getgroup = ctx.session.getgroup
  const group = getgroup.groups.find(g => g.group_title === ctx.message.text)
  if(group) {
    ctx.replyWithMarkdown(`Обрана бесіда - \`${ ctx.message.text }\``, Extra.markup((m) => m.removeKeyboard()))
    const next = getgroup.next.split('|')
    if(next[1]) getgroup.next = group.type ? next[0] : next[1]
    ctx.scene.enter(getgroup.next)
    ctx.session[getgroup.next] = { group_id: group.group_id }
  } else ctx.reply('Вибачте, але я не знайшов дану бесіду')
})
getgroup.leave(ctx => ctx.session.getgroup = undefined)

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
    Object.assign(ctx.session.newpoll, {
      user_id: from.id,
      title: text,
      answers: [],
      voters: []
    })
    ctx.reply('Добре, а тепер напишіть мені варіанти відповідей (кожне у окремому повідомленні).')
    ctx.wizard.next()
  },
  async (ctx) => {
    const poll = ctx.session.newpoll
    const msg = ctx.message
    const length = ctx.session.newpoll.answers.length
    if(msg.text === '/done' || length > 6) {
      if(length > 6) poll.answers.push({ text: msg.text, votes: 0 })
      if(length < 2) ctx.reply('Необхідно мінімум два варіанти відповідей.')
      else {
        ctx.telegram.sendMessage(poll.group_id,
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
    } else {
      ctx.session.newpoll.answers.push({ text: msg.text, votes: 0 })
      ctx.replyWithMarkdown(`Відповідь успішно добавлена.${ length > 5 ? `\nВи можете добавити ще один варіант відповіді \`(7/8)\`` : `` }\n/done \`- для закінчення\``)
    }
  }
)
poll.leave(ctx => ctx.session.newpoll = undefined)
poll.command('cancel', ctx => {
  ctx.reply('Процес створення нового голосування було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// SCHEDULE
const schedule = new Scene('schedule')

schedule.enter(async ctx => {
  const group_id = ctx.session.schedule.group_id
  const schedule = await Schedules.findOne({ group_id: group_id })
  Object.assign(schedule, {
    group_id: group_id,
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
    const group_id = ctx.session.homework.group_id
    const schedule = await Schedules.findOne({ group_id: group_id })
    if(!schedule.schedule.find(day => day.find(sub => sub))) {
      ctx.scene.leave()
      ctx.replyWithMarkdown(`Вибачте, але ви не заповнили *розклад*.`)
    } else {
      Object.assign(schedule, {
        group_id: group_id,
        emoji: [ '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣' ],
        days: [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ],
        text: [],
        media: []
      })
      ctx.session.homework = schedule
      ctx.replyWithMarkdown('Надішліть мені, будь ласка, завдання та/або фото')
      ctx.wizard.next()
    }
  },
  (ctx) => {
    const msg = ctx.message
    const { schedule, text, media, subjects } = ctx.session.homework
    if(msg.text === '/done') {
      ctx.reply('Вкажіть потрібний предмет:',
        Markup.keyboard(subjects, { columns: 3 }).oneTime().resize().extra())
      ctx.wizard.next()
    } else if(msg.text || msg.photo) {
      let added = false
      if(msg.text) text.push(msg.text)
      else if(media.length < 10) {
        media.push(msg.photo.pop().file_id)
        added = true
      }
      const length = media.length
      ctx.replyWithMarkdown(`\`Успіх!\`\n${ msg.text || added ? `Дані додано` : `Медіа не добавлено`}${
        length > 8 ? `. Медіа ${ length }/10` : `` }\n/done\` - для закінчення\``)
    } else ctx.replyWithMarkdown('Я приймаю виключно *текст* або *фото*!')
  },
  (ctx) => {
    const homework = ctx.session.homework
    const { days, subjects } = homework
    if(homework.subjects.includes(ctx.message.text)) {
      const _day = new Date().getDay()
      const day = _day > 0 || _day < 6 ? _day-1 : 0
      const _days = days.slice(day+1).concat(days.slice(0, day+1))
      homework.schedule = homework.schedule.concat(homework.schedule.splice(0, day+1))
      const keyboard = []
      homework.schedule.forEach((day, dayname) =>
        day.forEach((sub, n) => { if(sub === ctx.message.text) keyboard.push(`${ ctx.session.homework.emoji[n] } ${ _days[dayname] }`)}))
      ctx.reply('Вкажіть котру пару ви бажаєте обрати: ',
        Markup.keyboard(keyboard, { columns: 2 }).resize().extra())
      ctx.wizard.next()
    } else ctx.reply('Хмм.. Такого предмету немає.')
  },
  (ctx) => {
    const { group_id, emoji, days, schedule, text, media } = ctx.session.homework
    const n = emoji.indexOf(ctx.message.text.slice(0, 3))
    if(n !== -1) {
      const day = days.indexOf(ctx.message.text.slice(4))
      if(day !== -1) {
        Schedules.update({ group_id: group_id } , {
          [`homework.${ day }.${ n }`]: { text: text, media: media }
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
homework.leave(ctx => ctx.session.homework = undefined)
homework.command('cancel', ctx => {
  ctx.reply('Процес добавлення домашньої роботи було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// ANNOUNCE
const announce = new WizardScene('announce',
  async (ctx) => {
    const date = new Date()
    const group_id = ctx.session.announce.group_id
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
            if(diff < 864e5) Watcher.sendAnnouncement(_id, group_id, text, diff)
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
  const group_id = ctx.session.requisites.group_id
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
  const group_id = ctx.session.money.group_id
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
const adduser = new WizardScene('adduser',
  (ctx) => {
    ctx.replyWithMarkdown('Введіть, будь ласка, інформацію про людину (ПІБ, дата народження, стать) в наступному форматі:\n\`Прізвище Ім\'я та по Батькові ДД ММ РРРР Ч/Ж\`')
    ctx.wizard.next()
  },
  (ctx) => {
    const adduser = ctx.session.adduser
    const text = ctx.message.text.split(' ')
    if(text.length > 6) {
      const dob = [ parseInt(text[3]), parseInt(text[4]), parseInt(text[5]) ]
      if(dob[0] > 0 && dob[0] < 32 && dob[1] > 0 && dob[1] < 13 && dob[2] > 0 && dob[2] <= new Date().getFullYear()) {
        if(text[6] === 'Ж' || text[6] === 'Ч') {
          const sex = text[6] === 'Ч' ? true : false
          Object.assign(adduser, {
            first_name: text[1],
            last_name: text[0],
            middle_name: text[2],
            dob_day: dob[0],
            dob_month: dob[1],
            dob_year: dob[2],
            sex: sex
          })
          ctx.replyWithMarkdown('Тепер надішліть мені, будь ласка, посилання на *користувача*:\n/skip \`- щоб пропустити цей крок\`')
          ctx.wizard.next()
        } else ctx.replyWithMarkdown('Вибачте, але я не зумів розпізнати стать (Ч/Ж)\n/cancel - для відміни')
      } else ctx.replyWithMarkdown('Вибачте, але я не зумів розпізнати дату народження\n/cancel - для відміни')
    } else ctx.replyWithMarkdown('Вибачте, але ви вказали неповну інформацію, необхідний формат:\n\`Прізвище Ім\'я та по Батькові ДД ММ РРРР Ч/Ж\`')
  },
  async (ctx) => {
    const adduser = ctx.session.adduser
    if(ctx && ctx.message.contact) {
      adduser.user_id = ctx.message.contact.user_id
      if(adduser.user_id) {
        const user = await Users.findOne({ group_id: adduser.group_id, user_id: adduser.user_id })
        if(!user) ctx.wizard.steps[3](ctx)
        else ctx.replyWithMarkdown('Даний користувач вже є *зареєстрованим* у вашій бесіді!\n/skip \`- щоб пропустити цей крок\`')
      } else ctx.replyWithMarkdown('Я не побачив \`ID\` користувача. Таке зазвичай стається, коли телефонний номер контакту не починається із +380.\n/skip \`- щоб пропустити цей крок\`')

    } else ctx.replyWithMarkdown('В повідомленні відсутнє посилання на контакт.\n/skip \`- щоб пропустити цей крок\`')
  },
  (ctx) => {
    const adduser = ctx.session.adduser
    Users.create({
      group_id: adduser.group_id,
      first_name: adduser.first_name,
      last_name: adduser.last_name,
      middle_name: adduser.middle_name,
      dob_day: adduser.dob_day,
      dob_month: adduser.dob_month,
      dob_year: adduser.dob_year,
      sex: adduser.sex,
      user_id: adduser.user_id
    }).then(() => ctx.replyWithMarkdown('Користувача *успішно* добавлено'))
      .catch(() => ctx.replyWithMarkdown('Відбулась помилка при добавленні користувача. Спробуйте, будь ласка, пізніше'))
      .then(() => ctx.scene.leave())
  }
)
adduser.command('skip', ctx => {
  if(ctx.wizard.cursor === 2) ctx.wizard.steps[3](ctx)
})
adduser.command(['cancel', 'exit'], ctx => {
  ctx.reply('Процес добавлення користувача було перервано.')
  ctx.scene.leave()
})
adduser.leave(ctx => ctx.session.adduser = undefined)

// DELUSER
const deluser = new Scene('deluser')

deluser.enter(async ctx => {
  const group_id = ctx.session.deluser.group_id
  const users = await Users.find({ group_id: group_id })
  ctx.session.deluser = {
    group_id: group_id,
    users: users
  }
  if(users[0])
    ctx.replyWithMarkdown('Виберіть людину, яку ви бажаєте витерти:\n/cancel - \`для відміни\`',
      Markup.keyboard(users.map(({ first_name, last_name, middle_name }) => { return last_name+' '+first_name+' '+middle_name }), { columns: 1 }).resize().extra())
  else {
    ctx.replyWithMarkdown('У вас відсутня інформація про студентів.\n/adduser - \`щоб добавити її\`')
    ctx.scene.leave()
  }
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
    const group_id = ctx.session.absent.group_id
    const users = await Users.find({ group_id: group_id })
    if(users[0]) {
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
    } else {
      ctx.replyWithMarkdown('У вас відсутня інформація про студентів.\n/adduser - \`щоб добавити її\`')
      ctx.scene.leave()
    }
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
    const group_id = ctx.session.visiting.group_id
    const users = await Users.find({ group_id: group_id })
    if(users[0]) {
      ctx.session.visiting = { group_id: group_id }
      ctx.replyWithMarkdown('Оберіть бажаного студента:',
        Markup.keyboard(users.map(user => `${ user.last_name } ${ user.first_name }`), { columns: 2 }).resize().extra())
      ctx.wizard.next()
    } else {
      ctx.replyWithMarkdown('У вас відсутня інформація про студентів.\n/adduser - \`щоб добавити її\`')
      ctx.scene.leave()
    }
  },
  async (ctx) => {
    const visiting = ctx.session.visiting
    const user = ctx.message.text.split(' ')
    const student = await Users.findOne({ group_id: visiting.group_id, first_name: user[1], last_name: user[0] })
    if(student) {
      const day = new Date()
      const message = [ `Студент, ${ user[0] } ${ user[1] }`, '\`Пара | 0 | 1 | 2 | 3 | 4 |\`', '\`--------------------------\`' ]
      const stack = {}

      const to = parseInt(''+day.getFullYear()+('0'+(day.getMonth()+1)).slice(-2)+('0'+day.getDate()).slice(-2))
      day.setDate(day.getDate()-7)
      const from = parseInt(''+day.getFullYear()+('0'+(day.getMonth()+1)).slice(-2)+('0'+day.getDate()).slice(-2))

      const absent = await Visiting.find({ group_id: visiting.group_id, day: { $gt: from-1, $lt: to+1 }, absent: { $in: student._id } })
      if(absent[0]) {
        absent.forEach(e => stack[e.day] ? stack[e.day].push(e.lesson) : stack[e.day] = [e.lesson] )
        Object.entries(stack).sort((a, b) => b[0]-a[0]).forEach(d => message.push(`\`${ d[0].slice(4, 6)+'/'+d[0].slice(6,8) }| ${ [0,1,2,3,4].map(n => stack[d[0]].indexOf(n) === -1 ? ' ' : 'н').join(' | ') } |\``))
        message.push(`Всього пропущено: ${ absent.length } ${ absent.length > 4 || absent.length === 0 ? 'занять' : 'заняття' }`)
        message.push(`За період від ${ Object.keys(stack).shift().slice(4, 6)+'/'+Object.keys(stack).shift().slice(6,8) } до ${
          Object.keys(stack).pop().slice(4, 6)+'/'+Object.keys(stack).pop().slice(6,8) }`)
      } else message.push('Інформація відсутня')
      ctx.reply('Готово!', Extra.markup((m) => m.removeKeyboard()))
        .then(() => ctx.replyWithMarkdown(message.join('\n'), Extra.markup(m => m.inlineKeyboard([
          m.callbackButton('<<', 'visiting-skipleft'),
          m.callbackButton('<', 'visiting-left'),
          m.callbackButton('🏠', 'visiting-home'),
          m.callbackButton('>', 'visiting-right'),
          m.callbackButton('>>', 'visiting-skipright')]
      ))))
      ctx.scene.leave()
      ctx.session.visiting = {
        group_id: visiting.group_id,
        student: student,
        offset: 0
      }
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
    const group_id = ctx.session.addparents.group_id
    const users = await Users.find({ group_id: group_id })
    if(users[0]) {
      ctx.session.addparents = { group_id: group_id }
      if(users[0])
        ctx.replyWithMarkdown('Оберіть бажаного студента:',
          Markup.keyboard(users.map(user => `${ user.last_name } ${ user.first_name }`), { columns: 2 }).resize().extra())
      ctx.wizard.next()
    } else {
      ctx.replyWithMarkdown('У вас відсутня інформація про студентів.\n/adduser - \`щоб добавити її\`')
      ctx.scene.leave()
    }
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

// BAD GRADE
const badgrade = new WizardScene('badgrade',
  async (ctx) => {
    const group_id = ctx.session.badgrade.group_id
    const users = await Users.find({ group_id: group_id })
    if(users[0]) {
      ctx.session.badgrade = { group_id: group_id }
      ctx.replyWithMarkdown('Оберіть бажаного студента:',
        Markup.keyboard(users.map(user => `${ user.last_name } ${ user.first_name }`), { columns: 2 }).resize().extra())
      ctx.wizard.next()
    } else {
      ctx.replyWithMarkdown('У вас відсутня інформація про студентів.\n/adduser - \`щоб добавити її\`')
      ctx.scene.leave()
    }
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
        const keyboard = parents.map(p => p.name)
        ctx.replyWithMarkdown('Оберіть кому відправити смс:',
          Markup.keyboard(keyboard[1] ? keyboard.concat('❗️ УСІМ ❗️') : keyboard, { columns: 2 }).resize().extra())
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
badgrade.leave(ctx => ctx.session.badgrade = undefined)
badgrade.command('cancel', ctx => {
  ctx.reply('Процес відправки смс було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})

// DEL SCHEDULE
const delschedule = new Scene('delschedule')

delschedule.enter(ctx => {
  const empty = [ undefined, undefined, undefined, undefined, undefined ]
  Schedules.update({ group_id: ctx.session.delschedule.group_id }, {
    schedule: [ empty, empty, empty, empty, empty ],
    homework: [ empty, empty, empty, empty, empty ]
  }).then(() => ctx.replyWithMarkdown(`Розклад успішно очищено.`))
  ctx.scene.leave()
})
delschedule.leave(ctx => ctx.session.delschedule = undefined)

// SMS STATUS
const smsstatus = new Scene('smsstatus')

smsstatus.enter(async ctx => {
  const group_id = ctx.session.smsstatus.group_id
  const messages = await GroupSms.find({ group_id: group_id }, null, { limit: 14, sort: '-date' })
  if(messages[0]) {
    const state = await Sms.state(messages.reduce((result, item) => { return result.concat(item.message_ids) }, []))
    const stack = [ 'Статус останніх 15-ти повідомлень:', '\`\`\`   КОМУ   | ДАТА  |   ПРО   |  СТАТУС' ]
    messages.forEach(m =>
      m.to.forEach((num, n) =>
        stack.push(`${ (''+num).slice(-10) }| ${ ('0'+(m.date.getMonth()+1)).slice(-2) }/${ ('0'+m.date.getDate()).slice(-2) } |${
          (m.text.split(' ')[1]+'         ').slice(0, 9)}|${ state[m.message_ids[n]] }`)
      ))
    ctx.replyWithMarkdown(stack.join('\n')+'\`\`\`')
  } else ctx.replyWithMarkdown('Ви не відправили *жодного* смс')
  ctx.scene.leave()
})
smsstatus.leave(ctx => ctx.session.smsstatus = undefined)

// GROUP SCHEDULE
const groupschedule = new Scene('groupschedule')

groupschedule.enter(async ctx => {
  const group_id = ctx.message.chat.id
  const { schedule, homework } = await Schedules.findOne({ group_id: group_id })
  const images = [ '🎑', '🏞', '🌅', '🌄', '🌇', '🏙', '🌃', '🌌', '🌉', '🌁' ]
  const days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
  const _day = new Date().getDay()
  const hour = new Date().getHours()
  const day = _day > 0 && _day < 6 ? hour > 14 && _day < 5 ? _day : _day-1 : 0
  const str = schedule[day].map((sub, n) => { if(sub || n>0) return `${ n }) ${
    sub ? homework[day][n] ? `${ sub } \`-\` ${ homework[day][n].text.join(' \`-\` ') } ${
    homework[day][n].media.map(() => { return images[Math.floor(Math.random() * 10)]}).join('')}` : sub : `\`[вікно]\`` }` })
  if(!str[0]) str.shift()
  ctx.replyWithMarkdown(`\`Розклад - ${ days[day] }:\`\n${ str.join('\n') }`,
    Extra.markdown().markup(m => m.inlineKeyboard([
      m.callbackButton('💬', `schedule-${ day }-m`),
      m.callbackButton('Пн', `schedule-0`),
      m.callbackButton('Вт', `schedule-1`),
      m.callbackButton('Ср', `schedule-2`),
      m.callbackButton('Чт', `schedule-3`),
      m.callbackButton('Пт', `schedule-4`)]
    )))
  ctx.scene.leave()
})
groupschedule.leave(ctx => ctx.session.groupschedule = undefined)

// ADD GROUP
const addgroup = new WizardScene('addgroup',
  (ctx) => {
    ctx.replyWithMarkdown('Напишіть назву спеціальності:')
    ctx.wizard.next()
  },
  async (ctx) => {
    if(ctx.message.text) {
      const addgroup = ctx.session.addgroup
      addgroup.name = ctx.message.text
      const cources = (await Cources.find({ group_id: addgroup.group_id, name: addgroup.name })).map(c => c.cource)
      addgroup.keyboard = [ '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣' ].filter((k, n) => !cources.includes(n+1))
      if(!addgroup.keyboard[0]) {
        ctx.reply('До даної спеціальності вже створені усі курси.', Extra.markup((m) => m.removeKeyboard()))
        ctx.scene.leave()
      } else {
        ctx.replyWithMarkdown('Вкажіть необхідні курси:', Markup.keyboard([addgroup.keyboard]).resize().extra())
        ctx.wizard.next()
      }
    } else ctx.replyWithMarkdown('Я приймаю *лише* текст!')
  },
  (ctx) => {
    const addgroup = ctx.session.addgroup
    const index = addgroup.keyboard.indexOf(ctx.message.text)
    if(index !== -1) {
      Cources.create({
        group_id: addgroup.group_id,
        name: addgroup.name,
        cource: [ '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣' ].indexOf(addgroup.keyboard.splice(index, 1)[0])+1
      }).then(() => {
        if(!addgroup.keyboard[0]) {
          ctx.replyWithMarkdown('Групи *успішно* додані.', Extra.markup((m) => m.removeKeyboard()))
          ctx.scene.leave()
        } else ctx.replyWithMarkdown('Група *успішно* додана\n/done - для закінчення', Markup.keyboard([addgroup.keyboard]).resize().extra())
      }).catch(err => {
        ctx.reply('Помилка при створенні запису в базі даних, спробуйте, будь ласка, пізніше')
        ctx.scene.leave()
      })
    } else ctx.replyWithMarkdown('Вибачте, але я Вас не зрозумів.')
  }
)
addgroup.command('done', ctx => {
  ctx.reply('Операцію успішно завершено', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
addgroup.command('cancel', ctx => {
  ctx.reply('Процес добавлення групи було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
addgroup.leave(ctx => ctx.session.addgroup = undefined)

// DEL GROUP
const delgroup = new WizardScene('delgroup',
  async (ctx) => {
    const delgroup = ctx.session.delgroup
    const cources = await Cources.find({ group_id: delgroup.group_id })
    delgroup.cources = cources
    if(cources[0]) {
      ctx.replyWithMarkdown('Вкажіть назву спеціальності:\n/cancel - \`для відміни\`', Markup.keyboard([[...new Set(cources.map(c => c.name))]], { columns: 4 }).resize().extra())
      ctx.wizard.next()
    } else {
      ctx.replyWithMarkdown('Ви *не заповнили* інформацію про навчальні групи\n/addgroup - \`для заповнення\`')
      ctx.scene.leave()
    }
  },
  (ctx) => {
    const delgroup = ctx.session.delgroup
    const group = delgroup.cources.filter(c => c.name === ctx.message.text)
    if(group[0]) {
      delgroup.name = ctx.message.text
      const cources = group.map(g => g.cource)
      delgroup.keyboard = [ '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣' ].filter((k, n) => cources.includes(n+1))
      ctx.replyWithMarkdown('Вкажіть курс:', Markup.keyboard([delgroup.keyboard.concat('⬅️')]).resize().extra())
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Вибачте, але у Вас не створено даної групи')
  },
  (ctx) => {
    const delgroup = ctx.session.delgroup
    const index = delgroup.keyboard.indexOf(ctx.message.text)
    if(index !== -1) {
      Cources.remove({
        group_id: delgroup.group_id,
        name: delgroup.name,
        cource: [ '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣' ].indexOf(delgroup.keyboard.splice(index, 1)[0])+1
      }).then(async () => {
        if(delgroup.keyboard[0]) {
          ctx.replyWithMarkdown(`Групу ${ ctx.message.text }${ delgroup.name } *успішно* видалено`,
            Markup.keyboard([delgroup.keyboard.concat('⬅️')]).resize().extra())
        } else {
          const cources = (await Cources.find({ group_id: delgroup.group_id })).filter(c => c.name !== delgroup.name)
          if(cources[0]) {
            ctx.replyWithMarkdown('Вкажіть назву спеціальності:\n/cancel - \`для відміни\`', Markup.keyboard([[...new Set(cources.map(c => c.name))]], { columns: 4 }).resize().extra())
            ctx.wizard.selectStep(1)
          } else {
            ctx.replyWithMarkdown('Вся інформація про спеціальності була *витерта*', Extra.markup((m) => m.removeKeyboard()))
            ctx.scene.leave()
          }
        }
      }).catch(err => {
        ctx.replyWithMarkdown('Відбулась помилка при видаленні запису із бази даних', Extra.markup((m) => m.removeKeyboard()))
        ctx.scene.leave()
      })
    } else ctx.replyWithMarkdown('Вибачте, але я Вас не зрозумів')
  }
)
delgroup.hears('⬅️', ctx => {
  ctx.wizard.selectStep(0)
  ctx.wizard.steps[0](ctx)
})
delgroup.command('cancel', ctx => {
  ctx.reply('Процес видалення групи було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
delgroup.leave(ctx => ctx.session.delgroup = undefined)

// TDOCS
const tdocs = new WizardScene('tdocs',
  async (ctx) => {
    const tdocs = ctx.session.tdocs
    const user = await Users.findOne({ group_id: tdocs.group_id, user_id: ctx.message.from.id })
    if(user) {
      tdocs.user = user._id
      const data = await Docs.find({ group_id: tdocs.group_id, user_id: tdocs.user })
      if(data[0]) {
        const stack = [ 'Список вашого методичного забезпечення:' ]
        data.forEach((d, n) => stack.push(`${ n+1 })\` ${ d.name }\``))
        stack.push('Виберіть, будь ласка, яку процедуру ви бажаєте провести:')
        tdocs.data = data
        ctx.replyWithMarkdown(stack.join('\n'),
          Extra.markup((m) => m.keyboard([[ 'Добавити', 'Видалити', 'Вихід' ]]).resize()))
      }
      else ctx.replyWithMarkdown('Очевидно у вас немає жодних даних, ви можете легко їх *добавити*:',
        Extra.markup((m) => m.keyboard([[ 'Добавити', 'Вихід' ]]).resize()))
    } else {
      ctx.replyWithMarkdown('Вибачте, але ваш *обліковий запис* не знаходиться у нашій базі даних. Зверніться до адміністраторів *вашої* бесіди.')
      ctx.scene.leave()
    }
  },
  (ctx) => {
    const tdocs = ctx.session.tdocs
    if(!tdocs.files) {
      tdocs.files = [ ]
      ctx.replyWithMarkdown('Напишіть мені, будь ласка, назву документів та відправте їх.', Extra.markup((m) => m.removeKeyboard()))
    } else {
      if(ctx.message.text) {
        tdocs.name = ctx.message.text
        ctx.replyWithMarkdown(`Встановлена назва: \`${ tdocs.name }\``,
          Extra.markup((m) => m.keyboard(tdocs.files[0] ? [ 'Готово' ] : [ ]).resize()))
      } else if(ctx.message.document) {
        tdocs.files.push(ctx.message.document.file_id)
        ctx.replyWithMarkdown(`Добавлено файл: \`${ ctx.message.document.file_name }\``,
          Extra.markup((m) => m.keyboard(tdocs.name ? [ 'Готово' ] : [ ]).resize()))
      } else ctx.replyWithMarkdown('Файли повинні бути відправлені як *документи*!')
    }
  },
  (ctx) => {
    const tdocs = ctx.session.tdocs
    if(tdocs.data[0]) {
      ctx.replyWithMarkdown('Виберіть, будь ласка, котрий документ ви бажаєте витерти:',
        Extra.markup((m) => m.keyboard(tdocs.data.map(d => d.name)).resize()))
      ctx.wizard.next()
    } else {
      ctx.wizard.selectStep(0)
      ctx.wizard.steps[0](ctx)
    }
  },
  async (ctx) => {
    const tdocs = ctx.session.tdocs
    const doc = await Docs.findOne({ group_id: tdocs.group_id, user_id: tdocs.user, name: ctx.message.text })
    if(doc) {
      Docs.remove({ group_id: tdocs.group_id, user_id: tdocs.user, name: ctx.message.text })
        .then(() => ctx.replyWithMarkdown('Документ *успішно* видалено.', Extra.markup((m) => m.removeKeyboard())))
        .catch(() => {
          ctx.replyWithMarkdown('Відбулась *помилка* при видаленні документу.', Extra.markup((m) => m.removeKeyboard()))
          ctx.scene.leave()
        })
        .then(() => {
          ctx.wizard.selectStep(0)
          ctx.wizard.steps[0](ctx)
        })
    } else ctx.replyWithMarkdown('Вибачте, але я *не знайшов* даного документу в базі даних')
  }
)
tdocs.hears('Добавити', ctx => {
  ctx.wizard.selectStep(1)
  ctx.wizard.steps[1](ctx)
})
tdocs.hears('Видалити', ctx => {
  ctx.wizard.selectStep(2)
  ctx.wizard.steps[2](ctx)
})
tdocs.hears('Вихід', ctx => {
  ctx.reply('Ви успішно вийшли із даної процедури.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
tdocs.hears('Готово', ctx => {
  const tdocs = ctx.session.tdocs
  if(ctx.wizard.cursor === 1) {
    if(tdocs.name && tdocs.files[0]) {
      Docs.create({
        group_id: tdocs.group_id,
        user_id: tdocs.user,
        name: tdocs.name,
        files: tdocs.files
      }).then(() => ctx.replyWithMarkdown('Дані *успішно* добавлено!', Extra.markup((m) => m.removeKeyboard())))
        .catch(() => ctx.replyWithMarkdown('Відбулась *помилка* при створенні запису в базі даних.', Extra.markup((m) => m.removeKeyboard())))
        .then(() => ctx.scene.leave())
    } else if(!tdocs.name) ctx.replyWithMarkdown('Напишіть, будь ласка, *назву* документа')
      else if(!tdocs.files[0]) ctx.replyWithMarkdown('Ви не добавили *жодного* документа')
  }
})
tdocs.command('cancel', ctx => {
  ctx.reply('Процес було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
tdocs.leave(ctx => ctx.session.tdocs = undefined)

// TSCHEDULE
const tschedule = new WizardScene('tschedule',
  async (ctx) => {
    const sess = ctx.session.tschedule
    const users = await Users.find({ group_id: sess.group_id })
    const cources = await Cources.find({ group_id: sess.group_id })
    if(users[0]) {
      if(cources[0]) {
        sess.users = users
        sess.cources = cources
        ctx.replyWithMarkdown('Оберіть необхідного викладача:',
          Extra.markup((m) => m.keyboard(users.map(u => `${ u.last_name } ${ u.first_name } ${ u.middle_name }`)).resize()))
        ctx.wizard.next()
      } else {
        ctx.replyWithMarkdown('Ви не заповнили інформацію про студентські групи.\n/addgroup - \`для заповнення\`')
        ctx.scene.leave()
      }
    } else {
      ctx.replyWithMarkdown('Ви не заповнили інформацію про викладачів.\n/adduser - \`для заповнення\`')
      ctx.scene.leave()
    }
  },
  async (ctx) => {
    const sess = ctx.session.tschedule
    if(ctx.message.text) {
      if(!sess.user) {
        sess.n = 1
        sess.day = 0
        const input = ctx.message.text.split(' ')
        sess.user = sess.users.find(u => u.last_name === input[0] && u.first_name === input[1] && u.middle_name === input[2])
      }
      if(sess.user) {
        const schedule = (await TeacherSchedule.find({ group_id: sess.group_id, user_id: sess.user._id })).map(s => {
          const group = sess.cources.find(c => s.group.equals(c._id)) || {}
          return {
            group: s.group,
            group_name: group.name || '\`[видалено]\`',
            group_cource: group.cource || '\`?\`',
            day: s.day,
            lesson: s.lesson,
            periodic: s.periodic
          }
        })
        sess.days = [ 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця' ]
        const stack = new Array(5).fill().map(() => new Array(5).fill(null))
        schedule.forEach(s => {
          const group = `${ s.group_cource } ${ s.group_name }`
          stack[s.day][s.lesson] = !(s.periodic === undefined) ? s.periodic ? stack[s.day][s.lesson] ? [group].concat([stack[s.day][s.lesson][1]])
          : [group, null] : stack[s.day][s.lesson] ? [stack[s.day][s.lesson][0]].concat([group]) : [null, group] : group
        })
        stack.forEach((s, day) => s.forEach((st, n) => {
          if(st && typeof st === 'object') {
            stack[day][n] = stack[day][n].map(e => e || '\`[вікно]\`')
            stack[day][n] = stack[day][n].join(' / ')
          }
        }))
        sess.stack = stack
        await ctx.replyWithMarkdown('Користуйтесь *стрілками* для переміщення та *клавіатурою* для вибору груп',
          Extra.markup(m => m.keyboard([...new Set(sess.cources.map(c => c.name)), '[ ВІКНО ]', '[ / ]'], { columns: 4 }).resize()))
        ctx.replyWithMarkdown(`\`Розклад\`\n*${ sess.days[sess.day] }:*\n${ stack[sess.day].map((s, n) =>
          `${ n === sess.n ? `\`>\`` : `\` \`` } ${ n }) ${ s ? s : `\`[вікно]\`` }`).join('\n')}\n/exit - \`вихід\``,
          Extra.markdown().markup(m => m.inlineKeyboard([
            m.callbackButton('⬅️', `tschedule-left`),
            m.callbackButton('⬆️', `tschedule-up`),
            m.callbackButton('⬇️', `tschedule-down`),
            m.callbackButton('➡️', `tschedule-right`)])))
        ctx.wizard.next()
      } else ctx.replyWithMarkdown('Вибачте, але я *не знайшов* даного викладача.')
    }
  },
  (ctx) => {
    if(ctx.message && ctx.message.text) {
      const sess = ctx.session.tschedule
      if(ctx.message.text === '[ / ]' && !sess.p) {
        sess.p = true
        ctx.replyWithMarkdown('Ви вибрали метод введення пари \'Раз на два тижні\'',
          Extra.markup(m => m.keyboard([...new Set(sess.cources.map(c => c.name)), '[ ВІКНО ]'], { columns: 4 }).resize()))
      } else if(ctx.message.text === '[ ВІКНО ]') {
        sess.window = true
        ctx.wizard.selectStep(3)
        ctx.wizard.steps[3](ctx)
      } else {
        const cources = sess.cources.filter(c => c.name === ctx.message.text)
        if(cources[0]) {
          sess.crcs = cources
          ctx.replyWithMarkdown('А тепер вкажіть, будь ласка, *курс*',
            Extra.markup(m => m.keyboard([cources.map(c => c.cource.toString())]).resize()))
          ctx.wizard.next()
        } else ctx.replyWithMarkdown('Вибачте, але *не знайшов* дану групу')
      }
    }
  },
  async (ctx) => {
    if(ctx.message && ctx.message.text) {
      const sess = ctx.session.tschedule
      if(!sess.window) sess.crc = sess.crcs.find(c => c.cource === parseInt(ctx.message.text))
      if(sess.crc || sess.window) {
        if(sess.p) {
          ctx.replyWithMarkdown('Вкажіть період пари:',
            Extra.markup(m => m.keyboard([['Чисельник', 'Знаменник']]).resize()))
          ctx.wizard.next()
        } else ctx.wizard.steps[4](ctx)
      } else ctx.replyWithMarkdown('Вибачте, але даного курсу *не існує*')
    }
  },
  async (ctx) => {
    if(ctx.message && ctx.message.text) {
      const sess = ctx.session.tschedule
      const lesson = {
        group_id: sess.group_id,
        user_id: sess.user._id,
        group: sess.crc ? sess.crc._id : {},
        day: sess.day,
        lesson: sess.n
      }
      const q = await TeacherSchedule.find({ group_id: sess.group_id, user_id: sess.user._id, day: sess.day, lesson: sess.n })
      if(sess.p) {
        const period = ['Чисельник', 'Знаменник'].indexOf(ctx.message.text)
        if(period !== -1) {
          lesson.periodic = !Boolean(period)
          if(q[0]) {
            const less = q.find(l => l.periodic === lesson.periodic)
            if(less) await TeacherSchedule.remove({ _id: less._id })
            else if(q[0].periodic === undefined) await TeacherSchedule.remove({ _id: q[0]._id })
          }
          sess.p = false
        } else ctx.replyWithMarkdown('Вибачте, але я Вас не зрозумів')
      } else await TeacherSchedule.remove({ _id: { $in: q.map(l => l._id) }})
      if(!sess.window)
        TeacherSchedule.create(lesson).then(() => {
          if(sess.n > 3) {
            sess.n = 1
            sess.day = sess.day > 3 ? 0 : sess.day+1
          } else sess.n++
          ctx.wizard.selectStep(1)
          ctx.wizard.steps[1](ctx)
        }).catch(() => {
          ctx.replyWithMarkdown('Відбулась невідома *помилка* при записі інформації в базу даних')
          ctx.scene.leave()
        })
      else {
        sess.window = false
        if(sess.n > 3) {
          sess.n = 1
          sess.day = sess.day > 3 ? 0 : sess.day+1
        } else sess.n++
        ctx.wizard.selectStep(1)
        ctx.wizard.steps[1](ctx)
      }
    }
  }
)
tschedule.action(/^tschedule/, async ctx => {
  const [ command, action ] = ctx.match.input.split('-')
  const sess = ctx.session.tschedule
  if(sess && sess.stack) {
    if(action === 'left') sess.day < 1 ? sess.day = 4 : sess.day--
    else if(action === 'up') sess.n < 1 ? sess.n = 4 : sess.n--
    else if(action === 'down') sess.n > 3 ? sess.n = 0 : sess.n++
    else if(action === 'right') sess.day > 3 ? sess.day = 0 : sess.day++
    if(action === 'left' || action === 'right') sess.n = 1
    ctx.editMessageText(`\`Розклад\`\n*${ sess.days[sess.day] }:*\n${ sess.stack[sess.day].map((s, n) =>
      `${ n === sess.n ? `\`>\`` : `\` \`` } ${ n }) ${ s ? s : `\`[вікно]\`` }`).join('\n')}\n/exit - \`вихід\``,
      Extra.markdown().markup(m => m.inlineKeyboard([
        m.callbackButton('⬅️', `tschedule-left`),
        m.callbackButton('⬆️', `tschedule-up`),
        m.callbackButton('⬇️', `tschedule-down`),
        m.callbackButton('➡️', `tschedule-right`)])))
  }
  ctx.answerCbQuery()
})
tschedule.command('exit', ctx => {
  ctx.reply('Ви успішно вийшли із сцени редагування розкладу.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
tschedule.leave(ctx => ctx.session.tschedule = undefined)

// TLINK
const tlink = new WizardScene('tlink',
  async (ctx) => {
    const session = ctx.session.tlink
    const links = await Links.findOne({ group_id: session.group_id })
    session.links = links
    if(links) {
      const groups = await Groups.find({ group_id: { $in: links.groups.map(g => g.id) } })
      ctx.replyWithMarkdown(`${ links.groups[0] ? `На даний момент у вас встановлено зв\'язок із наступн${ links.groups[1] ? 'ими' : 'ою' } груп${ links.groups[1] ? 'ами' : 'ою' }:\n\`${
        links.groups.map(g => g.name).join('\n') }\`` : `У вас немає жодних зв\'язків із студентськими групами.` }\nВаш ключ запрошення:\n\`${ links.secret }\``,
        Extra.markup(m => m.keyboard([['Оновити ключ', 'Редагувати зв\'язки', 'Вихід']]).resize()))
    } else ctx.replyWithMarkdown(`Для початку роботи Вам необхідно створити новий ключ запрошення та надати його студентським групам.`,
        Extra.markup(m => m.keyboard([['Створити ключ', 'Вихід']]).resize()))
  },
  async (ctx) => {
    const session = ctx.session.tlink
    if(ctx.message.text) {
      const group = session.links.groups.find(g => g.name === ctx.message.text)
      if(group) {
        Links.update({ group_id: session.group_id }, {
          $pull: { groups: { id: group.id } }
        }).then(async () => {
          const links = await Links.findOne({ group_id: session.group_id })
          links.groups = links.groups.filter(g => !g.pending)
          if(links.groups[0]) {
            ctx.replyWithMarkdown(`Вкажіть групи із якими ви бажаєте перервати зв\'зок:\n/back - \`повернутися\``,
              Extra.markup(m => m.keyboard(links.groups.map(g => g.name)).resize()))
          } else {
            ctx.replyWithMarkdown('Ви *успішно* витерли усі зв\'зки.')
            ctx.wizard.selectStep(0)
            ctx.wizard.steps[0](ctx)
          }
        }).catch(err => ctx.replyWithMarkdown('Відбулась невідома *помилка*, спробуйте будь ласка, пізніше.'))
      } else ctx.replyWithMarkdown('Вибачте, але я не зрозумів вас.')
    }
  }
)
tlink.hears('Створити ключ', async ctx => {
  const session = ctx.session.tlink
  const links = await Links.findOne({ group_id: session.group_id })
  if(!links) {
    const secret = Math.random().toString(36).substring(2)
    Links.create({
      group_id: session.group_id,
      secret: secret,
      groups: []
    }).then(() => {
      ctx.replyWithMarkdown(`Ваш ключ запрошення:\n\`${ secret }\``, Extra.markup(m => m.keyboard([['Оновити ключ', 'Редагувати зв\'язки', 'Вихід']]).resize()))
    }).catch(err => ctx.replyWithMarkdown('Відбулась невідома *помилка*, спробуйте будь ласка, пізніше.'))
  }
})
tlink.hears('Оновити ключ', async ctx => {
  const session = ctx.session.tlink
  const links = await Links.findOne({ group_id: session.group_id })
  if(links) {
    const secret = Math.random().toString(36).substring(2)
    Links.update({ group_id: session.group_id }, {
      secret: secret
    }).then(() => {
      ctx.replyWithMarkdown(`Ваш ключ запрошення:\n\`${ secret }\``, Extra.markup(m => m.keyboard([['Оновити ключ', 'Редагувати зв\'язки', 'Вихід']]).resize()))
    }).catch(err => ctx.replyWithMarkdown('Відбулась невідома *помилка*, спробуйте будь ласка, пізніше.'))
  }
})
tlink.hears('Редагувати зв\'язки', async ctx => {
  const session = ctx.session.tlink
  if(session.links.groups.filter(g => !g.pending)[0]) {
    ctx.replyWithMarkdown(`Вкажіть групи із якими ви бажаєте перервати зв\'зок:\n/back - \`повернутися\``,
      Extra.markup(m => m.keyboard(session.links.groups.map(g => g.name).filter(g => !g.pending)).resize()))
    ctx.wizard.selectStep(1)
  } else ctx.replyWithMarkdown(`У Вас немає зв\'зку із *жодною* групою!`)
})
tlink.hears('Вихід', ctx => {
  ctx.reply('Ви успішно вийшли із форми управління зв\'язками', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
tlink.command('back', ctx => {
  if(ctx.wizard.cursor === 1) {
    ctx.wizard.selectStep(0)
    ctx.wizard.steps[0](ctx)
  }
})
tlink.command('cancel', ctx => {
  ctx.reply('Процес редагування зв\'язків було перервано.', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
tlink.leave(ctx => ctx.session.tlink = undefined)


// LINK
const link = new WizardScene('link',
  async (ctx) => {
    const sess = ctx.session.link
    const stack = ['\`Статус:\`']
    const keyboard = []
    const group = await Links.findOne({ 'groups.id': sess.group_id })
    sess.group = group
    if(group) {
      const pending = group.groups.find(g => g.id === sess.group_id).pending
      sess.pending = pending
    }
    if(group && !sess.pending) {
      const g = await Groups.findOne({ group_id: group.group_id })
      stack.push(`На даний момент ви зв\'язані із викладацькою групою \`${ g.group_title }\``)
      keyboard.push('Розірвати зв\'язок')
    } else if(group && sess.pending) {
      const g = await Groups.findOne({ group_id: group.group_id })
      stack.push(`На даний момент ви подали заявку на створення зв\'язку із викладацькою групою \`${ g.group_title }\``)
      keyboard.push('Відмінити заявку')
    } else {
      stack.push(`На даний момент ви не є зв\'язані із *жодною* групою.`)
      keyboard.push('Подати заявку')
    }
    stack.push('/exit - \`вихід\`')
    ctx.replyWithMarkdown(stack.join('\n'), Extra.markup(m => m.keyboard([keyboard]).resize()))
    ctx.wizard.next()
  },
  (ctx) => {
    const sess = ctx.session.link
    const txt = ctx.message.text
    if(((txt === 'Розірвати зв\'язок') || (txt === 'Відмінити заявку')) && sess.group) {
      Links.update({ group_id: sess.group.group_id }, {
        $pull: { groups: { id: sess.group_id } }
      }).then(() => {
        ctx.replyWithMarkdown(sess.pending ? 'Зв\'язок успішно розірвано.' : 'Заявку успішно відмінено', Extra.markup((m) => m.removeKeyboard()))
        ctx.scene.leave()
      }).catch(() => {
        ctx.replyWithMarkdown('Відбулась *невідома помилка*, спробуйте, будь ласка, пізніше.', Extra.markup((m) => m.removeKeyboard()))
        ctx.scene.leave()
      })
    } else if(txt === 'Подати заявку') {
      ctx.replyWithMarkdown('Напишіть мені, будь ласка, *ключ запрошення*:\n/exit - \`вихід\`', Extra.markup((m) => m.removeKeyboard()))
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Вибачте, але я вас не зрозумів.')
  },
  async (ctx) => {
    const sess = ctx.session.link
    const group = await Links.findOne({ secret: ctx.message.text })
    if(group) {
      ctx.replyWithMarkdown('Тепер напишіть мені *псевдонім* вашої групи, який буде відображатися викладчам:')
      sess.secret = ctx.message.text
      ctx.wizard.next()
    } else ctx.replyWithMarkdown('Групи із таким ключем запрошення *не існує*!\n/exit - \`вихід\`')
  },
  (ctx) => {
    if(ctx.message.text) {
      const sess = ctx.session.link
      Links.update({ secret: sess.secret }, {
        $addToSet: { groups: { id: sess.group_id, name: ctx.message.text, pending: true } }
      }).then(async () => {
        const link = await Links.findOne({ secret: sess.secret })
        const group = await Groups.findOne({ group_id: link.group_id })
        const req_id = link.groups.find(g => g.id === sess.group_id)._id.toString()
        ctx.telegram.sendMessage(group.creator, `\`Заявка на створення зв\'язку\`\nСтудентська група під пседнонімом \`${
          ctx.message.text }\` бажає створити із вашою бесідою \`${ group.group_title }\` зв\'язок`, Extra.markdown().markup(m =>
          m.inlineKeyboard([m.callbackButton('✔️',`link-yes-${ req_id }`), m.callbackButton('❌',`link-no-${ req_id }`)])))
        ctx.replyWithMarkdown('Заявку успішно створено. Очікуйте затвердження від викладачів')
        ctx.scene.leave()
      }).catch(() => {
        ctx.replyWithMarkdown('Відбулась *невідома помилка*, спробуйте, будь ласка, пізніше.', Extra.markup((m) => m.removeKeyboard()))
        ctx.scene.leave()
      })
    }
  }
)
link.command('exit', ctx => {
  ctx.reply('Ви успішно вийшли із сцени редагування зв\'язку', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
link.leave(ctx => ctx.session.link = undefined)

// DOCS
const docs = new WizardScene('docs',
  async (ctx) => {
    const sess = ctx.session.docs
    const link = await Links.findOne({ 'groups.id': sess.group_id })
    sess.link = link
    if(link) {
      const docs = await Docs.find({ group_id: link.group_id })
      sess.docs = docs
      if(docs[0]) {
        const users = await Users.find({ _id: { $in: docs.map(d => d.user_id) } })
        ctx.replyWithMarkdown('Виберіть необхідного викладача:',
          Extra.markup(m => m.keyboard(users.map(u => `${ u.last_name } ${ u.first_name } ${ u.middle_name }`)).resize()))
        ctx.wizard.next()
      } else {
        ctx.replyWithMarkdown('Вибачте, але *жодний* користувач викладацької бесіди не має даних методичного забезпечення')
        ctx.scene.leave()
      }
    } else {
      ctx.replyWithMarkdown('Вибачте, але ваша бесіда *не зв\'язана* із викладацькою групою.\n/link - подати заявку')
      ctx.scene.leave()
    }
  },
  async (ctx) => {
    const sess = ctx.session.docs
    const txt = ctx.message.text
    if(txt) {
      const usr = txt.split(' ')
      const user = await Users.findOne({ group_id: sess.link.group_id, last_name: usr[0], first_name: usr[1], middle_name: usr[2] })
      if(user) {
        const user_docs = sess.docs.filter(d => d.user_id.equals(user._id))
        sess.user_docs = user_docs
        ctx.replyWithMarkdown('Виберіть бажаний ресурс:',
          Extra.markup(m => m.keyboard(user_docs.map(d => d.name)).resize()))
        ctx.wizard.next()

      } else ctx.replyWithMarkdown('Вибачте, але я *не знайшов* даного викладача')
    }
  },
  (ctx) => {
    const sess = ctx.session.docs
    const txt = ctx.message.text
    if(txt) {
      const doc = sess.user_docs.find(d => d.name === txt)
      if(doc) {
        ctx.replyWithMarkdown(`Прикріплені документи в ресурсі \`${ doc.name }\``, Extra.markup((m) => m.removeKeyboard()))
        doc.files.forEach((f, n) => setTimeout(() => ctx.replyWithDocument(f, { caption: doc.name }), n*100))
        ctx.scene.leave()
      } else ctx.replyWithMarkdown('Вибачте, але я *не знайшов* даний ресурс')
    }
  }
)
docs.command('cancel', ctx => {
  ctx.reply('Ви успішно вийшли із сцени перегляду методичного забезпечення', Extra.markup((m) => m.removeKeyboard()))
  ctx.scene.leave()
})
docs.leave(ctx => ctx.session.docs = undefined)


_Stage.register(getgroup, poll, schedule, homework, announce, requisites, money, adduser, deluser, delgroup, docs, tschedule)
_Stage.register(absent, visiting, addparents, badgrade, delschedule, smsstatus, groupschedule, addgroup, tdocs, tlink, link)


export default _Stage
