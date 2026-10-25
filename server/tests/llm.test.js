import { afterEach, describe, expect, it, vi } from 'vitest'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLlm } from '../ai/llm.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const baseConfig = (overrides = {}) => ({
  GEMINI_API_KEY: 'secret-api-key', LLM_MODEL: 'configured-model', LLM_MAX_RPM: 20,
  LLM_TIMEOUT_MS: 1000, LLM_THINKING_LEVEL: null, ...overrides,
})
const response = (text, extra = {}) => ({ text, candidates: [{ finishReason: 'STOP' }], ...extra })

function fakeClient(implement) {
  const calls = []
  const client = { models: { generateContent: vi.fn(async params => {
    calls.push(params)
    return implement ? implement(params, calls.length) : response('ok')
  }) } }
  return { client, calls }
}

afterEach(() => vi.restoreAllMocks())

describe('createLlm request handling', () => {
  it('uses the configured model and passes generation settings', async () => {
    const { client, calls } = fakeClient()
    const llm = createLlm({ config: baseConfig(), client })
    await llm.generateText({ system: 'system instruction', prompt: 'hello', temperature: 0.4, maxOutputTokens: 77 })
    await llm.generateText({ prompt: 'override', model: 'per-call-model' })
    expect(calls[0]).toMatchObject({
      model: 'configured-model', contents: 'hello',
      config: { systemInstruction: 'system instruction', temperature: 0.4, maxOutputTokens: 77 },
    })
    expect(calls[1].model).toBe('per-call-model')
  })

  it('requests JSON output and parses plain or fenced JSON', async () => {
    const { client, calls } = fakeClient((_, count) => response(count === 1 ? '{"ok":true}' : '```json\n{"ok":true}\n```'))
    const llm = createLlm({ config: baseConfig(), client, sleep: async () => {} })
    await expect(llm.generateJSON({ prompt: 'json please' })).resolves.toEqual({ ok: true })
    await expect(llm.generateJSON({ prompt: 'json please' })).resolves.toEqual({ ok: true })
    expect(calls[0].config).toMatchObject({ responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 800 })
  })

  it('does not pass unsupported thinking-level fields to this SDK', async () => {
    const { client, calls } = fakeClient()
    const llm = createLlm({ config: baseConfig({ LLM_THINKING_LEVEL: 'low' }), client })
    await llm.generateText({ prompt: 'test' })
    expect(calls[0].config).not.toHaveProperty('thinkingConfig')
  })

  it('enforces the provider cap and recovers after the window expires', async () => {
    let clock = 1000
    const { client } = fakeClient()
    const llm = createLlm({ config: baseConfig({ LLM_MAX_RPM: 3 }), client, now: () => clock })
    for (let index = 0; index < 3; index += 1) await llm.generateText({ prompt: 'hello' })
    await expect(llm.generateText({ prompt: 'fourth' })).rejects.toMatchObject({ code: 'LLM_BUSY' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(3)
    expect(llm.getCallCountLastMinute()).toBe(3)
    clock += 60001
    await llm.generateText({ prompt: 'after window' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(4)
  })

  it('counts a retry toward the cap', async () => {
    let clock = 0
    const { client } = fakeClient((_, count) => {
      if (count === 1) { const error = new Error('unavailable'); error.statusCode = 503; throw error }
      return response('ok')
    })
    const llm = createLlm({ config: baseConfig({ LLM_MAX_RPM: 1 }), client, now: () => clock, sleep: async () => {} })
    await expect(llm.generateText({ prompt: 'request' })).rejects.toMatchObject({ code: 'LLM_BUSY' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(1)
    clock = 60001
    await llm.generateText({ prompt: 'next window' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(2)
  })

  it('does not retry quota errors', async () => {
    const { client } = fakeClient(() => { const error = new Error('quota'); error.statusCode = 429; throw error })
    const llm = createLlm({ config: baseConfig(), client, sleep: async () => {} })
    await expect(llm.generateText({ prompt: 'hello' })).rejects.toMatchObject({ code: 'LLM_BUSY' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(1)
  })

  it('retries a transient 503 once and succeeds', async () => {
    const { client } = fakeClient((_, count) => {
      if (count === 1) { const error = new Error('unavailable'); error.statusCode = 503; throw error }
      return response('ready')
    })
    const sleep = vi.fn(async () => {})
    const llm = createLlm({ config: baseConfig(), client, sleep })
    await expect(llm.generateText({ prompt: 'hello' })).resolves.toMatchObject({ text: 'ready' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(500)
  })

  it('maps repeated 503 and network failures to busy and failed respectively', async () => {
    const serverError = new Error('busy'); serverError.statusCode = 503
    const first = fakeClient(() => { throw serverError })
    await expect(createLlm({ config: baseConfig(), client: first.client, sleep: async () => {} })
      .generateText({ prompt: 'x' })).rejects.toMatchObject({ code: 'LLM_BUSY' })
    expect(first.client.models.generateContent).toHaveBeenCalledTimes(2)

    const network = fakeClient(() => { throw new TypeError('fetch failed') })
    await expect(createLlm({ config: baseConfig(), client: network.client, sleep: async () => {} })
      .generateText({ prompt: 'x' })).rejects.toMatchObject({ code: 'LLM_FAILED' })
    expect(network.client.models.generateContent).toHaveBeenCalledTimes(2)
  })

  it.each([400, 401, 403, 404])('does not retry configuration status %s', async status => {
    const error = new Error('private provider detail'); error.statusCode = status
    const { client } = fakeClient(() => { throw error })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(createLlm({ config: baseConfig(), client }).generateText({ prompt: 'secret prompt' }))
      .rejects.toMatchObject({ code: 'LLM_FAILED' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain(`status ${status}`)
    expect(log.mock.calls[0][0]).not.toContain('private provider detail')
  })

  it('retries a timed-out provider request once', async () => {
    const { client } = fakeClient((_, count) => count === 1 ? new Promise(() => {}) : response('ok'))
    const llm = createLlm({ config: baseConfig({ LLM_TIMEOUT_MS: 5 }), client, sleep: async () => {} })
    await expect(llm.generateText({ prompt: 'hello' })).resolves.toMatchObject({ text: 'ok' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(2)
  })

  it('returns blocked responses without retrying', async () => {
    const { client } = fakeClient(() => ({ text: '', promptFeedback: { blockReason: 'SAFETY' } }))
    const llm = createLlm({ config: baseConfig(), client })
    await expect(llm.generateText({ prompt: 'blocked prompt' })).resolves.toMatchObject({ text: '', blockReason: 'SAFETY' })
    expect(client.models.generateContent).toHaveBeenCalledTimes(1)
  })

  it('retries invalid JSON once, then fails after a second invalid response', async () => {
    const validThenInvalid = fakeClient((_, count) => response(count === 1 ? 'not json' : '{"ok":true}'))
    const llm = createLlm({ config: baseConfig(), client: validThenInvalid.client, sleep: async () => {} })
    await expect(llm.generateJSON({ prompt: 'json' })).resolves.toEqual({ ok: true })
    expect(validThenInvalid.client.models.generateContent).toHaveBeenCalledTimes(2)

    const invalidTwice = fakeClient(() => response('not json'))
    await expect(createLlm({ config: baseConfig(), client: invalidTwice.client, sleep: async () => {} })
      .generateJSON({ prompt: 'json' })).rejects.toMatchObject({ code: 'LLM_FAILED' })
    expect(invalidTwice.client.models.generateContent).toHaveBeenCalledTimes(2)
  })

  it('logs only the model, result, and duration', async () => {
    const { client } = fakeClient(() => response('secret response text'))
    const log = vi.spyOn(console, 'info').mockImplementation(() => {})
    await createLlm({ config: baseConfig(), client }).generateText({ prompt: 'private prompt text' })
    const line = log.mock.calls[0][0]
    expect(line).toContain('model=configured-model')
    expect(line).not.toContain('private prompt text')
    expect(line).not.toContain('secret response text')
    expect(line).not.toContain('secret-api-key')
  })

  it('fails clearly when the installed SDK has no model-list capability', async () => {
    const { client } = fakeClient()
    await expect(createLlm({ config: baseConfig(), client }).listModelIds())
      .rejects.toMatchObject({ code: 'MODEL_LIST_UNSUPPORTED' })
  })
})

describe('LLM import and model-name hygiene', () => {
  async function jsFiles(directory) {
    const found = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) found.push(...await jsFiles(path))
      else if (entry.name.endsWith('.js')) found.push(path)
    }
    return found
  }

  it('imports the SDK only from server/ai/llm.js', async () => {
    const files = await jsFiles(root)
    const matches = []
    for (const file of files) {
      const source = await readFile(file, 'utf8')
      if (source.includes(['@google', 'genai'].join('/'))) matches.push(relative(root, file))
    }
    expect(matches).toEqual(['ai/llm.js'])
  })

  it('contains no model-family literal outside the documented exclusions', async () => {
    const files = []
    async function scan(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        if (['node_modules', '.git', 'tests'].includes(entry.name)) continue
        const path = join(directory, entry.name)
        if (entry.isDirectory()) await scan(path)
        else if (!['README.md', '.env.example'].includes(entry.name)) files.push(path)
      }
    }
    await scan(root)
    const matches = []
    for (const file of files) {
      // Local .env is user-managed and may intentionally name the selected model; it is ignored by git.
      if (relative(root, file) === '.env') continue
      if ((await readFile(file, 'utf8')).includes('gemini-')) matches.push(relative(root, file))
    }
    expect(matches).toEqual([])
  })
})
