import Composer from 'telegraf/composer'
import History from './history'
import Chat from './chat'

const Handler = new Composer()
const Hst = new History()
const Cht = new Chat()

Handler.hears(Cht.lstnr, ctx => {
  const msg = ctx.update.message
  const pattern = Cht.parse(ctx.match[0])
  const params = {
    id: msg.from.id,
    pattern: pattern,
    date: msg.date
  }
  const str = Cht.reply(pattern, Hst.count(params))
  ctx.reply(str)
})



export default Handler
