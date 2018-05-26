import Composer from 'telegraf/composer'
import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'
import Callbacks from './callbacks'
import Stage from './stage'
import Views from './views'
import Chat from './chat'

import { Groups, Polls, Schedules, Requisites } from './models'

const Handler = new Composer()

Handler.use(Stage)

Handler.command('test', ctx => {
  ctx.reply('TEST MESSAGE', Extra.markup(Markup.forceReply()))
})

Handler.on('callback_query', ctx => Callbacks.answer(ctx))

Handler.on('new_chat_members', async ctx => {
  const msg = ctx.message
  const member = msg.new_chat_participant
  if(ctx.options.id === member.id) {
    const group = await Groups.findOne({ admin_id: msg.from.id })
    if(group) {
      const empty = [ undefined, undefined, undefined, undefined, undefined ]
      Schedules.create({
        group_id: msg.chat.id,
        schedule: [ empty, empty, empty, empty, empty ],
        homework: [ empty, empty, empty, empty, empty ]
      }).catch(err => console.log(err))
      Groups.update({ admin_id: msg.from.id }, {
        group_id: msg.chat.id,
        group_title: msg.chat.title,
        $addToSet: { members: msg.from.id }
      }).then(() => ctx.scene.enter('reg'))
    } else ctx.replyWithMarkdown(Chat.reply('noinvite')).then(() => ctx.leaveChat(msg.chat.id))
  } else
    Groups.update({ group_id: msg.chat.id }, {
      $addToSet: { members: member.id }
    }).catch(async err => {
      const { admin_id } = await Groups.findOne({ group_id: msg.chat.id })
      ctx.telegram.sendMessage(admin_id, `Ой. Сталась помилка при реєстрації нового користувача: \`${ member.first_name }\``, Extra.markdown())
    })
})

Handler.on('left_chat_member', async ctx => {
  const msg = ctx.message
  const member = msg.left_chat_participant
  if(ctx.options.id === member.id) {
    const group = await Groups.findOne({ group_id: msg.chat.id })
    Schedules.remove({ group_id: msg.chat.id }).catch(err => console.error(err))
    Polls.remove({ group_id: msg.chat.id }).catch(err => console.error(err))
    Requisites.remove({ group_id: msg.chat.id }).catch(err => console.error(err))
    Groups.remove({ group_id: msg.chat.id }).then(() => {
      ctx.telegram.sendMessage(group.admin_id, `Оскільки мене було видалено із бесіди \`${ group.group_title }\`, вся інформація та налаштування були *стерті*. Я сумуватиму за вами 😔`, Extra.markdown())
      ctx.scene.leave()
    }).catch(err => console.error(err))
  } else
    Groups.update({ group_id: msg.chat.id }, {
      $pull: { members: member.id }
    }).catch(async err => {
      const { admin_id } = await Groups.findOne({ group_id: msg.chat.id })
      ctx.telegram.sendMessage(admin_id, `Ой. Сталась помилка при видаленні користувача: \`${ member.first_name }\``, Extra.markdown())
    })
})

Handler.command('start', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const q = (await Groups.findOne({ admin_id: ctx.message.from.id })) || {}
    if(!q.group_id) ctx.replyWithMarkdown('Для початку роботи добавте мене, будь ласка, в *бесіду* 🙃')
    else ctx.replyWithMarkdown(`Вибачте, але на даний момент ви є адміністратором бесіди \`${ q.group_title }\`. Якщо ви бажаєте адмініструвати іншу бесіду вам необхідно видалити мене із попередньо згаданої`)
    if(!q.admin_id) await Groups.create({ admin_id: ctx.message.from.id })
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('register', async ctx => {
  if(ctx.message.chat.type === 'group') ctx.scene.enter('reg')
  else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки в *бесідах*.`)
})

Handler.command('newpoll', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const q = await Groups.findOne({ members: ctx.message.from.id })
    if(q) ctx.scene.enter('newpoll')
    else ctx.reply('Вибачте, але ви не зареєстровані у жодній бесіді.')
  }
  else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('delpoll', async ctx => {
  if(ctx.message.chat.type === 'private')
    Polls.remove({ user_id: ctx.message.from.id })
      .then(({ n }) => ctx.reply(n ? 'Опитування було успішно видалене.' : 'У вас немає активного опитування.'))
      .catch(() => ctx.reply('Відбулась невідома помилка при видаленні опитування.'))
  else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('schedule', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('schedule')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else Views.groupSchedule({ group_id: ctx.message.chat.id, telegram: ctx.telegram })
})

Handler.command('delschedule', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    const empty = [ undefined, undefined, undefined, undefined, undefined ]
    if(group && group.group_id)
      Schedules.update({ group_id: group.group_id }, {
        schedule: [ empty, empty, empty, empty, empty ],
        homework: [ empty, empty, empty, empty, empty ]
      }).then(() => ctx.replyWithMarkdown(`Розклад успішно очищено.`))
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('homework', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) {
      const { schedule } = await Schedules.findOne({ group_id: group.group_id })
      if(schedule.find(day => day.find(sub => sub))) ctx.scene.enter('homework')
      else ctx.replyWithMarkdown(`Вибачте, але ви не заповнили *розклад*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('announce', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('announce')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('money', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('money')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('requisites', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('requisites')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('adduser', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('adduser')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('deluser', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('deluser')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('absent', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('absent')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('visiting', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('visiting')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})
Handler.command('addparents', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('addparents')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})
Handler.command('badgrade', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admin_id: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('badgrade')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.hears(Chat.lstnr, ctx => {
  const msg = ctx.message
  const pattern = Chat.parse(ctx.match[0])
  const str = Chat.reply(pattern, { id: msg.from.id, date: msg.date })
  ctx.reply(str)
})


export default Handler
