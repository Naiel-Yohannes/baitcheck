import jwt from 'jsonwebtoken'

export function signToken(userId, secret) {
  return jwt.sign({ sub: String(userId) }, secret, {
    algorithm: 'HS256',
    expiresIn: '7d',
  })
}

export function verifyToken(token, secret) {
  return jwt.verify(token, secret, { algorithms: ['HS256'] })
}
