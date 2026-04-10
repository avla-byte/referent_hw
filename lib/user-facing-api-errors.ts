import type { ApiErrorCode } from './api-error-codes'
import { isApiErrorCode } from './api-error-codes'

/** Сообщения для пользователя по коду ошибки API (без «сырых» ответов бэкенда). */
export const USER_FACING_API_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_URL:
    'Проверьте адрес: нужна ссылка с протоколом http:// или https://.',
  VALIDATION_INPUT: 'Проверьте ссылку и выбранный режим обработки.',
  VALIDATION_BODY: 'Не хватает данных для запроса. Обновите страницу и попробуйте снова.',
  ARTICLE_LOAD_FAILED:
    'Не удалось загрузить статью по этой ссылке.',
  ARTICLE_CONTENT_SHORT:
    'На странице слишком мало текста — возможно, это не статья или контент недоступен.',
  ARTICLE_TEXT_MISSING:
    'Не удалось извлечь текст статьи для перевода.',
  AI_SERVICE_UNAVAILABLE:
    'Сервис обработки сейчас недоступен. Попробуйте через несколько минут.',
  AI_EMPTY_RESPONSE:
    'Сервис не вернул текст ответа. Попробуйте ещё раз.',
  IMAGE_GENERATION_FAILED:
    'Не удалось сгенерировать изображение. Попробуйте другую статью или повторите позже.',
  INTERNAL: 'Произошла внутренняя ошибка. Попробуйте позже.',
}

const STATUS_FALLBACK: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_INPUT',
  422: 'ARTICLE_LOAD_FAILED',
  502: 'AI_SERVICE_UNAVAILABLE',
  503: 'AI_SERVICE_UNAVAILABLE',
  504: 'ARTICLE_LOAD_FAILED',
  500: 'INTERNAL',
}

/**
 * Возвращает безопасное сообщение для UI по телу ответа и HTTP-статусу.
 */
export function messageForApiFailure(
  status: number,
  body: unknown,
): string {
  if (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    isApiErrorCode((body as { code: unknown }).code)
  ) {
    return USER_FACING_API_MESSAGES[(body as { code: ApiErrorCode }).code]
  }

  const fallbackCode = STATUS_FALLBACK[status] ?? 'INTERNAL'
  return USER_FACING_API_MESSAGES[fallbackCode]
}

/** Сообщение при сетевой ошибке fetch (нет ответа сервера). */
export const NETWORK_ERROR_MESSAGE =
  'Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.'
