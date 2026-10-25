export const DEMO_EMAIL_DOMAIN = 'demo.example.com'
export const DEMO_PASSWORD = 'DemoPass123'
export const DEMO_JOIN_CODE = 'BEAT42'
export const DEMO_ORG_NAME = 'Demo Org'

export const SCENARIOS = {
  'mobile-money-call': {
    id: 'mobile-money-call',
    title: 'The Urgent Bank Call',
    stages: [
      { id: 'authority', technique: 'Authority', explanation: 'The caller claims to represent a trusted financial institution.' },
      { id: 'urgency', technique: 'Urgency', explanation: 'The caller says immediate action is needed to avoid a problem.' },
      { id: 'pretexting', technique: 'Pretexting', explanation: 'The caller invents a believable reason to request account details.' },
      { id: 'pressure-and-fear', technique: 'Pressure and fear', explanation: 'The caller uses a possible loss to pressure the target.' },
    ],
    checkpoints: [
      { id: 'verify_caller', weight: 2, description: 'Verify the caller through an independently trusted channel.' },
      { id: 'refuse_code', weight: 4, description: 'Refuse to share a PIN or one-time code with the caller.' },
      { id: 'resist_urgency', weight: 2, description: 'Pause and resist pressure to act immediately.' },
      { id: 'end_conversation', weight: 2, description: 'End the suspicious conversation safely.' },
    ],
    opening: 'Hello, I am calling about an urgent account issue.',
    replies: [
      'I can help resolve this quickly.',
      'Please stay on the line while I check.',
      'There is no need to worry if you act now.',
      'I will explain the next step.',
    ],
  },
  'telegram-job-offer': {
    id: 'telegram-job-offer',
    title: 'The Telegram Job Offer',
    stages: [
      { id: 'reward-lure', technique: 'Reward lure', explanation: 'The sender promises easy earnings for a small task.' },
      { id: 'rapport-building', technique: 'Rapport building', explanation: 'The sender uses friendly conversation to build trust.' },
      { id: 'scarcity', technique: 'Scarcity', explanation: 'The sender claims the opportunity is available for a short time.' },
      { id: 'growing-request', technique: 'Growing request', explanation: 'The sender gradually asks for more money or personal information.' },
    ],
    checkpoints: [
      { id: 'job_verify_employer', weight: 2, description: 'Check the employer and job through an independent source.' },
      { id: 'refuse_code', weight: 4, description: 'Refuse to pay an upfront fee or share a verification code.' },
      { id: 'job_resist_scarcity', weight: 2, description: 'Take time to review the offer despite a deadline.' },
      { id: 'job_end_contact', weight: 2, description: 'Stop contact when the offer remains suspicious.' },
    ],
    opening: 'I have a simple online job that pays very well.',
    replies: [
      'Many people have already joined.',
      'The first task is very easy.',
      'You should reserve your place today.',
      'A small payment will unlock your earnings.',
    ],
  },
  'boss-favor': {
    id: 'boss-favor',
    title: 'The Boss Who Needs a Favor',
    stages: [
      { id: 'boss-authority', technique: 'Authority', explanation: 'The sender pretends to be a workplace leader.' },
      { id: 'boss-urgency', technique: 'Urgency', explanation: 'The sender asks for quick help before a deadline.' },
      { id: 'secrecy', technique: 'Secrecy', explanation: 'The sender asks that the request be kept confidential.' },
      { id: 'impersonation', technique: 'Impersonation', explanation: 'The sender imitates a familiar person to make the request seem genuine.' },
    ],
    checkpoints: [
      { id: 'boss_verify_request', weight: 2, description: 'Verify the request with the colleague using a known channel.' },
      { id: 'refuse_code', weight: 4, description: 'Refuse to share a PIN or one-time code.' },
      { id: 'boss_resist_urgency', weight: 2, description: 'Pause instead of acting under pressure.' },
      { id: 'boss_reject_secrecy', weight: 2, description: 'Question a request that must be kept secret.' },
    ],
    opening: 'Can you help me with a quick work favor?',
    replies: [
      'I need this handled soon.',
      'It should only take a moment.',
      'Please keep this between us for now.',
      'I will send the details shortly.',
    ],
  },
}

export function bandForScore(score) {
  if (score < 40) return 'vulnerable'
  if (score < 70) return 'partial'
  if (score < 90) return 'resilient'
  return 'strong'
}

export function computeScore(checkpoints) {
  const judged = checkpoints.filter(checkpoint => checkpoint.status === 'passed' || checkpoint.status === 'failed')
  const totalWeight = judged.reduce((sum, checkpoint) => sum + checkpoint.weight, 0)
  if (totalWeight === 0) return 0
  const passedWeight = judged
    .filter(checkpoint => checkpoint.status === 'passed')
    .reduce((sum, checkpoint) => sum + checkpoint.weight, 0)
  return Math.round(100 * passedWeight / totalWeight)
}

function feedbackFor(checkpoints) {
  const passed = checkpoints.filter(checkpoint => checkpoint.status === 'passed')
  const failed = checkpoints.filter(checkpoint => checkpoint.status === 'failed')
  const codeCheckpoint = checkpoints.find(checkpoint => checkpoint.weight === 4)
  const summary = codeCheckpoint.status === 'passed'
    ? 'You protected sensitive information during the conversation.'
    : 'The conversation included a risky request for sensitive information.'

  return {
    summary,
    didWell: passed.slice(0, 3).map(checkpoint => `You ${checkpoint.description.charAt(0).toLowerCase()}${checkpoint.description.slice(1)}`),
    improve: failed.slice(0, 3).map(checkpoint => `Next time, ${checkpoint.description.charAt(0).toLowerCase()}${checkpoint.description.slice(1)}`),
    nextTime: ['Pause, verify the request, and use a trusted contact method.'],
  }
}

export function buildReport({ scenario, outcomes, endReason, turnCount, createdAt }) {
  const checkpoints = scenario.checkpoints.map((checkpoint, index) => {
    const passed = outcomes[index] === true
    return {
      id: checkpoint.id,
      weight: checkpoint.weight,
      method: checkpoint.weight === 4 ? 'code' : 'ai',
      status: passed ? 'passed' : 'failed',
      description: checkpoint.description,
      evidence: passed && checkpoint.weight !== 4 ? 'I will verify this request independently.' : null,
    }
  })
  const score = computeScore(checkpoints)
  const stageCount = Math.min(Math.floor(turnCount / 2), 3) + 1
  const timeline = scenario.stages.slice(0, stageCount).map((stage, stageIndex) => ({
    stageId: stage.id,
    technique: stage.technique,
    explanation: stage.explanation,
    startedAtTurn: stageIndex * 2,
  }))

  return {
    score,
    band: bandForScore(score),
    degraded: false,
    scenarioId: scenario.id,
    scenarioTitle: scenario.title,
    language: 'en',
    endReason,
    turnCount,
    checkpoints,
    timeline,
    feedback: feedbackFor(checkpoints),
    createdAt: new Date(createdAt).toISOString(),
  }
}

export function buildMessages({ scenario, userLines }) {
  const messages = [{
    role: 'attacker',
    text: scenario.opening,
    stageIndex: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  }]

  userLines.forEach((text, index) => {
    const turnNumber = index + 1
    const stageIndex = Math.min(Math.floor(turnNumber / 2), 3)
    const createdAt = new Date(Date.UTC(2026, 0, 1, 0, index * 2 + 1))
    messages.push({ role: 'user', text, stageIndex, createdAt })
    messages.push({
      role: 'attacker',
      text: scenario.replies[Math.min(index, scenario.replies.length - 1)],
      stageIndex,
      createdAt: new Date(createdAt.getTime() + 60_000),
    })
  })

  return messages
}

const plannedSession = (scenarioId, targetScore, endReason, daysAgo, turnCount = 4) => ({
  scenarioId,
  targetScore,
  endReason,
  daysAgo,
  turnCount,
})

export const DEMO_PLAN = {
  admin: {
    key: 'admin', name: 'Demo Admin', email: `admin@${DEMO_EMAIL_DOMAIN}`, role: 'orgAdmin', inOrg: true,
    sessions: [plannedSession('mobile-money-call', 20, 'user_button', 25)],
  },
  employees: [
    {
      key: 'hana', name: 'Hana Girma', email: `hana@${DEMO_EMAIL_DOMAIN}`, role: 'employee', inOrg: true,
      sessions: [
        plannedSession('mobile-money-call', 100, 'scenario_complete', 23),
        plannedSession('telegram-job-offer', 60, 'end_signal', 17, 6),
        plannedSession('boss-favor', 20, 'max_turns', 9, 8),
      ],
    },
    {
      key: 'selam', name: 'Selam Tadesse', email: `selam@${DEMO_EMAIL_DOMAIN}`, role: 'employee', inOrg: true,
      sessions: [
        plannedSession('telegram-job-offer', 80, 'user_button', 20),
        plannedSession('boss-favor', 60, 'scenario_complete', 6, 6),
      ],
    },
    { key: 'dawit', name: 'Dawit Bekele', email: `dawit@${DEMO_EMAIL_DOMAIN}`, role: 'employee', inOrg: true, sessions: [] },
  ],
  individual: {
    key: 'meron', name: 'Meron Haile', email: `meron@${DEMO_EMAIL_DOMAIN}`, role: 'individual', inOrg: false,
    sessions: [
      plannedSession('mobile-money-call', 80, 'end_signal', 28),
      plannedSession('telegram-job-offer', 40, 'user_button', 19, 6),
      plannedSession('boss-favor', 100, 'scenario_complete', 11, 8),
      { ...plannedSession('boss-favor', null, null, 2, 1), status: 'active' },
    ],
  },
}

function outcomesFor(score) {
  if (score === 100) return [true, true, true, true]
  if (score === 80) return [false, true, true, true]
  if (score === 60) return [true, true, false, false]
  if (score === 40) return [false, true, false, false]
  return [true, false, false, false]
}

function userLinesFor(turnCount, codePassed) {
  const safeLines = ['fee 500 birr', 'voucher VCH-1234', 'OTP 739204', 'PIN 4821']
  const lines = Array.from({ length: turnCount }, (_, index) => safeLines[index % safeLines.length])
  if (!codePassed && lines.length > 0) lines[0] = 'PIN 4821'
  return lines
}

function rebaseMessages(messages, createdAt) {
  const start = new Date(createdAt).getTime()
  return messages.map((message, index) => ({
    ...message,
    createdAt: new Date(start + index * 60_000),
  }))
}

export function buildDemoData(now, passwordHash) {
  const currentTime = new Date(now).getTime()
  const users = [DEMO_PLAN.admin, ...DEMO_PLAN.employees, DEMO_PLAN.individual].map(user => ({
    key: user.key,
    name: user.name,
    email: user.email,
    role: user.role,
    passwordHash,
    inOrg: user.inOrg,
  }))
  const sessions = []

  for (const user of [DEMO_PLAN.admin, ...DEMO_PLAN.employees, DEMO_PLAN.individual]) {
    for (const plan of user.sessions) {
      const createdAt = new Date(currentTime - plan.daysAgo * 24 * 60 * 60 * 1000)
      const isActive = plan.status === 'active'
      const targetOutcomes = isActive ? null : outcomesFor(plan.targetScore)
      const scenario = SCENARIOS[plan.scenarioId]
      const userLines = userLinesFor(plan.turnCount, targetOutcomes?.[1] === true)
      const messages = rebaseMessages(buildMessages({ scenario, userLines }), createdAt)
      const report = isActive ? null : buildReport({
        scenario,
        outcomes: targetOutcomes,
        endReason: plan.endReason,
        turnCount: plan.turnCount,
        createdAt,
      })
      const score = report?.score ?? null
      sessions.push({
        userKey: user.key,
        scenarioId: plan.scenarioId,
        language: 'en',
        status: isActive ? 'active' : 'finished',
        stageIndex: isActive ? 0 : Math.min(Math.floor(plan.turnCount / 2), 3),
        turnCount: plan.turnCount,
        messages,
        endReason: plan.endReason,
        score,
        band: report?.band ?? null,
        report,
        createdAt,
        finishedAt: isActive ? null : new Date(createdAt.getTime() + 15 * 60 * 1000),
      })
    }
  }

  return {
    org: { name: DEMO_ORG_NAME, joinCode: DEMO_JOIN_CODE },
    users,
    sessions,
  }
}
