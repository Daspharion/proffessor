import Telegraf from 'telegraf'
import Mongoose from 'mongoose'
import Session from 'telegraf/session'
import Handler from './src/handler'
import Interact from './src/interact'

import { NODE, MONGO, TELEGRAM, WEBHOOK, PORT } from './src/config'

const Bot = new Telegraf(TELEGRAM)

Bot.use(Session())
Bot.use(Handler)
Bot.use(Interact)
Mongoose.Promise = Promise

Bot.catch(err => console.error(err))

Mongoose.connect(MONGO[NODE])
  .then(db => console.log('> Connected to database'))
  .catch(err => {
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
