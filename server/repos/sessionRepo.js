import mongoose from 'mongoose'
import Session from '../models/Session.js'

function isValidObjectId(id) {
  if (id == null) return false
  const str = String(id)
  return mongoose.isValidObjectId(id) && /^[a-fA-F0-9]{24}$/.test(str)
}

function toPlain(doc) {
  if (!doc) return null
  const plain = { ...doc }
  if (plain._id != null) {
    plain._id = String(plain._id)
    plain.id = String(plain._id)
  }
  if (plain.userId != null) plain.userId = String(plain.userId)
  if (plain.orgId != null) plain.orgId = String(plain.orgId)
  return plain
}

export function createSessionRepo(SessionModel = Session) {
  return {
    async create(data) {
      const created = await SessionModel.create(data)
      const doc = await SessionModel.findById(created._id).lean()
      return toPlain(doc)
    },

    async findOwned(id, userId) {
      if (!isValidObjectId(id)) return null
      const doc = await SessionModel.findOne({ _id: id, userId }).lean()
      return toPlain(doc)
    },

    async listMine(userId, limit = 50) {
      const docs = await SessionModel.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('scenarioId language status score band createdAt finishedAt')
        .lean()
      return docs.map(toPlain)
    },

    async appendTurn({ id, userId, expectedTurnCount, userMessage, attackerMessage, turnCount, stageIndex, endReason }) {
      const doc = await SessionModel.findOneAndUpdate(
        { _id: id, userId, status: 'active', turnCount: expectedTurnCount, endReason: null },
        {
          $push: { messages: { $each: [userMessage, attackerMessage] } },
          $set: { turnCount, stageIndex, ...(endReason ? { endReason } : {}) },
        },
        { new: true },
      ).lean()
      return toPlain(doc)
    },
  }
}
