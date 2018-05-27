import https from 'https'
import conv from 'windows-1251'
import { SMSCLUB } from './config'

export default new class Sms {
  constructor() {
    this.url = 'https://gate.smsclub.mobi/token/'
    this.states = {
      'DELIVRD': 'Доставлено',
      'ENROUTE': 'Відправлено',
      'REJECTD': 'Відхилено'
    }
  }
  send(numbers, text) {
    return new Promise((resolve, reject) => {
      https.get(`${ this.url }?username=${ SMSCLUB.login }&token=${ SMSCLUB.token }&from=${ SMSCLUB.name }&to=${ numbers.join(';') }&text=${ conv.encode(text) }`, res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          data = data.split('<br/>')
          if(data.length < 3) reject(new Error(`Помилка при відправленні ${ numbers[1] ? 'повідомлень' : 'повідомлення' }. Зв\'яжіться, будь ласка, із адміністратором.`))
          else {
            data.shift()
            data.pop()
            resolve(data)
          }
        })
      }).on('error', err => reject(err))
    })
  }
  state(ids) {
    return new Promise((resolve, reject) => {
      https.get(`${ this.url }state.php?username=${ SMSCLUB.login }&token=${ SMSCLUB.token }&smscid=${ ids.join(';') }`, res => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          data = data.split('<br/>')
          if(data.length < 3) reject(new Error(`Помилка при отриманні статусу ${ ids[1] ? 'повідомлень' : 'повідомлення' }. Зв\'яжіться, будь ласка, із адміністратором.`))
          else {
            data.shift()
            data.splice(-2, 2)
            data = data.reduce((result, item) => {
              item = item.split(': ')
              result[item[0]] = this.states[item[1]] || 'Помилка'
              return result
            }, {})
            resolve(data)
          }
        })
      }).on('error', err => reject(err))
    })
  }
}
