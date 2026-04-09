/**
 * Коды ошибок API для клиента. Тексты для пользователя задаются на фронте (lib/user-facing-api-errors.ts).
 */
export const API_ERROR_CODES = [
  'VALIDATION_URL',
  'VALIDATION_INPUT',
  'VALIDATION_BODY',
  'ARTICLE_LOAD_FAILED',
  'ARTICLE_CONTENT_SHORT',
  'ARTICLE_TEXT_MISSING',
  'AI_SERVICE_UNAVAILABLE',
  'AI_EMPTY_RESPONSE',
  'INTERNAL',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return (
    typeof value === 'string' &&
    (API_ERROR_CODES as readonly string[]).includes(value)
  )
}
