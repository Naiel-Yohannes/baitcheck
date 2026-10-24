import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { loadConfig } from '../config.js'
import User from '../models/User.js'
import Org from '../models/Org.js'
import Session from '../models/Session.js'
import {
  buildDemoData,
  DEMO_JOIN_CODE,
  DEMO_ORG_NAME,
  DEMO_PASSWORD,
} from './seedData.js'

class ForeignDemoOrgError extends Error {
  constructor() {
    super('Demo join code belongs to a different organization')
    this.name = 'ForeignDemoOrgError'
  }
}

async function removeDemoData() {
  const org = await Org.findOne({ joinCode: DEMO_JOIN_CODE })
  if (org && org.name !== DEMO_ORG_NAME) throw new ForeignDemoOrgError()

  const demoUsers = await User.find({ email: { $regex: /@demo\.example\.com$/i } }).select('_id')
  const userIds = demoUsers.map(user => user._id)
  const sessionFilters = []
  if (userIds.length > 0) sessionFilters.push({ userId: { $in: userIds } })
  if (org) sessionFilters.push({ orgId: org._id })
  if (sessionFilters.length > 0) await Session.deleteMany({ $or: sessionFilters })

  await User.deleteMany({ email: { $regex: /@demo\.example\.com$/i } })
  if (org) await Org.deleteOne({ _id: org._id })
}

async function seed() {
  const config = loadConfig()
  if (config.NODE_ENV === 'production' && !process.argv.includes('--allow-production')) {
    console.error('Refusing to seed production without --allow-production.')
    process.exitCode = 1
    return
  }

  try {
    await mongoose.connect(config.MONGO_URI)
  } catch (error) {
    error.isMongoConnectionFailure = true
    throw error
  }
  await removeDemoData()
  if (process.argv.includes('--remove')) {
    console.log('Demo data removed.')
    return
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const data = buildDemoData(new Date(), passwordHash)
  const usersByKey = new Map()
  const adminData = data.users.find(user => user.key === 'admin')
  const adminId = new mongoose.Types.ObjectId()
  const admin = await User.create({
    _id: adminId,
    name: adminData.name,
    email: adminData.email,
    role: adminData.role,
    passwordHash: adminData.passwordHash,
    orgId: null,
  })
  usersByKey.set(adminData.key, admin)

  const org = await Org.create({
    ...data.org,
    createdBy: admin._id,
  })
  await User.updateOne({ _id: admin._id }, { orgId: org._id })
  admin.orgId = org._id

  for (const userData of data.users) {
    if (userData.key === 'admin') continue
    const user = await User.create({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      passwordHash: userData.passwordHash,
      orgId: userData.inOrg ? org._id : null,
    })
    usersByKey.set(userData.key, user)
  }

  const sessionDocuments = data.sessions.map(session => {
    const user = usersByKey.get(session.userKey)
    const { userKey: _userKey, ...sessionData } = session
    return {
      ...sessionData,
      userId: user._id,
      orgId: user.orgId ?? null,
    }
  })
  await Session.insertMany(sessionDocuments)

  const finishedCount = sessionDocuments.filter(session => session.status === 'finished').length
  const activeCount = sessionDocuments.filter(session => session.status === 'active').length
  console.log(`Demo join code: ${org.joinCode}`)
  console.log('Email                              Role       Password')
  for (const userData of data.users) {
    console.log(`${userData.email.padEnd(34)} ${userData.role.padEnd(10)} ${DEMO_PASSWORD}`)
  }
  console.log(`Created ${data.users.length} users, 1 organization, and ${sessionDocuments.length} sessions (${finishedCount} finished, ${activeCount} active).`)
}

try {
  await seed()
  await mongoose.disconnect()
} catch (error) {
  if (error?.name === 'ForeignDemoOrgError') {
    console.error('Refusing to remove demo data: join code BEAT42 belongs to an organization with a different name.')
  }
  if (error?.isMongoConnectionFailure) {
    console.error(`Could not connect to MongoDB (${error?.name ?? 'Error'}).`)
  } else {
    console.error(`Seeding failed (${error?.name ?? 'Error'}).`)
  }
  await mongoose.disconnect().catch(() => {})
  process.exitCode = 1
}
