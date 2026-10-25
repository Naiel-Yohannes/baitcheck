import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'attacker'],
  },
  text: String,
  stageIndex: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: false })

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  orgId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Org',
    default: null,
    index: true,
  },
  scenarioId: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    enum: ['en', 'am'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'finished'],
    default: 'active',
  },
  stageIndex: {
    type: Number,
    default: 0,
  },
  turnCount: {
    type: Number,
    default: 0,
  },
  messages: {
    type: [messageSchema],
    default: [],
  },
  endReason: {
    type: String,
    enum: ['user_button', 'end_signal', 'max_turns', 'scenario_complete'],
    default: null,
  },
  score: {
    type: Number,
    default: null,
  },
  band: {
    type: String,
    default: null,
  },
  report: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  finishedAt: {
    type: Date,
    default: null,
  },
})

sessionSchema.index({ orgId: 1, status: 1 })
sessionSchema.index({ userId: 1, createdAt: -1 })

const Session = mongoose.model('Session', sessionSchema)

export default Session
