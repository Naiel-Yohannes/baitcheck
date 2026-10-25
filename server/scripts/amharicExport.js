import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { collectI18nRows, collectRows, toTsv } from './amharicSheetLib.js'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const serverDir = resolve(scriptsDir, '..')
const scenariosDir = process.env.BAITCHECK_SCENARIOS_DIR
  ? resolve(process.env.BAITCHECK_SCENARIOS_DIR)
  : join(serverDir, 'scenarios')
const rows = []
const names = (await readdir(scenariosDir)).filter(name => name.endsWith('.json')).sort()

for (const name of names) {
  const scenario = JSON.parse(await readFile(join(scenariosDir, name), 'utf8'))
  rows.push(...collectRows(scenario, `server/scenarios/${name}`))
}

try {
  const { strings } = await import('../../client/src/i18n.js')
  rows.push(...collectI18nRows(strings))
} catch (error) {
  process.stderr.write(`Warning: could not load client i18n strings: ${error.message}\n`)
}

process.stdout.write(`${toTsv(rows)}\n`)
process.stderr.write(`Exported ${rows.length} Amharic rows from ${names.length} scenario files${rows.some(row => row.file === 'client/src/i18n.js') ? ' and client/src/i18n.js' : ''}.\n`)
