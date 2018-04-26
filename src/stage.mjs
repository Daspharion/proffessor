import Stage from 'telegraf/stage'
import WizardScene from 'telegraf/scenes/wizard'
import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'

import { Users } from './models'

const _Stage = new Stage()

const start = new WizardScene('start',
  (ctx) => {
    ctx.reply('Тепер вкажіть хто ви є?', Markup
      .keyboard([['🎓 Викладач', '📓 Студент']])
      .oneTime()
      .resize()
      .extra())
    return ctx.wizard.next()
  },
  (ctx) => {
    const { from, text } = ctx.update.message
    if(text.match(/викладач|студент/i)) {
      let type = text.match(/викладач/i) ? true : false
      Users.update({ id: from.id }, {
        id: from.id,
        type: type,
        username: from.username,
        firstname: from.first_name,
        lastname: from.last_name
      }, { upsert: true })
        .then(() => { ctx.reply('Супер! Запис в базі даних створено')})
        .catch(() => { ctx.reply('Невдалося створити запис в базі даних, спробуйте пізніше')})
      return ctx.scene.leave()
    } else {
      ctx.reply('Скористайтесь, будь ласка, клавіатурою.')
    }
  }
)


_Stage.register(start)



export default _Stage
