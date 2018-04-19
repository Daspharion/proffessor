import Composer from 'telegraf/composer'
import History from './history'
import Chat from './chat'

const Handler = new Composer()
const Hst = new History()
const Cht = new Chat()

Handler.use((ctx, next) => {
  const msg = ctx.update.message
  msg.counter = Hst.count(msg)
  return next()
})

Handler.hears(/привіт/i, ctx => {
  const msg = ctx.update.message
  const string = Cht.reply('hello', msg.counter)
  ctx.reply(string)
})



export default Handler
