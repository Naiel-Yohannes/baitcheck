function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

export function createScenarioStore(scenarios) {
  const entries = JSON.parse(JSON.stringify(Array.isArray(scenarios) ? scenarios : []))
  const frozenEntries = deepFreeze(entries)
  const byId = new Map(frozenEntries.map(scenario => [scenario?.id, scenario]))

  return {
    getAll() {
      return frozenEntries
    },
    getById(id) {
      return byId.get(id)
    },
    listPublic() {
      return frozenEntries.map(scenario => ({
        id: scenario.id,
        title: scenario.title,
        description: scenario.description,
        languages: scenario.languages,
        channel: scenario.channel,
        estimatedMinutes: scenario.estimatedMinutes,
      }))
    },
    getTitle(id, language) {
      const title = byId.get(id)?.title
      if (!title || typeof title !== 'object') return null
      return title[language] ?? title.en ?? null
    },
  }
}
