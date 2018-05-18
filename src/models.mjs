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

// ANNOUNCEMENTS
const _announcements = new Schema({
  group_id      : Number,
  text          : String,
  min           : Number,
  hour          : Number,
  day           : Number,
  month         : Number,
  year          : Number
}, { versionKey: false })

// REQUISITES
const _requisites = new Schema({
  group_id      : { type: Number, unique: true },
  message       : String
}, { versionKey: false })

// USERS
const _users = new Schema({
  group_id      : Number,
  first_name    : String,
  last_name     : String,
  middle_name   : String,
  dob           : Date,
  sex           : Boolean
}, { versionKey: false })

const Groups = Mongoose.model('groups', _groups)
const Polls = Mongoose.model('polls', _polls)
const Schedules = Mongoose.model('schedules', _schedules)
const Announcements = Mongoose.model('announcements', _announcements)
const Requisites = Mongoose.model('requisites', _requisites)
const Users = Mongoose.model('users', _users)

export { Groups, Polls, Schedules, Announcements, Requisites, Users }
