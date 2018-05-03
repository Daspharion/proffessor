import Mongoose from 'mongoose'

const Schema = Mongoose.Schema

// USERS
const _users = new Schema({
  id            : Number,
  type          : Boolean,
  username      : String,
  firstname     : String,
  lastname      : String
}, { versionKey : false })

// GROUPS
const _groups = new Schema({
  group_id      : Number,
  group_title   : String,
  admin_id      : Number,
  reg_id        : Number,
  members       : [ Number ]
}, { versionKey : false })



const Users = Mongoose.model('users', _users)
const Groups = Mongoose.model('groups', _groups)

export { Users, Groups }
