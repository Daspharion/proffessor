import Composer from 'telegraf/composer'
import Stage from './stage'

const Handler = new Composer()

Handler.use(Stage)

Handler.command('start', ctx => {
  ctx.scene.enter('start')
})




export default Handler
