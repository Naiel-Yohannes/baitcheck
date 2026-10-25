import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { applyCorrections, collectI18nRows, collectRows, parseTsv, toTsv } from '../scripts/amharicSheetLib.js'

const realScenarioPath = fileURLToPath(new URL('../scenarios/mobile-money-call.json', import.meta.url))
const realScenario = JSON.parse(await readFile(realScenarioPath, 'utf8'))

function makeRow(scenario, path, corrected, file = 'sample.json') {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  const amKey = parts.lastIndexOf('am')
  const englishParts = parts.slice()
  englishParts[amKey] = 'en'
  const get = (object, keys) => keys.reduce((value, key) => value?.[key], object)
  return {
    file,
    path,
    english: get(scenario, englishParts),
    amharic_draft: get(scenario, parts),
    amharic_corrected: corrected,
  }
}

describe('Amharic spreadsheet helpers', () => {
  it('collects localized strings, aligns arrays and ignores review notes', () => {
    const fixture = {
      title: { en: 'Title', am: 'ርዕስ' },
      signals: { en: ['one'], am: ['አንድ', 'ሁለት'] },
      nested: { instruction: { en: 'English', am: 'አማርኛ' } },
      _reviewNote: 'Ignore this note',
    }
    expect(collectRows(fixture, 'fixture.json')).toEqual([
      { file: 'fixture.json', path: 'title.am', english: 'Title', amharic: 'ርዕስ' },
      { file: 'fixture.json', path: 'signals.am[0]', english: 'one', amharic: 'አንድ' },
      { file: 'fixture.json', path: 'signals.am[1]', english: '', amharic: 'ሁለት' },
      { file: 'fixture.json', path: 'nested.instruction.am', english: 'English', amharic: 'አማርኛ' },
    ])
  })

  it('collects more than thirty rows from the real scenario', () => {
    const rows = collectRows(realScenario, 'server/scenarios/mobile-money-call.json')
    expect(rows.length).toBeGreaterThan(25)
    expect(rows.every(row => row.path && row.amharic)).toBe(true)
  })

  it('round trips TSV-safe cells with tabs, newlines and quotes', () => {
    const source = [{
      file: 'file\tname.json', path: 'title.am', english: 'line\none',
      amharic: 'draft "quoted"\rvalue',
    }]
    const parsed = parseTsv(toTsv(source))
    expect(parsed).toEqual([{
      file: 'file name.json', path: 'title.am', english: 'line one',
      amharic_draft: 'draft "quoted" value', amharic_corrected: '',
    }])
    expect(parseTsv('file\tpath\tenglish\tamharic_draft\tamharic_corrected\r\n"a"\t"b"\t"c"\t"say ""hi"""\t"fixed"\r\n'))
      .toEqual([{ file: 'a', path: 'b', english: 'c', amharic_draft: 'say "hi"', amharic_corrected: 'fixed' }])
  })

  it('applies a correction on a deep copied object', () => {
    const scenario = structuredClone(realScenario)
    const row = makeRow(scenario, 'stages[0].instruction.am', 'አዲስ ጽሑፍ', 'server/scenarios/mobile-money-call.json')
    const result = applyCorrections(scenario, row.file, [row])
    expect(result.applied).toBe(1)
    expect(result.conflicts).toEqual([])
    expect(result.updated.stages[0].instruction.am).toBe('አዲስ ጽሑፍ')
    expect(scenario.stages[0].instruction.am).not.toBe('አዲስ ጽሑፍ')
  })

  it('reports changed draft and changed English as conflicts', () => {
    const scenario = { title: { en: 'Title', am: 'Draft' } }
    const draftConflict = { file: 'sample.json', path: 'title.am', english: 'Title', amharic_draft: 'Old draft', amharic_corrected: 'Correction' }
    const englishConflict = { ...draftConflict, amharic_draft: 'Draft', english: 'Old title' }
    expect(applyCorrections(scenario, 'sample.json', [draftConflict]).conflicts).toHaveLength(1)
    expect(applyCorrections(scenario, 'sample.json', [englishConflict]).conflicts).toHaveLength(1)
    expect(scenario.title).toEqual({ en: 'Title', am: 'Draft' })
  })

  it('ignores an empty correction', () => {
    const scenario = { title: { en: 'Title', am: 'Draft' } }
    const row = { file: 'sample.json', path: 'title.am', english: 'Title', amharic_draft: 'Draft', amharic_corrected: '   ' }
    expect(applyCorrections(scenario, 'sample.json', [row])).toMatchObject({ applied: 0, conflicts: [] })
  })

  it('collects i18n rows by Amharic keys', () => {
    expect(collectI18nRows({ en: { hello: 'Hello' }, am: { hello: 'ሰላም', onlyAm: 'አማርኛ' } })).toEqual([
      { file: 'client/src/i18n.js', path: 'am.hello', english: 'Hello', amharic: 'ሰላም' },
      { file: 'client/src/i18n.js', path: 'am.onlyAm', english: '', amharic: 'አማርኛ' },
    ])
  })
})
