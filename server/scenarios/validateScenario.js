const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const nonEmptyString = value => typeof value === 'string' && value.trim().length > 0

export function validateScenario(scenario) {
  const id = isObject(scenario) && typeof scenario.id === 'string' && scenario.id.trim()
    ? scenario.id
    : 'unknown'
  const problems = []
  const add = message => problems.push(`${id}: ${message}`)

  try {
    if (!isObject(scenario)) {
      add('scenario must be an object')
      return problems
    }

    if (typeof scenario.id !== 'string' || !/^[a-z0-9-]+$/.test(scenario.id)) add('id must contain only lowercase letters, numbers, and hyphens')

    const localized = (value, field) => {
      if (!isObject(value)) {
        add(`${field} must have en and am strings`)
        return
      }
      for (const language of ['en', 'am']) {
        if (!nonEmptyString(value[language])) add(`${field}.${language} must be a non-empty string`)
      }
    }
    const positiveInteger = (value, field) => {
      if (!Number.isInteger(value) || value <= 0) add(`${field} must be a positive integer`)
    }
    const checkUniqueIds = (items, field) => {
      const found = new Set()
      for (const item of items) {
        if (!isObject(item) || !nonEmptyString(item.id)) {
          add(`${field} items must have a non-empty id`)
          continue
        }
        if (found.has(item.id)) add(`${field} ids must be unique`)
        found.add(item.id)
      }
      return found
    }

    localized(scenario.title, 'title')
    localized(scenario.description, 'description')
    if (!Array.isArray(scenario.languages)) {
      add('languages must contain unique values en and am')
    } else {
      if (new Set(scenario.languages).size !== scenario.languages.length) add('languages must not contain duplicates')
      if (scenario.languages.some(language => !['en', 'am'].includes(language))) add('languages may contain only en and am')
      for (const language of ['en', 'am']) {
        if (!scenario.languages.includes(language)) add(`languages must include ${language}`)
      }
    }
    if (!['call', 'telegram', 'message'].includes(scenario.channel)) add('channel must be call, telegram, or message')
    positiveInteger(scenario.estimatedMinutes, 'estimatedMinutes')
    positiveInteger(scenario.maxTurns, 'maxTurns')
    positiveInteger(scenario.turnsPerStage, 'turnsPerStage')

    const fakeKeys = new Set()
    if (!isObject(scenario.persona)) {
      add('persona must be an object')
    } else {
      localized(scenario.persona.userRole, 'persona.userRole')
      const fakeData = scenario.persona.fakeData
      if (!Array.isArray(fakeData) || fakeData.length === 0) {
        add('persona.fakeData must be a non-empty array')
      } else {
        for (const item of fakeData) {
          if (!isObject(item)) {
            add('persona.fakeData items must be objects')
            continue
          }
          if (!nonEmptyString(item.key)) add('persona.fakeData keys must be non-empty strings')
          else if (fakeKeys.has(item.key)) add('persona.fakeData keys must be unique')
          else fakeKeys.add(item.key)
          localized(item.label, 'persona.fakeData.label')
          if (!nonEmptyString(item.value)) add('persona.fakeData.value must be a non-empty string')
        }
      }
    }

    if (!isObject(scenario.attacker)) {
      add('attacker must be an object')
    } else {
      localized(scenario.attacker.identity, 'attacker.identity')
      if (!nonEmptyString(scenario.attacker.goal)) add('attacker.goal must be a non-empty string')
      if (!nonEmptyString(scenario.attacker.style)) add('attacker.style must be a non-empty string')
    }
    localized(scenario.openingLine, 'openingLine')
    localized(scenario.fallbackLine, 'fallbackLine')

    if (!isObject(scenario.endSignals)) {
      add('endSignals must contain en and am arrays')
    } else {
      for (const language of ['en', 'am']) {
        const signals = scenario.endSignals[language]
        if (!Array.isArray(signals) || signals.length === 0 || signals.some(signal => !nonEmptyString(signal))) {
          add(`endSignals.${language} must be a non-empty array of non-empty strings`)
        }
      }
    }

    const stages = Array.isArray(scenario.stages) ? scenario.stages : []
    if (!Array.isArray(scenario.stages) || stages.length < 3 || stages.length > 5) add('stages must contain 3 to 5 items')
    const stageIds = checkUniqueIds(stages, 'stages')
    for (const [index, stage] of stages.entries()) {
      if (!isObject(stage)) continue
      localized(stage.technique, `stages[${index}].technique`)
      localized(stage.instruction, `stages[${index}].instruction`)
      localized(stage.explanation, `stages[${index}].explanation`)
    }

    const checkpoints = Array.isArray(scenario.checkpoints) ? scenario.checkpoints : []
    if (!Array.isArray(scenario.checkpoints) || checkpoints.length === 0) add('checkpoints must be a non-empty array')
    const checkpointIds = checkUniqueIds(checkpoints, 'checkpoints')
    let hasUnstagedCheckpoint = false
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (!isObject(checkpoint)) continue
      localized(checkpoint.description, `checkpoints[${index}].description`)
      positiveInteger(checkpoint.weight, `checkpoints[${index}].weight`)
      if (!['code', 'ai'].includes(checkpoint.detection)) add(`checkpoints[${index}].detection must be code or ai`)
      if (checkpoint.requiresStage === undefined) hasUnstagedCheckpoint = true
      else if (!nonEmptyString(checkpoint.requiresStage) || !stageIds.has(checkpoint.requiresStage)) {
        add(`checkpoints[${index}].requiresStage must match an existing stage id`)
      }

      if (checkpoint.detection === 'ai') {
        if (checkpoint.rule !== undefined) add(`checkpoints[${index}] ai detection must not have a rule`)
      } else if (checkpoint.detection === 'code') {
        if (!['leak', 'endedBy', 'keyword'].includes(checkpoint.rule)) {
          add(`checkpoints[${index}] code rule must be leak, endedBy, or keyword`)
        } else if (checkpoint.rule === 'leak') {
          if (!Array.isArray(checkpoint.keys) || checkpoint.keys.length === 0 || checkpoint.keys.some(key => !nonEmptyString(key))) {
            add(`checkpoints[${index}] leak rule needs a non-empty keys array`)
          } else if (checkpoint.keys.some(key => !fakeKeys.has(key))) {
            add(`checkpoints[${index}] leak keys must exist in persona.fakeData`)
          }
        } else if (checkpoint.rule === 'keyword') {
          if (!isObject(checkpoint.keywords)) {
            add(`checkpoints[${index}] keyword rule needs en and am keyword arrays`)
          } else {
            for (const language of ['en', 'am']) {
              if (!Array.isArray(checkpoint.keywords[language]) || checkpoint.keywords[language].length === 0) {
                add(`checkpoints[${index}] keyword rule needs a non-empty ${language} array`)
              }
            }
          }
        }
      }
    }
    if (checkpoints.length > 0 && !hasUnstagedCheckpoint) add('at least one checkpoint must not have requiresStage')
  } catch {
    if (problems.length === 0) add('scenario could not be validated')
  }

  return problems
}

export function validateScenarioSet(scenarios, { expectedCount = null } = {}) {
  const problems = []
  const list = Array.isArray(scenarios) ? scenarios : []
  if (!Array.isArray(scenarios)) problems.push('unknown: scenarios must be an array')
  if (typeof expectedCount === 'number' && list.length !== expectedCount) {
    problems.push(`unknown: expected ${expectedCount} scenarios, found ${list.length}`)
  }

  const ids = new Set()
  for (const scenario of list) {
    const id = isObject(scenario) && typeof scenario.id === 'string' ? scenario.id : null
    if (id !== null && ids.has(id)) problems.push(`${id}: duplicate scenario id`)
    if (id !== null) ids.add(id)
    problems.push(...validateScenario(scenario))
  }
  return problems
}
