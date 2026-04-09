import { NextResponse } from 'next/server'
import {
  parseArticleFromUrl,
  validateAndNormalizeUrl,
} from '@/lib/article-parser'
import { generateContent, type GenerateMode } from '@/lib/ai-client'
import { apiJsonError } from '@/lib/api-json-error'

interface GenerateRequestBody {
  url?: string
  mode?: string
}

/**
 * Валидирует режим генерации.
 * @throws {Error} Если режим некорректен
 */
function validateMode(rawMode: string | undefined): GenerateMode {
  if (!rawMode || !rawMode.trim()) {
    throw new Error('Режим генерации обязателен')
  }

  const trimmed = rawMode.trim().toLowerCase()

  if (trimmed !== 'summary' && trimmed !== 'thesis' && trimmed !== 'telegram') {
    throw new Error(
      'Недопустимый режим генерации. Используйте: summary, thesis, telegram',
    )
  }

  return trimmed as GenerateMode
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 10)

  console.log('[API /generate] Новый запрос', { requestId })

  try {
    const body = (await request.json()) as GenerateRequestBody

    console.log('[API /generate] Тело запроса', {
      requestId,
      hasUrl: Boolean(body?.url),
      mode: body?.mode,
    })

    if (!body?.url || !body?.mode) {
      return apiJsonError('VALIDATION_BODY', 400)
    }

    let normalizedUrl: string
    let mode: GenerateMode

    try {
      normalizedUrl = validateAndNormalizeUrl(body.url)
      mode = validateMode(body.mode)
    } catch (validationError) {
      console.error('[API /generate] Ошибка валидации', {
        requestId,
        error: validationError,
      })
      return apiJsonError('VALIDATION_INPUT', 400)
    }

    let parsedArticle
    try {
      parsedArticle = await parseArticleFromUrl(normalizedUrl)
    } catch (parseError) {
      console.error('[API /generate] Ошибка загрузки или парсинга статьи', {
        requestId,
        url: normalizedUrl,
        error: parseError,
      })
      return apiJsonError('ARTICLE_LOAD_FAILED', 422)
    }

    if (!parsedArticle.content || parsedArticle.content.trim().length < 100) {
      console.error('[API /generate] Контент слишком короткий', {
        requestId,
        contentLength: parsedArticle.content?.length ?? 0,
      })
      return apiJsonError('ARTICLE_CONTENT_SHORT', 422)
    }

    const origin = request.headers.get('origin')

    let result: string
    try {
      result = await generateContent(
        parsedArticle.title,
        parsedArticle.content,
        mode,
        origin,
      )
    } catch (aiError) {
      const message =
        aiError instanceof Error ? aiError.message : 'unknown'
      console.error('[API /generate] Ошибка AI', {
        requestId,
        mode,
        error: message,
      })

      if (
        message.includes('API-ключ') ||
        message.includes('не настроен') ||
        message.includes('OPENROUTER')
      ) {
        return apiJsonError('AI_SERVICE_UNAVAILABLE', 503)
      }

      if (
        message.includes('пустой') ||
        message.includes('Пустой')
      ) {
        return apiJsonError('AI_EMPTY_RESPONSE', 502)
      }

      return apiJsonError('AI_SERVICE_UNAVAILABLE', 502)
    }

    console.log('[API /generate] Успешно сгенерирован контент', {
      requestId,
      mode,
      resultLength: result.length,
    })

    return NextResponse.json({ result }, { status: 200 })
  } catch (error: unknown) {
    console.error('[API /generate] Внутренняя ошибка', {
      requestId,
      error,
    })

    return apiJsonError('INTERNAL', 500)
  }
}
