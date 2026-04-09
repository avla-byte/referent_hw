import { NextResponse } from 'next/server'
import {
  getOpenRouterApiKey,
  OPENROUTER_URL,
  OPENROUTER_MODEL,
} from '@/lib/openrouter'
import { apiJsonError } from '@/lib/api-json-error'

interface TranslateRequestBody {
  content?: string
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 10)

  try {
    const body = (await request.json()) as TranslateRequestBody
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return apiJsonError('VALIDATION_BODY', 400)
    }

    let apiKey: string
    try {
      apiKey = getOpenRouterApiKey()
    } catch (keyError) {
      console.error('[API /translate] Нет API-ключа', {
        requestId,
        error: keyError,
      })
      return apiJsonError('AI_SERVICE_UNAVAILABLE', 503)
    }

    const origin = request.headers.get('origin')

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': origin || '',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: 'user',
            content: `Переведи следующий текст статьи на русский язык. Сохрани структуру и абзацы. Не добавляй комментарии — только перевод.\n\n${content}`,
          },
        ],
        max_tokens: 8192,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[API /translate] Ошибка OpenRouter', {
        requestId,
        status: response.status,
        body: errText,
      })
      return apiJsonError('AI_SERVICE_UNAVAILABLE', 502)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }

    const translation =
      data?.choices?.[0]?.message?.content?.trim() ?? ''

    if (!translation) {
      console.error('[API /translate] Пустой ответ от модели', {
        requestId,
      })
      return apiJsonError('AI_EMPTY_RESPONSE', 502)
    }

    return NextResponse.json({ translation }, { status: 200 })
  } catch (error) {
    console.error('[API /translate] Исключение', { requestId, error })
    return apiJsonError('INTERNAL', 500)
  }
}
