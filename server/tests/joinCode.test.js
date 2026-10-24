import { describe, expect, it, vi } from 'vitest'
import { createOrgWithUniqueCode, generateJoinCode, JOIN_CODE_ALPHABET } from '../utils/joinCode.js'

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
