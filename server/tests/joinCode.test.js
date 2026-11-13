import { describe, expect, it, vi } from 'vitest'
import { createOrgWithUniqueCode, generateJoinCode, rotateOrgJoinCode, JOIN_CODE_ALPHABET } from '../utils/joinCode.js'

describe('generateJoinCode', () => {
  it('returns six characters from the alphabet over 500 calls', () => {
    for (let call = 0; call < 500; call += 1) {
      const code = generateJoinCode()
      expect(code).toHaveLength(6)
      expect([...code].every((character) => JOIN_CODE_ALPHABET.includes(character))).toBe(true)
      expect(code).not.toMatch(/[0O1I]/)
    }
  })
})

describe('createOrgWithUniqueCode', () => {
  it('retries once after a duplicate key error', async () => {
    const createdOrg = { name: 'BaitCheck', joinCode: 'XYZ789' }
    const duplicateKey = Object.assign(new Error('duplicate key'), { code: 11000 })
    const OrgModel = {
      create: vi.fn()
        .mockRejectedValueOnce(duplicateKey)
        .mockResolvedValueOnce(createdOrg),
    }

    await expect(createOrgWithUniqueCode({ name: 'BaitCheck', createdBy: 'user-id' }, OrgModel)).resolves.toBe(createdOrg)
    expect(OrgModel.create).toHaveBeenCalledTimes(2)
    expect(OrgModel.create.mock.calls[0][0].joinCode).toHaveLength(6)
    expect(OrgModel.create.mock.calls[1][0].joinCode).toHaveLength(6)
  })

  it('throws a plain Error after five duplicate-key attempts', async () => {
    const duplicateKey = Object.assign(new Error('duplicate key'), { code: 11000 })
    const OrgModel = { create: vi.fn().mockRejectedValue(duplicateKey) }

    await expect(createOrgWithUniqueCode({ name: 'BaitCheck', createdBy: 'user-id' }, OrgModel)).rejects.toThrow(Error)
    expect(OrgModel.create).toHaveBeenCalledTimes(5)
  })
})

describe('rotateOrgJoinCode', () => {
  it('retries a duplicate key and returns the saved code', async () => {
    const duplicateKey = Object.assign(new Error('duplicate key'), { code: 11000 })
    const OrgModel = {
      findOneAndUpdate: vi.fn()
        .mockRejectedValueOnce(duplicateKey)
        .mockImplementationOnce((_filter, update) => Promise.resolve({ joinCode: update.$set.joinCode })),
    }

    const joinCode = await rotateOrgJoinCode('org1', OrgModel)
    expect(OrgModel.findOneAndUpdate).toHaveBeenCalledTimes(2)
    expect(joinCode).toHaveLength(6)
    expect(OrgModel.findOneAndUpdate.mock.calls[1][1].$set.joinCode).toBe(joinCode)
  })

  it('returns null when the organization no longer exists', async () => {
    const OrgModel = { findOneAndUpdate: vi.fn().mockResolvedValue(null) }
    await expect(rotateOrgJoinCode('missing', OrgModel)).resolves.toBeNull()
  })
})
