import Mongoose from 'mongoose'

const Schema = Mongoose.Schema

// GROUPS
const _groups = new Schema({
  group_id      : { type: Number, unique: true },
  type          : Boolean,
  group_title   : String,
  creator       : Number,
  admins        : [ Number ]
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
  dob_day       : Number,
  dob_month     : Number,
  dob_year      : Number,
  sex           : Boolean,
  user_id       : Number
}, { versionKey: false })

// VISITING
const _visiting = new Schema({
  group_id      : Number,
  day           : Number,
  lesson        : Number,
  absent        : [ Schema.Types.ObjectId ]
}, { versionKey: false })

// SMS
const _sms = new Schema({
  group_id      : Number,
  message_ids    : [ Number ],
  date          : { type: Date, default: Date.now },
  to            : [ Number ],
  text          : String
}, { versionKey: false })

// PARENTS
const _parents = new Schema({
  group_id      : Number,
  user_id       : Schema.Types.ObjectId,
  name          : String,
  number        : Number
}, { versionKey: false })

// COURCES
const _cources = new Schema({
  group_id      : Number,
  name          : String,
  cource        : Number,
  student_group : Schema.Types.ObjectId
}, { versionKey: false })

// DOCS
const _docs = new Schema({
  group_id      : Number,
  user_id       : Schema.Types.ObjectId,
  name          : String,
  files         : [ String ],
  date          : { type: Date, default: Date.now }
}, { versionKey: false })

// TEACHER SCHEDULE
const _teacherSchedule = new Schema({
  group_id      : Number,
  user_id       : Schema.Types.ObjectId,
  group         : Schema.Types.ObjectId,
  day           : Number,
  lesson        : Number,
  periodic      : Boolean
}, { versionKey: false })

// LINKS
const _links = new Schema({
  group_id      : Number,
  secret        : { type: String, unique: true },
  groups        : [ { id: Number, name: String, pending: Boolean  } ]
}, { versionKey: false })

const Groups = Mongoose.model('groups', _groups)
const Polls = Mongoose.model('polls', _polls)
const Schedules = Mongoose.model('schedules', _schedules)
const Announcements = Mongoose.model('announcements', _announcements)
const Requisites = Mongoose.model('requisites', _requisites)
const Users = Mongoose.model('users', _users)
const Visiting = Mongoose.model('visiting', _visiting)
const GroupSms = Mongoose.model('sms', _sms)
const Parents = Mongoose.model('parents', _parents)
const Cources = Mongoose.model('cources', _cources)
const Docs = Mongoose.model('docs', _docs)
const TeacherSchedule = Mongoose.model('teacherSchedule', _teacherSchedule)
const Links = Mongoose.model('links', _links)

export { Groups, Polls, Schedules, Announcements, Requisites, Users, Visiting, GroupSms, Parents, Cources, Docs, TeacherSchedule, Links }
