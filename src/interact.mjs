import Composer from 'telegraf/composer'

const Handler = new Composer()

Handler.hears(/^привіт/i, ({ reply }) => {
  reply('Хей, як я можу вам допомогти?')
})







export default Handler
