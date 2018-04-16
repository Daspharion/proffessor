import Telegraf from 'telegraf'
import { TELEGRAM } from './src/config'

const Bot = new Telegraf(TELEGRAM)

Bot.hears('hey', ctx => {
  ctx.reply('hello world! :)')
})

Bot.hears('хей', ctx => {
  ctx.reply('привіт')
})

Bot.startPolling()
