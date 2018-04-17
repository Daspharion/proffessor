const
  NODE = process.env.NODE_ENV,
  PORT = process.env.PORT,
  TELEGRAM = process.env.TELEGRAM_TOKEN,
  WEBHOOK = `https://proffessorbot.herokuapp.com/bot-${process.env.TELEGRAM_TOKEN}`,
  MONGO = {
    development: 'mongodb://localhost:27017/admin',
    production: process.env.MONGODB
  }

export { NODE, PORT, TELEGRAM, WEBHOOK, MONGO }
