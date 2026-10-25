const TSV_HEADER = ['file', 'path', 'english', 'amharic_draft', 'amharic_corrected']
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasLanguages = value => isObject(value) && Object.hasOwn(value, 'en') && Object.hasOwn(value, 'am')
const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ')

export function collectRows(scenario, file) {
  const rows = []

  function align(english, amharic, path) {
    if (typeof amharic === 'string') {
      rows.push({ file, path, english: typeof english === 'string' ? english : '', amharic })
      return
    }
    if (Array.isArray(amharic)) {
      amharic.forEach((value, index) => align(Array.isArray(english) ? english[index] : '', value, `${path}[${index}]`))
      return
    }
    if (isObject(amharic)) {
      for (const key of Object.keys(amharic)) {
        align(isObject(english) ? english[key] : '', amharic[key], path ? `${path}.${key}` : key)
      }
    }
  }

  function walk(value, path = '') {
    if (Array.isArray(value)) {
      value.forEach((child, index) => walk(child, `${path}[${index}]`))
      return
    }
    if (!isObject(value)) return
    if (hasLanguages(value)) {
      align(value.en, value.am, path ? `${path}.am` : 'am')
      return
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === '_reviewNote') continue
      walk(child, path ? `${path}.${key}` : key)
    }
  }

  walk(scenario)
  return rows
}

export function collectI18nRows(strings) {
  const rows = []
  for (const [key, amharic] of Object.entries(strings?.am ?? {})) {
    rows.push({
      file: 'client/src/i18n.js',
      path: `am.${key}`,
      english: strings?.en?.[key] ?? '',
      amharic,
    })
  }
  return rows
}

function cleanCell(value) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ')
}

export function toTsv(rows) {
  return [TSV_HEADER.join('\t'), ...(Array.isArray(rows) ? rows : []).map(row => [
    row.file,
    row.path,
    row.english,
    row.amharic,
    '',
  ].map(cleanCell).join('\t'))].join('\n')
}

export function parseTsv(text) {
  const source = String(text ?? '')
  const records = []
  let record = []
  let cell = ''
  let inQuotes = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (char === '"') {
      if (inQuotes && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (inQuotes || cell.length === 0) {
        inQuotes = !inQuotes
      } else {
        cell += char
      }
    } else if (!inQuotes && char === '\t') {
      record.push(cell)
      cell = ''
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      record.push(cell)
      if (record.some(value => value.trim() !== '')) records.push(record)
      record = []
      cell = ''
    } else {
      cell += char
    }
  }
  record.push(cell)
  if (record.some(value => value.trim() !== '')) records.push(record)
  if (!records.length) return []
  const first = records[0]
  const hasHeader = TSV_HEADER.every((name, index) => first[index] === name)
  return records.slice(hasHeader ? 1 : 0).map(cells => {
    return Object.fromEntries(TSV_HEADER.map((name, index) => [name, cells[index] ?? '']))
  })
}

function tokensForPath(path) {
  const tokens = []
  const tokenPattern = /(?:^|\.)([^.[\]]+)|\[(\d+)\]/g
  let match
  while ((match = tokenPattern.exec(path)) !== null) tokens.push(match[1] ?? Number(match[2]))
  return tokens
}

function valueAt(root, tokens) {
  let value = root
  for (const token of tokens) {
    if (value === null || value === undefined) return undefined
    value = value[token]
  }
  return value
}

function setAt(root, tokens, value) {
  let parent = root
  for (const token of tokens.slice(0, -1)) parent = parent[token]
  parent[tokens.at(-1)] = value
}

export function applyCorrections(scenarioObject, file, rows) {
  const updated = structuredClone(scenarioObject)
  let applied = 0
  const conflicts = []

  for (const row of Array.isArray(rows) ? rows : []) {
    if (row.file !== file) continue
    const correction = String(row.amharic_corrected ?? '').trim()
    if (!correction) continue
    const tokens = tokensForPath(String(row.path ?? ''))
    const actualAmharic = valueAt(updated, tokens)
    const localeIndex = tokens.lastIndexOf('am')
    const englishTokens = tokens.slice()
    if (localeIndex !== -1) englishTokens[localeIndex] = 'en'
    const actualEnglish = localeIndex === -1 ? undefined : valueAt(updated, englishTokens)
    if (!tokens.length || normalize(actualAmharic) !== normalize(row.amharic_draft) || normalize(actualEnglish) !== normalize(row.english)) {
      conflicts.push(`${row.file}:${row.path}: draft or English source changed; correction skipped`)
      continue
    }
    setAt(updated, tokens, correction)
    applied += 1
  }
  return { updated, applied, conflicts }
}
