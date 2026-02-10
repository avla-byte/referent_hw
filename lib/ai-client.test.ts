import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateContent, type GenerateMode } from './ai-client'

declare const global: typeof globalThis & {
  fetch: typeof fetch
}

const mockFetch = vi.fn()

beforeEach(() => {
  global.fetch = mockFetch as any
  process.env.OPENROUTER_API_KEY = 'test-key'
})

afterEach(() => {
  vi.resetAllMocks()
})

function mockOkResponse(body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  } as any)
}

describe('generateContent', () => {
  it('выбрасывает ошибку, если контент слишком короткий', async () => {
    await expect(
      generateContent('Title', 'short', 'summary', null),
    ).rejects.toThrow('Статья слишком короткая для обработки')
  })

  it.each<GenerateMode>(['summary', 'thesis', 'telegram'])(
    'успешно обрабатывает ответ модели для режима %s',
    async (mode) => {
      const longContent = 'x'.repeat(200)

      mockOkResponse({
        choices: [{ message: { content: 'Результат генерации' } }],
      })

      const result = await generateContent('Заголовок', longContent, mode, null)

      expect(result).toBe('Результат генерации')
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, options] = mockFetch.mock.calls[0]
      expect(typeof url).toBe('string')
      expect((options as any).method).toBe('POST')
    },
  )

  it('выбрасывает ошибку, если сервис вернул пустой результат', async () => {
    const longContent = 'x'.repeat(200)

    mockOkResponse({
      choices: [{ message: { content: '' } }],
    })

    await expect(
      generateContent('Заголовок', longContent, 'summary', null),
    ).rejects.toThrow('Сервис вернул пустой результат')
  })
})

