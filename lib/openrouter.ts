/**
 * Получает API ключ OpenRouter из переменных окружения.
 * @throws {Error} Если ключ отсутствует или пустой
 */
export function getOpenRouterApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key || !key.trim()) {
    console.error('[openrouter] OPENROUTER_API_KEY не задан в .env.local')
    throw new Error('Сервис AI не настроен: отсутствует API-ключ')
  }
  return key.trim()
}

export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
export const OPENROUTER_MODEL = 'deepseek/deepseek-chat'
