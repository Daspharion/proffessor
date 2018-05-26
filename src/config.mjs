const
  NODE = process.env.NODE_ENV,
  PORT = process.env.PORT,
  TELEGRAM = process.env.TELEGRAM_TOKEN,
  WEBHOOK = `https://proffessorbot.herokuapp.com/bot-${process.env.TELEGRAM_TOKEN}`,
  MONGO = {
    development: 'mongodb://localhost:27017/admin',
    production: process.env.MONGODB
  },
  SMSCLUB = {
    login: process.env.SMSCLUB_LOGIN,
    token: process.env.SMSCLUB_TOKEN,
    name: process.env.SMSCLUB_NAME
  }

export { NODE, PORT, TELEGRAM, WEBHOOK, MONGO, SMSCLUB }
