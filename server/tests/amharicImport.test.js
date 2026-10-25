import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectRows, toTsv } from '../scripts/amharicSheetLib.js'
import { validateScenario } from '../scenarios/validateScenario.js'

const serverDir = fileURLToPath(new URL('../', import.meta.url))
const script = join(serverDir, 'scripts/amharicImport.js')
const sourceDir = join(serverDir, 'scenarios')
const tempDirs = []

async function tempDir() {
  const path = await mkdtemp(join(tmpdir(), 'baitcheck-amharic-'))
  tempDirs.push(path)
  return path
}

async function scenarioCopy(dir, name = 'mobile-money-call.json') {
  const source = JSON.parse(await readFile(join(sourceDir, name), 'utf8'))
  const target = join(dir, name)
  await writeFile(target, `${JSON.stringify(source, null, 2)}\n`)
  return { source, target }
}

function tsvWithCorrection(row) {
  const exported = toTsv([row])
  return `${exported.slice(0, exported.lastIndexOf('\t') + 1)}${row.amharic_corrected}`
}

let invocation = 0

async function runImport(tsvPath, scenariosDir, outDir, apply = false) {
  const savedArgv = process.argv
  const savedScenariosDir = process.env.BAITCHECK_SCENARIOS_DIR
  const savedOutDir = process.env.BAITCHECK_AMHARIC_OUT_DIR
  const stdoutWrite = process.stdout.write
  const stderrWrite = process.stderr.write
  let stdout = ''
  let stderr = ''
  process.argv = [process.execPath, script, tsvPath, ...(apply ? ['--apply'] : [])]
  process.env.BAITCHECK_SCENARIOS_DIR = scenariosDir
  process.env.BAITCHECK_AMHARIC_OUT_DIR = outDir
  process.stdout.write = chunk => { stdout += chunk; return true }
  process.stderr.write = chunk => { stderr += chunk; return true }
  process.exitCode = 0
  try {
    await import(`${new URL(`file://${script}`).href}?test=${invocation++}`)
    return { status: process.exitCode ?? 0, stdout, stderr }
  } finally {
    process.argv = savedArgv
    if (savedScenariosDir === undefined) delete process.env.BAITCHECK_SCENARIOS_DIR
    else process.env.BAITCHECK_SCENARIOS_DIR = savedScenariosDir
    if (savedOutDir === undefined) delete process.env.BAITCHECK_AMHARIC_OUT_DIR
    else process.env.BAITCHECK_AMHARIC_OUT_DIR = savedOutDir
    process.stdout.write = stdoutWrite
    process.stderr.write = stderrWrite
    process.exitCode = 0
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

describe('Amharic TSV importer', () => {
  it('dry runs without writing any files', async () => {
    const dir = await tempDir()
    const { source, target } = await scenarioCopy(dir)
    const row = collectRows(source, 'server/scenarios/mobile-money-call.json').find(item => item.path === 'title.am')
    const tsvPath = join(dir, 'review.tsv')
    await writeFile(tsvPath, `${tsvWithCorrection({ ...row, amharic_corrected: 'ርዕስ አዲስ' })}\n`)
    const result = await runImport(tsvPath, dir, join(dir, 'out'))
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('would change 1 values in 1 files')
    expect(await readFile(target, 'utf8')).toBe(`${JSON.stringify(source, null, 2)}\n`)
    expect(await readdir(dir)).toEqual(['mobile-money-call.json', 'review.tsv'])
  })

  it('applies only changed scenario files and validates them', async () => {
    const dir = await tempDir()
    const { source, target } = await scenarioCopy(dir)
    const other = JSON.parse(await readFile(join(sourceDir, 'boss-favor.json'), 'utf8'))
    const otherPath = join(dir, 'boss-favor.json')
    await writeFile(otherPath, `${JSON.stringify(other, null, 2)}\n`)
    const row = collectRows(source, 'server/scenarios/mobile-money-call.json').find(item => item.path === 'title.am')
    const tsvPath = join(dir, 'review.tsv')
    await writeFile(tsvPath, `${tsvWithCorrection({ ...row, amharic_corrected: 'አዲስ ርዕስ' })}\n`)
    const beforeOther = await readFile(otherPath, 'utf8')
    const result = await runImport(tsvPath, dir, join(dir, 'out'), true)
    expect(result.status).toBe(0)
    const updated = JSON.parse(await readFile(target, 'utf8'))
    expect(updated.title.am).toBe('አዲስ ርዕስ')
    expect(validateScenario(updated)).toEqual([])
    expect(await readFile(otherPath, 'utf8')).toBe(beforeOther)
  })

  it('aborts all writes when a changed scenario fails validation', async () => {
    const dir = await tempDir()
    const { source, target } = await scenarioCopy(dir)
    source.description.am = ''
    const invalidOriginal = `${JSON.stringify(source, null, 2)}\n`
    await writeFile(target, invalidOriginal)
    const row = collectRows(source, 'server/scenarios/mobile-money-call.json').find(item => item.path === 'title.am')
    const tsvPath = join(dir, 'review.tsv')
    await writeFile(tsvPath, `${tsvWithCorrection({ ...row, amharic_corrected: 'ርዕስ ተቀይሯል' })}\n`)
    const result = await runImport(tsvPath, dir, join(dir, 'out'), true)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('description.am must be a non-empty string')
    expect(await readFile(target, 'utf8')).toBe(invalidOriginal)
  })

  it('writes i18n rows only to the correction JSON', async () => {
    const dir = await tempDir()
    const tsvPath = join(dir, 'review.tsv')
    const i18nRow = {
      file: 'client/src/i18n.js', path: 'am.sampleKey', english: 'Example',
      amharic: 'ምሳሌ', amharic_corrected: 'የተስተካከለ',
    }
    await writeFile(tsvPath, `${tsvWithCorrection(i18nRow)}\n`)
    const outDir = join(dir, 'out')
    const result = await runImport(tsvPath, dir, outDir, true)
    expect(result.status).toBe(0)
    expect(JSON.parse(await readFile(join(outDir, 'i18n-corrections.json'), 'utf8')))
      .toEqual({ sampleKey: 'የተስተካከለ' })
    expect(await readdir(dir)).toEqual(['out', 'review.tsv'])
  })
})
