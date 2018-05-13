import Mongoose from 'mongoose'

const Schema = Mongoose.Schema

// GROUPS
const _groups = new Schema({
  group_id      : Number,
  group_title   : String,
  admin_id      : { type: Number, unique: true },
  reg_id        : Number,
  members       : [ Number ]
}, { versionKey : false })

// POLLS
const _polls = new Schema({
  group_id      : Number,
  message_id    : Number,
  user_id       : { type: Number, unique: true },
  title         : String,
  answers       : [ { _id: false, text: String, votes: Number } ],
  voters        : [ Number ]
}, { versionKey : false })

// SCHEDULES
const _schedules = new Schema({
  group_id      : { type: Number, unique: true },
  subjects      : [ String ],
  schedule      : [ [ String ] ],
  homework      : [ [ { _id: false, text: [ String ], media: [ String ] } ] ]
}, { versionKey: false })


const Groups = Mongoose.model('groups', _groups)
const Polls = Mongoose.model('polls', _polls)
const Schedules = Mongoose.model('schedules', _schedules)

export { Groups, Polls, Schedules }
