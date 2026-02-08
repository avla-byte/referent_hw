import { NextResponse } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'deepseek/deepseek-chat'

interface TranslateRequestBody {
  content?: string
}

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key || !key.trim()) {
    console.error('[API /translate] OPENROUTER_API_KEY не задан в .env.local')
    throw new Error('Сервис перевода не настроен: отсутствует API-ключ')
  }
  return key.trim()
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 10)

  try {
    const body = (await request.json()) as TranslateRequestBody
    const content = typeof body?.content === 'string' ? body.content.trim() : ''

    if (!content) {
      return NextResponse.json(
        { error: 'Текст статьи для перевода обязателен' },
        { status: 400 },
      )
    }

    const apiKey = getApiKey()

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': request.headers.get('origin') || '',
      },
      body: JSON.stringify({
        model: MODEL,
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
      return NextResponse.json(
        {
          error: `Ошибка сервиса перевода (${response.status}). Попробуйте позже.`,
        },
        { status: 502 },
      )
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
      return NextResponse.json(
        { error: 'Сервис вернул пустой перевод' },
        { status: 502 },
      )
    }

    return NextResponse.json({ translation }, { status: 200 })
  } catch (error) {
    console.error('[API /translate] Исключение', { requestId, error })
    const message =
      error instanceof Error ? error.message : 'Внутренняя ошибка сервера'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
