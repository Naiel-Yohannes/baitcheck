import { describe, expect, it } from 'vitest'
import { checkPassword } from '../utils/passwordPolicy.js'

describe('checkPassword', () => {
  it('reports each missing password requirement', () => {
    expect(checkPassword('xyz')).toEqual([
      'PASSWORD_TOO_SHORT',
      'PASSWORD_NEEDS_UPPERCASE',
      'PASSWORD_NEEDS_DIGIT',
      'PASSWORD_NEEDS_SYMBOL',
    ])
    expect(checkPassword('ABCDEF1!')).toEqual(['PASSWORD_NEEDS_LOWERCASE'])
  })

  it('can report several policy issues at once', () => {
    expect(checkPassword('password')).toEqual([
      'PASSWORD_NEEDS_UPPERCASE',
      'PASSWORD_NEEDS_DIGIT',
      'PASSWORD_NEEDS_SYMBOL',
      'PASSWORD_TOO_COMMON',
    ])
  })

  it('rejects common password values and common-prefix variants', () => {
    for (const password of ['Password', 'qwerty', 'welcome!!!', 'admin####', 'aaaaaaaa']) {
      expect(checkPassword(password)).toContain('PASSWORD_TOO_COMMON')
    }
  })

  it('rejects passwords containing the email part or a name word', () => {
    expect(checkPassword('MyAlice2024!', { email: 'alice@example.com' }))
      .toContain('PASSWORD_CONTAINS_EMAIL')
    expect(checkPassword('GreenJoHn2024!', { name: 'John Smith' }))
      .toContain('PASSWORD_CONTAINS_EMAIL')
  })

  it('recognizes a Unicode symbol and accepts a strong password', () => {
    expect(checkPassword('Abcdefg1💜')).toEqual([])
    expect(checkPassword('Abcdef1!')).toEqual([])
  })

  it('requires a symbol for DemoPass123 and reports no other issue', () => {
    expect(checkPassword('DemoPass123')).toEqual(['PASSWORD_NEEDS_SYMBOL'])
  })
})
