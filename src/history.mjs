class History { // ОГОЛОШЕННЯ КЛАСУ
  constructor() { // ОГОЛОШЕННЯ КОНСТРУКТОРУ
    this.stack = {} // СТВОРЕННЯ СТЕКУ (ВСТАНОВЛЮЄМО ЙОГО ЗНАЧЕННЯ - ОБ'ЄКТ')
    setInterval(() => { // ОГОЛОШЕННЯ ІНТЕРВАЛУ - (ПЕРШИЙ АРГУЕМЕНТ - ФУКНЦІЯ, ЩО БУДЕ ПОВТОРЮВАТИ ЧЕРЕЗ ПЕВНИЙ ЧАС, ЯКИЙ ЗАДАЄТЬСЯ ДРУГИМ АРГУМЕНТОМ)
      const date = Math.round(Date.now()/1000) // ВСТАНОВЛЯЄМО ДАТУ НА ДАНИЙ МОМЕНТ, ОТРИМУЄМО МІЛІСЕКУНДИ, ПЕРЕВОДИМО МІЛІСЕКУНДИ В СЕКУНДИ
      for(let _key in this.stack) // ПРОГАНЯЄМОСЯ ЧЕРЕЗ ВСІХ КОРИСТУВАЧІВ, ЩО Є В СТЕКУ
        for(let key in this.stack[_key]) // ПРОГАНЯЄМОСЯ ЧЕРЕЗ ПОВІДОМЛЕННЯ ВСІХ КОРИСТУВАЧІВ, ЩО Є В СТЕКУ
          if(date - this.stack[_key][key].date > 20) delete this.stack[_key][key] // ЯКЩО РІЗНИЦЯ ДАТИ НА ДАНИЙ МОМЕНТ І ДАТИ ІЗ ПОВІДОМЛЕННЯ > 10с-ВИДАЛЯЄМО ПОВ
    }, 600000) // ЗАДАЄМО ДРУГИЙ АРГУМЕНТ (ЧАС, ЧЕРЕЗ ЯКИЙ ФУНЦІЯ МАЄ ПОВТОРЮВАТИСЯ (10хв))
  }
  count(msg) { // ОГОЛОШЕННЯ ФУНКЦІЇ В КЛАСІ(ЇЇ АРГУМЕНТ - ОБ'ЄКТ message ІЗ ОБ'ЄКТУ ctx)
    this.stack[msg.from.id] = this.stack[msg.from.id] || {} // УНИКАЄМО ВИПАДКУ, КОЛИ this.stack[msg.from.id] === undefined (НЕВИЧЗНАЧЕНИЙ)
    this.stack[msg.from.id][msg.text] = this.stack[msg.from.id][msg.text] || {} // УНИКАЄМО ВИПАДКУ, КОЛИ this.stack[msg.from.id][msg.text] === undefined
    const text = this.stack[msg.from.id][msg.text] // РОБИМО КОНСТАНТУ text, ЯКА СЛУГУЄ "СКОРОЧЕННЯМ"(ЩОБ НЕ ПИСАТИ КОЖНИЙ РАЗ this.stack[msg.from.id][msg.text])
    text.date = text.date || 0 // УНИКАЄМО ВИПАДКУ, КОЛИ ДАТА В СТЕКУ === undefined (НЕВИЧЗНАЧЕНА)
    text.counter = text.counter ? msg.date - text.date < 20 ? ++text.counter : 1 : 1 // ПЕРЕВІРЯЄМО ЧИ ЛІЧИНЬКИК ІСНУЄ І ЧИ ОСТАННЄ ПОВІДОМЛЕННЯ ВІДПАВЛЕНЕ > 20с
    text.date = msg.date // ВСТАНОВЛЮЄМО ДАТУ ОСТАННЬОГО ПОВІДОМЛЕННЯ В СТЕКУ РІВНОЮ.... ДАТОЮ ОСТАННЬОГО ПОВІДОМЛЕННЯ :)
    return text.counter // ПОВЕРТАЄМО ЗНАЧЕННЯ ЛІЧИЛЬНИКА
  }
}

export default History // ЕКСПОРТУЄМО КЛАС History
