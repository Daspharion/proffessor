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
