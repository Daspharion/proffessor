import Extra from 'telegraf/extra'

import { Groups } from './models'

export default new class Callbacks {
  answer(ctx) {
    const query = ctx.update.callback_query.data
    if(this[query]) this[query](ctx)
    else throw new Error(`Unexpected callback query: ${query}`)
  }

  async register(ctx) {
    const { message, from } = ctx.update.callback_query
    const group = await Groups.findOne({ group_id: message.chat.id })
    if(group.reg_id === message.message_id) {
      // const { nModified } = await Groups.update({ group_id: message.chat.id }, { $addToSet: { members: from.id } })
      const { nModified } = await Groups.update({ group_id: message.chat.id }, { $push: { members: from.id } })
      if(nModified) {
        const members = (await Groups.findOne({ group_id: message.chat.id })).members.length
        const allMembers = await ctx.getChatMembersCount(message.chat.id)
        ctx.telegram.sendMessage(from.id, `Привіт, ${from.first_name}, мене звати \`PROFFESSOR\`, будемо знайомі 🤠`, Extra.markdown())
        ctx.telegram.editMessageText(message.chat.id, message.message_id, null,
          `\`Реєстрація користувачів\`\n*Для реєстрації натисніть, будь ласка, на чекмарк*\n\`Статус: ${members}/${allMembers}\``,
          Extra.markdown().markup((m) => m.inlineKeyboard([ m.callbackButton('✔️', 'register') ])))
        ctx.answerCbQuery(`${from.first_name}, вас було успішно зареєстровано`)
        if(members >= allMembers) ctx.scene.leave()
      }
    } else ctx.telegram.deleteMessage(message.chat.id, message.message_id)
  }
}
