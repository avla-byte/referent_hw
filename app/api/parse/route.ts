import { NextResponse } from 'next/server'
import {
  parseArticleFromUrl,
  validateAndNormalizeUrl,
  type ParsedArticle,
} from '@/lib/article-parser'

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

    const normalizedUrl = validateAndNormalizeUrl(body.url)

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

    const message =
      error instanceof Error ? error.message : 'Внутренняя ошибка сервера'

    return NextResponse.json(
      {
        error: message,
      },
      { status: 400 },
    )
  }
}

