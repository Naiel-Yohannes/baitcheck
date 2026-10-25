import mongoose from 'mongoose'
import { describe, expect, it } from 'vitest'
import { toUserResponse } from '../utils/userResponse.js'

describe('toUserResponse', () => {
  it('returns the API user shape with string ids and no private model fields', () => {
    const id = new mongoose.Types.ObjectId()
    const orgId = new mongoose.Types.ObjectId()
    const response = toUserResponse({
      _id: id,
      name: 'Aster Bekele',
      email: 'aster@example.com',
      role: 'employee',
      orgId,
      passwordHash: 'must-not-be-returned',
    }, { name: 'BaitCheck Team' })

    expect(response).toEqual({
      id: id.toString(),
      name: 'Aster Bekele',
      email: 'aster@example.com',
      role: 'employee',
      orgId: orgId.toString(),
      orgName: 'BaitCheck Team',
    })
    expect(typeof response.id).toBe('string')
    expect(typeof response.orgId).toBe('string')
    expect(response).not.toHaveProperty('_id')
    expect(response).not.toHaveProperty('passwordHash')
  })

  it('returns null organization fields for an individual', () => {
    const id = new mongoose.Types.ObjectId()
    const response = toUserResponse({
      _id: id,
      name: 'Aster Bekele',
      email: 'aster@example.com',
      role: 'individual',
      orgId: null,
      passwordHash: 'must-not-be-returned',
    }, null)

    expect(response).toEqual({
      id: id.toString(),
      name: 'Aster Bekele',
      email: 'aster@example.com',
      role: 'individual',
      orgId: null,
      orgName: null,
    })
  })
})
