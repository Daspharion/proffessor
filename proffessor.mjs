import Telegraf from 'telegraf'
import Mongoose from 'mongoose'
import Session from 'telegraf/session'
import Handler from './src/handler'
import Synchro from './src/synchro'

import { NODE, MONGO, TELEGRAM, WEBHOOK, PORT } from './src/config'

const Bot = new Telegraf(TELEGRAM)
const Sync = new Synchro(Bot.telegram)

Bot.use(Session())
Bot.use(Handler)

Bot.telegram.getMe().then(({ id, username }) => {
  Object.assign(Bot.options, {
    id: id,
    username: username
  })
})

Mongoose.Promise = Promise

Bot.catch(err => console.error(err))

Mongoose.connect(MONGO[NODE]).then(async () => {
  console.log('> Connected to database')
  // await Sync.start()

  }).catch(err => {
    console.error(err)
    process.exit(1)
  })

switch(NODE) {
  case 'development':
    Bot.startPolling()
    break
  case 'production':
    Bot.telegram.setWebhook(WEBHOOK)
    Bot.startWebhook(`/bot-${TELEGRAM}`, null, PORT)
    break
  default:
    console.error('Environment Mode is not Specified')
    process.exit(1)
}

// TODO:
// 1) БОТ - КОЛЛЕКТОР
// 2) ГОЛОСУВАННЯ
// 3) РОЗКЛАД
// 4) BETTER ОГОЛОШЕННЯ

// getChat
