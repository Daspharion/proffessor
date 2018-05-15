import Telegraf from 'telegraf'
import Mongoose from 'mongoose'
import Session from 'telegraf/session'
import Handler from './src/handler'

import { NODE, MONGO, TELEGRAM, WEBHOOK, PORT } from './src/config'

const Bot = new Telegraf(TELEGRAM)

Bot.use(Session())
Bot.use(Handler)

Bot.telegram.getMe().then(({ id, username }) => {
  Object.assign(Bot.options, { id: id, username: username })
})

Bot.catch(err => console.error(err))

Mongoose.Promise = Promise

Mongoose.connect(MONGO[NODE]).then(db => {
  console.log('> Connected to database')
  if(NODE === 'production') {
    Bot.telegram.setWebhook(WEBHOOK)
    Bot.telegram.webhookReply = false
    Bot.startWebhook(`/bot-${ TELEGRAM }`, null, PORT)
  } else Bot.startPolling()
  console.log(`> Starting bot in ${ NODE } enviroment`)
}).catch(err => {
  console.error(`! Error: ${ err.message }`)
  process.exit(1)
})

// TODO:
// 4) BETTER ОГОЛОШЕННЯ:
//    -) Кожного дня в XX:00 відправити в кожну групу розклад
//    -) Оголошення в групу через в бажаній годині
//    -)
// x) BETTER HOLIDAYS
//    -) Файл із данаими про кожний день : { '0101': { message: 'новий рік.', holidays: [] }, '0102': { ... }  }
//    -) Стек-масив із абзацами на загальне повідомлення. Джойниться новими рядками.
//    -) Перевірка сьогоднішнього дня на іменини: if(holidays) holidays.forEach(n => Users.find({ name: n }).then(user => user.forEach(u => message.push(`Сьогодні ${ u.name } ${ u.middlename }...`))))
//    -) Перевірка сьогоднішнього дня на дні нарождення: Users.find({ day: date.getDay(), month: date.getMonth() }).then(user => user.forEach(u => message.push(`Сьогодні .... святкує день народення`)))
//    -) Перевірка на ювілей ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//    -) Функція реєстрації людини (Ім'я, Прізвище, ПБ, ДН)
// x) ОГЛОШЕННЯ ПРО ЗБІР КОШТІВ
