import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createScenarioStore } from './scenarioStore.js'
import { validateScenarioSet } from './validateScenario.js'

export async function loadScenarios(dir, { expectedCount = null } = {}) {
  const filenames = (await readdir(dir)).filter(filename => filename.endsWith('.json')).sort()
  const scenarios = []
  const problems = []

  for (const filename of filenames) {
    const fullPath = join(dir, filename)
    let scenario
    try {
      scenario = JSON.parse(await readFile(fullPath, 'utf8'))
    } catch {
      problems.push(`${filename}: invalid JSON`)
      continue
    }

    const expectedId = filename.slice(0, -'.json'.length)
    if (scenario?.id !== expectedId) {
      problems.push(`${filename}: file name must match scenario id (${String(scenario?.id ?? 'missing')})`)
    }
    scenarios.push(scenario)
  }

  problems.push(...validateScenarioSet(scenarios, { expectedCount }))
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return createScenarioStore(scenarios)
}
