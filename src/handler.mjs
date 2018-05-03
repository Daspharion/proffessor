import Composer from 'telegraf/composer'
import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'
import Callbacks from './callbacks'
import History from './history'
import Stage from './stage'
import Chat from './chat'

import { Groups } from './models'

const Handler = new Composer()
const Hst = new History()
const Cht = new Chat()

Handler.use(Stage)

Handler.command('test', ({ reply }) => reply('kek'))

Handler.on('callback_query', ctx => Callbacks.answer(ctx))

Handler.on('new_chat_members', async ctx => {
  const msg = ctx.message
  if(ctx.options.id === msg.new_chat_participant.id) {
    const group = await Groups.findOne({ admin_id: msg.from.id })
    if(group) {
      Groups.update({ admin_id: msg.from.id }, {
        group_id: msg.chat.id,
        group_title: msg.chat.title,
        $addToSet: { members: msg.from.id }
      }).then(() => ctx.scene.enter('reg'))
    } else
      ctx.reply(Cht.reply('noinvite'), Extra.markdown()).then(() => ctx.leaveChat(msg.chat.id))
  } else {
    Groups.update({ group_id: msg.chat.id }, {
      $addToSet: { members: msg.new_chat_participant.id }
    }).catch(async err => {
      const { admin_id } = await Groups.findOne({ group_id: msg.chat.id })
      ctx.telegram.sendMessage(admin_id,
        `Ой. Сталась помилка при реєстрації нового користувача: \`${msg.new_chat_participant.first_name}\``, Extra.markdown())
    })
  }
})

Handler.on('left_chat_member', async ctx => {
  const msg = ctx.message
  if(ctx.options.id === msg.left_chat_participant.id) {
    const group = await Groups.findOne({ group_id: msg.chat.id })
    Groups.remove({ group_id: msg.chat.id }).then(() => {
      ctx.telegram.sendMessage(group.admin_id, `Оскільки мене було видалено із бесіди \`${group.group_title}\`, вся інформація та налаштування були *стерті*. Я сумуватиму за вами 😔`, Extra.markdown())
      ctx.scene.leave()
    }).catch(err => console.error(err))
  } else {
    Groups.update({ group_id: msg.chat.id }, {
      $pull: { members: msg.left_chat_participant.id }
    }).catch(async err => {
      const { admin_id } = await Groups.findOne({ group_id: msg.chat.id })
      ctx.telegram.sendMessage(admin_id,
        `Ой. Сталась помилка при видаленні користувача: \`${msg.left_chat_participant.first_name}\``, Extra.markdown())
    })
  }
})

Handler.command('start', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const q = (await Groups.findOne({ admin_id: ctx.message.from.id })) || {}
    if(!q.group_id) {
      Groups.create({ admin_id: ctx.message.from.id })
        .then(() => ctx.reply('Для початку роботи добавте мене, будь ласка, в бесіду 😄'))
        .catch(err => {
          if(err.code === 11000) ctx.reply('Для початку роботи добавте мене, будь ласка, в бесіду 😄')
          else console.error(err)
        })
    } else {
      ctx.reply(`Вибачте, але на даний момент ви є адміністратором бесіди \`${q.group_title}\`. Якщо ви бажаєте адмініструвати іншу бесіду вам необхідно видалити мене із попередньо згаданої`, Extra.markdown())
    }
  } else {
    ctx.reply(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`, Extra.markdown())
  }
})

Handler.command('register', async ctx => {
  if(ctx.message.chat.type === 'group') ctx.scene.enter('reg')
  else ctx.reply(`Вибачте, але дана команда доступна тільки в *бесідах*.`, Extra.markdown())
})

Handler.hears(Cht.lstnr, ctx => {
  const msg = ctx.message
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
