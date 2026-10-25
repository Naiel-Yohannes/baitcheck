import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, basename, join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyCorrections, parseTsv } from './amharicSheetLib.js'
import { validateScenario } from '../scenarios/validateScenario.js'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(scriptsDir, '..')
const scenariosDir = process.env.BAITCHECK_SCENARIOS_DIR
  ? resolve(process.env.BAITCHECK_SCENARIOS_DIR)
  : join(serverDir, 'scenarios')
const outDir = process.env.BAITCHECK_AMHARIC_OUT_DIR
  ? resolve(process.env.BAITCHECK_AMHARIC_OUT_DIR)
  : join(scriptsDir, 'out')
const args = process.argv.slice(2)
const tsvFile = args.find(arg => arg !== '--apply')
const apply = args.includes('--apply')

async function main() {
  if (!tsvFile) {
    process.stderr.write('Usage: node scripts/amharicImport.js <file.tsv> [--apply]\n')
    process.exitCode = 1
    return
  }

  const rows = parseTsv(await readFile(resolve(tsvFile), 'utf8'))
  const groups = new Map()
  for (const row of rows) {
    const group = groups.get(row.file) ?? []
    group.push(row)
    groups.set(row.file, group)
  }

  const problems = []
  const changedScenarios = []
  const i18nCorrections = {}
  const changedPaths = []
  let changedValues = 0

  for (const [file, fileRows] of groups) {
    if (file === 'client/src/i18n.js') {
      for (const row of fileRows) {
        const corrected = String(row.amharic_corrected ?? '').trim()
        if (!corrected) continue
        const key = String(row.path ?? '').match(/^am\.(.+)$/)?.[1]
        if (!key) {
          problems.push(`${file}:${row.path}: invalid i18n key path`)
          continue
        }
        i18nCorrections[key] = corrected
        changedPaths.push(row.path)
        changedValues += 1
      }
      continue
    }

    const relativeFile = file.startsWith('server/scenarios/') ? file.slice('server/scenarios/'.length) : ''
    const target = resolve(scenariosDir, relativeFile)
    const fromDir = relative(scenariosDir, target)
    if (!relativeFile || fromDir.startsWith('..') || isAbsolute(fromDir) || basename(relativeFile) !== relativeFile || !relativeFile.endsWith('.json')) {
      problems.push(`${file}: unsupported file path`)
      continue
    }
    let original
    try {
      original = JSON.parse(await readFile(target, 'utf8'))
    } catch (error) {
      problems.push(`${file}: could not read scenario file (${error.message})`)
      continue
    }
    const result = applyCorrections(original, file, fileRows)
    problems.push(...result.conflicts)
    if (result.applied > 0) {
      const validationProblems = validateScenario(result.updated)
      problems.push(...validationProblems.map(problem => `${file}: ${problem}`))
      changedScenarios.push({ target, updated: result.updated })
      changedValues += result.applied
      changedPaths.push(...fileRows.filter(row => row.file === file && String(row.amharic_corrected ?? '').trim()).map(row => row.path))
    }
  }

  if (problems.length) {
    for (const problem of problems) process.stderr.write(`${problem}\n`)
    process.exitCode = 1
    return
  }

  const changedFiles = changedScenarios.length + (Object.keys(i18nCorrections).length ? 1 : 0)
  if (!apply) {
    process.stdout.write(`would change ${changedValues} values in ${changedFiles} files\n`)
    for (const path of changedPaths) process.stdout.write(`${path}\n`)
    return
  }

  for (const { target, updated } of changedScenarios) {
    await writeFile(target, `${JSON.stringify(updated, null, 2)}\n`, 'utf8')
  }
  if (Object.keys(i18nCorrections).length) {
    await mkdir(outDir, { recursive: true })
    await writeFile(join(outDir, 'i18n-corrections.json'), `${JSON.stringify(i18nCorrections, null, 2)}\n`, 'utf8')
    process.stdout.write(`Wrote ${Object.keys(i18nCorrections).length} i18n corrections.\n`)
  }
  process.stdout.write(`Applied ${changedValues} values in ${changedFiles} files.\n`)
}

await main().catch(error => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
