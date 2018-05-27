import Composer from 'telegraf/composer'
import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'
import Actions from './actions'
import Stage from './stage'
import Views from './views'
import Chat from './chat'

import { Groups, Polls, Schedules, Announcements, Requisites, Users, Visiting, GroupSms, Parents } from './models'

const Handler = new Composer()

Handler.use(Stage)
Handler.use(Actions)

Handler.on('new_chat_members', async ctx => {
  const member = ctx.message.new_chat_participant
  const admins = await ctx.getChatAdministrators()
  if(ctx.options.id === member.id) {
    const msg = ctx.message
    const empty = [ undefined, undefined, undefined, undefined, undefined ]
    Groups.create({
      group_id: msg.chat.id,
      group_title: msg.chat.title,
      admins: admins.map(admin => admin.user.id)
    }).catch(err => {
      if(err.code === 11000) Groups.remove({ group_id: msg.chat.id })
      ctx.reply('Помилка при створенні запису в базі даних. Спробуйте, будь ласка, пізніше.').then(() => ctx.leaveChat(msg.chat.id))
    })
  }
})

Handler.on('left_chat_member', async ctx => {
  const member = ctx.message.left_chat_participant
  if(ctx.options.id === member.id) {
    const group_id = ctx.message.chat.id
    const group = await Groups.findOne({ group_id: group_id })
    if(group) {
      Announcements.remove({ group_id: group_id }).catch(err => console.error(err))
      Requisites.remove({ group_id: group_id }).catch(err => console.error(err))
      Schedules.remove({ group_id: group_id }).catch(err => console.error(err))
      Visiting.remove({ group_id: group_id }).catch(err => console.error(err))
      GroupSms.remove({ group_id: group_id }).catch(err => console.error(err))
      Parents.remove({ group_id: group_id }).catch(err => console.error(err))
      Polls.remove({ group_id: group_id }).catch(err => console.error(err))
      Users.remove({ group_id: group_id }).catch(err => console.error(err))
      Groups.remove({ group_id: group_id }).then(() => {
        group.admins.forEach(admin => {
          ctx.telegram.sendMessage(admin, `Оскільки мене було видалено із бесіди \`${
            group.group_title }\`, вся інформація та налаштування були *стерті*. Я сумуватиму за вами 😔`, Extra.markdown())
          ctx.scene.leave()
        })
      }).catch(err => console.error(err))
    }
  }
})

Handler.command('start', async ctx => {
  if(ctx.message.chat.type === 'private') ctx.replyWithMarkdown('Для початку роботи добавте мене, будь ласка, в *бесіду* ✋🏻')
  else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('newpoll', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('newpoll')
    else ctx.reply(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
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
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('schedule')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else Views.groupSchedule(ctx.message.chat.id)
})

Handler.command('delschedule', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
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
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) {
      const { schedule } = await Schedules.findOne({ group_id: group.group_id })
      if(schedule.find(day => day.find(sub => sub))) ctx.scene.enter('homework')
      else ctx.replyWithMarkdown(`Вибачте, але ви не заповнили *розклад*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('announce', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('announce')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('money', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('money')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('requisites', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('requisites')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('adduser', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('adduser')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('deluser', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('deluser')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('absent', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('absent')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('visiting', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('visiting')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})
Handler.command('addparents', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('addparents')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})
Handler.command('badgrade', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) ctx.scene.enter('badgrade')
    else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})
Handler.command('smsstatus', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const group = await Groups.findOne({ admins: ctx.message.from.id })
    if(group && group.group_id) Views.smsStatus(group.group_id, ctx.message.from.id)
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
