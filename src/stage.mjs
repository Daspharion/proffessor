import WizardScene from 'telegraf/scenes/wizard'
import Scene from 'telegraf/scenes/base'
import Markup from 'telegraf/markup'
import Stage from 'telegraf/stage'
import Extra from 'telegraf/extra'

import { Groups } from './models'

const _Stage = new Stage()

const reg = new Scene('reg')

reg.enter(async ctx => {
  const msg = ctx.message
  const members = (await Groups.findOne({ group_id: msg.chat.id })).members.length
  const allMembers = await ctx.getChatMembersCount(msg.chat.id)
  ctx.reply(`\`Реєстрація користувачів\`\n*Для реєстрації натисніть, будь ласка, на чекмарк*\n\`Статус: ${members}/${allMembers}\``,
    Extra.markdown().markup((m) => m.inlineKeyboard([ m.callbackButton('✔️', 'register') ])))
    .then(({ message_id }) => Groups.update({ group_id: msg.chat.id }, { reg_id: message_id }))
})
reg.leave(async ctx => {
  const msg = ctx.message || ctx.update.callback_query.message
  const { reg_id } = await Groups.findOne({ group_id: msg.chat.id })
  await ctx.telegram.deleteMessage(msg.chat.id, reg_id)
  await Groups.update({ group_id: msg.chat.id }, { reg_id: undefined })
})
reg.command('cancel', ctx => ctx.scene.leave())



// const reg = new WizardScene('reg',
//   async (ctx) => {
//
//   },
//   async (ctx) => {
//     const msg = ctx.message
//     const q = await Groups.findOne({ admin_id: ctx.message.from.id })
//     if(q.group_id) {
//       ctx.reply('Супер! Ще декілька дрібниць', Markup.removeKeyboard().extra())
//       ctx.scene.leave()
//     } else ctx.reply('Упс... Очевидно ви не добавили мене в бесіду 😕')
//   }
// )


_Stage.register(reg)



export default _Stage
