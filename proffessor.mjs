import Telegraf from 'telegraf'
import Interact from './src/interact'

import { NODE, MONGO, TELEGRAM, WEBHOOK, PORT } from './src/config'

const Bot = new Telegraf(TELEGRAM)

Bot.use(Interact)

Bot.catch(err => console.error(err))

switch(NODE) {
  case 'development':
    Bot.startPolling()
    break
  case 'production':
    console.log('PREPARING WEBHOOK')
    Bot.telegram.setWebhook(WEBHOOK)
    Bot.startWebhook(`/bot-${TELEGRAM}`, null, PORT)
    console.log('WEBHOOK ENABLED')
    break
  default:
    console.error('Environment Mode is not Specified')
    process.exit(1)
}
