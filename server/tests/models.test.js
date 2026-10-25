import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import Org from '../models/Org.js'
import Session from '../models/Session.js'
import User from '../models/User.js'

const objectId = () => new mongoose.Types.ObjectId()

describe('User model', () => {
  it('accepts a valid user', () => {
    const user = new User({
      name: '  Aster Bekele  ',
      email: 'ASTER@example.com ',
      passwordHash: 'hashed-password',
    })

    expect(user.validateSync()).toBeUndefined()
    expect(user.name).toBe('Aster Bekele')
    expect(user.email).toBe('aster@example.com')
  })

  it('rejects a one-character name and an invalid role', () => {
    const badName = new User({ name: 'A', email: 'a@example.com', passwordHash: 'hash' })
    const badRole = new User({ name: 'Aster', email: 'a@example.com', passwordHash: 'hash', role: 'admin' })

    expect(badName.validateSync()?.errors.name).toBeDefined()
    expect(badRole.validateSync()?.errors.role).toBeDefined()
  })

  it('defaults role to individual and orgId to null', () => {
    const user = new User({ name: 'Aster', email: 'a@example.com', passwordHash: 'hash' })

    expect(user.role).toBe('individual')
    expect(user.orgId).toBeNull()
  })
})

describe('Org model', () => {
  it('accepts a valid organization', () => {
    const org = new Org({ name: '  BaitCheck Team ', joinCode: 'ABC234', createdBy: objectId() })

    expect(org.validateSync()).toBeUndefined()
    expect(org.name).toBe('BaitCheck Team')
  })

  it('uppercases join codes and rejects a code that is not six characters', () => {
    const lowercase = new Org({ name: 'Team Org', joinCode: 'abc234', createdBy: objectId() })
    const tooShort = new Org({ name: 'Team Org', joinCode: 'ABC23', createdBy: objectId() })

    expect(lowercase.joinCode).toBe('ABC234')
    expect(lowercase.validateSync()).toBeUndefined()
    expect(tooShort.validateSync()?.errors.joinCode).toBeDefined()
  })
})

describe('Session model', () => {
  it('accepts a valid session and message subdocuments have no _id', () => {
    const session = new Session({
      userId: objectId(),
      scenarioId: 'urgent-bank-call',
      language: 'en',
      messages: [{ role: 'attacker', text: 'Hello', stageIndex: 0 }],
    })

    expect(session.validateSync()).toBeUndefined()
    expect(session.messages[0]._id).toBeUndefined()
  })

  it('rejects a bad language and a bad status', () => {
    const badLanguage = new Session({ userId: objectId(), scenarioId: 'scenario', language: 'fr' })
    const badStatus = new Session({ userId: objectId(), scenarioId: 'scenario', language: 'en', status: 'paused' })

    expect(badLanguage.validateSync()?.errors.language).toBeDefined()
    expect(badStatus.validateSync()?.errors.status).toBeDefined()
  })

  it('applies the required defaults', () => {
    const session = new Session({ userId: objectId(), scenarioId: 'scenario', language: 'am' })

    expect(session.status).toBe('active')
    expect(session.stageIndex).toBe(0)
    expect(session.turnCount).toBe(0)
    expect(session.score).toBeNull()
    expect(session.report).toBeNull()
  })
})
