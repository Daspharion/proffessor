import Telegraf from 'telegraf'
import { TELEGRAM } from './src/config'

const Bot = new Telegraf(TELEGRAM)

Bot.hears('hey', ctx => {
  ctx.reply('tesing olha branch')
})

Bot.startPolling()
