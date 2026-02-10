import { NextResponse } from 'next/server'
import {
  parseArticleFromUrl,
  validateAndNormalizeUrl,
} from '@/lib/article-parser'
import { generateContent, type GenerateMode } from '@/lib/ai-client'

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

    // Валидация входных данных
    if (!body?.url || !body?.mode) {
      return NextResponse.json(
        { error: 'URL статьи и режим генерации обязательны' },
        { status: 400 },
      )
    }

    let normalizedUrl: string
    let mode: GenerateMode

    try {
      normalizedUrl = validateAndNormalizeUrl(body.url)
      mode = validateMode(body.mode)
    } catch (validationError) {
      const message =
        validationError instanceof Error
          ? validationError.message
          : 'Некорректные входные данные'
      console.error('[API /generate] Ошибка валидации', {
        requestId,
        error: message,
      })
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Парсинг статьи
    let parsedArticle
    try {
      parsedArticle = await parseArticleFromUrl(normalizedUrl)
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : 'Не удалось загрузить статью'
      console.error('[API /generate] Ошибка парсинга', {
        requestId,
        url: normalizedUrl,
        error: message,
      })
      return NextResponse.json(
        {
          error:
            message.includes('HTTP')
              ? message
              : 'Не удалось загрузить статью. Проверьте URL и попробуйте позже',
        },
        { status: 400 },
      )
    }

    // Проверка наличия контента
    if (!parsedArticle.content || parsedArticle.content.trim().length < 100) {
      console.error('[API /generate] Контент слишком короткий', {
        requestId,
        contentLength: parsedArticle.content?.length ?? 0,
      })
      return NextResponse.json(
        {
          error: 'Не удалось извлечь текст статьи. Возможно, страница не содержит статьи',
        },
        { status: 400 },
      )
    }

    // Генерация через AI
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
        aiError instanceof Error ? aiError.message : 'Ошибка сервиса генерации'

      console.error('[API /generate] Ошибка AI', {
        requestId,
        mode,
        error: message,
      })

      // Определяем код ответа по типу ошибки
      if (
        message.includes('API-ключ') ||
        message.includes('не настроен') ||
        message.includes('слишком короткая')
      ) {
        return NextResponse.json({ error: message }, { status: 500 })
      }

      return NextResponse.json(
        {
          error:
            message.includes('502') || message.includes('сервиса')
              ? message
              : 'Ошибка сервиса генерации. Попробуйте позже',
        },
        { status: 502 },
      )
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

    const message =
      error instanceof Error
        ? error.message
        : 'Внутренняя ошибка сервера'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
