import Mongoose from 'mongoose'

const Schema = Mongoose.Schema

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
