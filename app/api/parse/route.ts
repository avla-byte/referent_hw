import { NextResponse } from 'next/server'
import {
  parseArticleFromUrl,
  validateAndNormalizeUrl,
  type ParsedArticle,
} from '@/lib/article-parser'
import { apiJsonError } from '@/lib/api-json-error'

interface ParseRequestBody {
  url?: string
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 10)

  console.log('[API /parse] Новый запрос', { requestId })

  try {
    const body = (await request.json()) as ParseRequestBody

    console.log('[API /parse] Тело запроса', {
      requestId,
      hasUrl: Boolean(body?.url),
    })

    let normalizedUrl: string
    try {
      normalizedUrl = validateAndNormalizeUrl(body.url)
    } catch (validationError) {
      console.warn('[API /parse] Ошибка валидации URL', {
        requestId,
        error: validationError,
      })
      return apiJsonError('VALIDATION_URL', 400)
    }
    const result = await parseArticleFromUrl(normalizedUrl)

    return NextResponse.json<ParsedArticle>(
      {
        date: result.date,
        title: result.title,
        content: result.content,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[API /parse] Ошибка обработки запроса', {
      requestId,
      error,
    })

    return apiJsonError('ARTICLE_LOAD_FAILED', 400)
  }
}
