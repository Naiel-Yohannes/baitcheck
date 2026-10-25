import { randomInt as cryptoRandomInt } from 'node:crypto'
import Org from '../models/Org.js'

export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateJoinCode(randomInt = cryptoRandomInt) {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)]
  }
  return code
}

export async function createOrgWithUniqueCode({ name, createdBy }, OrgModel = Org) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await OrgModel.create({
        name,
        joinCode: generateJoinCode(),
        createdBy,
      })
    } catch (err) {
      if (err?.code !== 11000) throw err
      if (attempt === 4) {
        throw new Error('Could not generate a unique organization join code after 5 attempts')
      }
    }
  }

  throw new Error('Could not generate a unique organization join code after 5 attempts')
}
