import Composer from 'telegraf/composer'
import Markup from 'telegraf/markup'
import Extra from 'telegraf/extra'
import Actions from './actions'
import Stage from './stage'
import Chat from './chat'

import { Groups, Polls, Schedules, Announcements, Requisites, Users, Visiting, GroupSms, Parents } from './models'

const Handler = new Composer()

Handler.use(Stage)
Handler.use(Actions)

Handler.on('new_chat_members', async ctx => {
  const member = ctx.message.new_chat_participant
  if(ctx.options.id === member.id) {
    ctx.replyWithMarkdown(`Доброго ${ new Date().getHours() < 18 ? 'дня' : 'вечора' }. Мене звати \`PROFFESSOR\`, я буду допомагати *Вам* ${
      ''}протягом навчального процесу.\nДля закінчення реєстрації, виберіть, будь ласка, тип цієї бесіди:`,
      Extra.markup(m => m.inlineKeyboard([
        m.callbackButton('👨‍🎓 Студентська', 'reg-student'),
        m.callbackButton('👩‍🏫 Викладацька', 'reg-teacher')
      ])))
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
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(!groups[0]) ctx.replyWithMarkdown('Для початку роботи добавте мене, будь ласка, в *бесіду* 👋🏻')
    else ctx.replyWithMarkdown(`Привіт, ${ ctx.message.from.first_name }, ви є адміністратором груп${ groups[1] ? '' : 'и' } \`${
      groups.map(group => group.group_title).join(', ') }\`. Чим я можу вам допомогти?`)
  }
  else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('newpoll', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      if(groups[1]) {
        ctx.scene.enter('getgroup')
        ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'newpoll' }
      } else {
        ctx.scene.enter('newpoll')
        ctx.session.newpoll = { group_id: groups[0].group_id }
      }
    } else ctx.reply(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
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
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'schedule' }
        } else {
          ctx.scene.enter('schedule')
          ctx.session.schedule = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.scene.enter('groupschedule')
})

Handler.command('delschedule', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'delschedule' }
        } else {
          ctx.scene.enter('delschedule')
          ctx.session.delschedule = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('homework', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'homework' }
        } else {
          ctx.scene.enter('homework')
          ctx.session.homework = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('announce', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'announce' }
        } else {
          ctx.scene.enter('announce')
          ctx.session.announce = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('money', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'money' }
        } else {
          ctx.scene.enter('money')
          ctx.session.money = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('requisites', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'requisites' }
        } else {
          ctx.scene.enter('requisites')
          ctx.session.requisites = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('adduser', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'adduser' }
        } else {
          ctx.scene.enter('adduser')
          ctx.session.adduser = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('deluser', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'deluser' }
        } else {
          ctx.scene.enter('deluser')
          ctx.session.deluser = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('absent', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'absent' }
        } else {
          ctx.scene.enter('absent')
          ctx.session.absent = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('visiting', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'visiting' }
        } else {
          ctx.scene.enter('visiting')
          ctx.session.visiting = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('addparents', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'addparents' }
        } else {
          ctx.scene.enter('addparents')
          ctx.session.addparents = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('badgrade', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'badgrade' }
        } else {
          ctx.scene.enter('badgrade')
          ctx.session.badgrade = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('smsstatus', async ctx => {
  if(ctx.message.chat.type === 'private') {
    const groups = await Groups.find({ admins: ctx.message.from.id })
    if(groups[0]) {
      groups.filter(g => !g.type)
      if(groups[0]) {
        if(groups[1]) {
          ctx.scene.enter('getgroup')
          ctx.session.getgroup = { user_id: ctx.message.from.id, next: 'smsstatus' }
        } else {
          ctx.scene.enter('smsstatus')
          ctx.session.smsstatus = { group_id: groups[0].group_id }
        }
      } else ctx.replyWithMarkdown(`Вибачте, але команда доступна тільки для *студентів*.`)
    } else ctx.replyWithMarkdown(`Вибачте, але у вас недостатньо *прав* для цієї команди.`)
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки через *приватні повідомлення*.`)
})

Handler.command('updateadmins', async ctx => {
  if(ctx.message.chat.type === 'group') {
    const admins = (await ctx.getChatAdministrators()).map(({ user }) => user.id)
    const update = await Groups.update({ group_id: ctx.message.chat.id }, { admins: admins })
    ctx.replyWithMarkdown(update.nModified ? 'Адміністраторів *успішно* оновлено' : 'Змін *не відбулося*')
  } else ctx.replyWithMarkdown(`Вибачте, але дана команда доступна тільки в *бесіді*.`)
})


Handler.hears(Chat.lstnr, ctx => {
  const msg = ctx.message
  const pattern = Chat.parse(ctx.match[0])
  const str = Chat.reply(pattern, { id: msg.from.id, date: msg.date })
  ctx.reply(str)
})


export default Handler
