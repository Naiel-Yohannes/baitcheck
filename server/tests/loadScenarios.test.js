import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadScenarios } from '../scenarios/loadScenarios.js'

const sourceFile = fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url))
const temporaryDirectories = []

async function newDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'baitcheck-scenarios-'))
  temporaryDirectories.push(directory)
  return directory
}

async function scenarioText() {
  return readFile(sourceFile, 'utf8')
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('loadScenarios', () => {
  it('loads a good scenario file', async () => {
    const directory = await newDirectory()
    await writeFile(join(directory, 'mobile-money-call.json'), await scenarioText())
    const store = await loadScenarios(directory)
    expect(store.getAll()).toHaveLength(1)
    expect(store.getById('mobile-money-call')).toBeDefined()
  })

  it('reports broken JSON with its filename', async () => {
    const directory = await newDirectory()
    await writeFile(join(directory, 'broken.json'), '{')
    await expect(loadScenarios(directory)).rejects.toThrow('broken.json: invalid JSON')
  })

  it('reports a filename that does not match the scenario id', async () => {
    const directory = await newDirectory()
    await writeFile(join(directory, 'wrong-name.json'), await scenarioText())
    await expect(loadScenarios(directory)).rejects.toThrow('wrong-name.json: file name must match scenario id')
  })

  it('reports duplicate ids and includes every problem line', async () => {
    const directory = await newDirectory()
    const text = await scenarioText()
    await writeFile(join(directory, 'first.json'), text)
    await writeFile(join(directory, 'second.json'), text)
    try {
      await loadScenarios(directory, { expectedCount: 3 })
      throw new Error('expected loadScenarios to fail')
    } catch (error) {
      expect(error.message).toContain('first.json: file name must match scenario id')
      expect(error.message).toContain('second.json: file name must match scenario id')
      expect(error.message).toContain('duplicate scenario id')
      expect(error.message).toContain('expected 3 scenarios, found 2')
      expect(error.message.split('\n')).toHaveLength(4)
    }
  })

  it('checks expectedCount when supplied and accepts a smaller set when null', async () => {
    const directory = await newDirectory()
    await writeFile(join(directory, 'mobile-money-call.json'), await scenarioText())
    await expect(loadScenarios(directory, { expectedCount: 3 })).rejects.toThrow('expected 3 scenarios, found 1')
    await expect(loadScenarios(directory, { expectedCount: null })).resolves.toMatchObject({
      getAll: expect.any(Function),
    })
  })
})
