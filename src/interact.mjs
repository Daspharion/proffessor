import Composer from 'telegraf/composer'
import History from './history'

const Handler = new Composer()
const Hst = new History()

Handler.use((ctx, next) => {
  ctx.update.message.index = Hst.count(ctx.update.message)
  return next()
})

Handler.hears(/^привіт/i, ctx => {
  ctx.reply('Хей, як я можу вам допомогти?')
})



export default Handler
