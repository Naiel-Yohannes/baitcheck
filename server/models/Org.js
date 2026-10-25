import mongoose from 'mongoose'

const orgSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 60,
  },
  joinCode: {
    type: String,
    required: true,
    uppercase: true,
    minlength: 6,
    maxlength: 6,
    unique: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

const Org = mongoose.model('Org', orgSchema)

export default Org
