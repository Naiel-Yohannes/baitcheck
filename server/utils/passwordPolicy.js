const COMMON_PASSWORDS = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890',
  '12345678910', '12345', '123123', '111111', '000000', '00000000',
  '121212', '654321', '987654321', 'qwerty', 'qwerty123',
  '1q2w3e4r', '123qwe', '1qaz2wsx', 'asdfgh', 'asdfghjkl',
  'zxcvbnm', 'letmein', 'welcome', 'welcome1', 'password',
  'password1', 'password123', 'passw0rd', 'pass1234', 'admin',
  'admin123', 'administrator', 'iloveyou', 'abc123', 'abc12345',
  'monkey', 'dragon', 'master', 'sunshine', 'princess', 'football',
  'baseball', 'shadow', 'superman', 'trustno1', 'login', 'whatever',
  'freedom', 'hello', 'hello123', 'starwars', 'ashley', 'bailey',
  'flower', 'donald', 'secret', 'qwertyuiop', '00000001', '654321',
])

const COMMON_PASSWORD_PATTERN = /^(password|qwerty|letmein|welcome|admin|iloveyou|abc)[^a-z]*$/i
const REPEATED_CHARACTER_PATTERN = /^(.)\1*$/us

export function checkPassword(password, { email = '', name = '' } = {}) {
  const issues = []
  const lowerPassword = password.toLowerCase()

  if ([...password].length < 8) issues.push('PASSWORD_TOO_SHORT')
  if (!/[a-z]/.test(password)) issues.push('PASSWORD_NEEDS_LOWERCASE')
  if (!/[A-Z]/.test(password)) issues.push('PASSWORD_NEEDS_UPPERCASE')
  if (!/[0-9]/.test(password)) issues.push('PASSWORD_NEEDS_DIGIT')
  if (!/[^\p{L}\p{N}]/u.test(password)) issues.push('PASSWORD_NEEDS_SYMBOL')
  if (
    COMMON_PASSWORDS.has(lowerPassword) ||
    COMMON_PASSWORD_PATTERN.test(password) ||
    REPEATED_CHARACTER_PATTERN.test(password)
  ) {
    issues.push('PASSWORD_TOO_COMMON')
  }

  const emailPart = email.split('@')[0]
  const nameWords = name.match(/\p{L}{4,}/gu) ?? []
  if (
    ([...emailPart].length >= 4 && lowerPassword.includes(emailPart.toLowerCase())) ||
    nameWords.some(word => lowerPassword.includes(word.toLowerCase()))
  ) {
    issues.push('PASSWORD_CONTAINS_EMAIL')
  }

  return issues
}
