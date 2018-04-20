import Mongoose from 'mongoose'

const Schema = Mongoose.Schema
const ObjectId = Schema.ObjectId

// USERS
const _users = new Schema({
  id          : Number,
  type        : Boolean,
  username    : String,
  firstname   : String,
  lastname    : String
}, { versionKey: false })



const Users = Mongoose.model('users', _users)


export { Users }
