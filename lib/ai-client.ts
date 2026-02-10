import { getOpenRouterApiKey, OPENROUTER_URL, OPENROUTER_MODEL } from './openrouter'

export type GenerateMode = 'summary' | 'thesis' | 'telegram'

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>
}

/**
 * Генерирует контент через OpenRouter AI на основе статьи.
 * @param title - Заголовок статьи
 * @param content - Текст статьи
 * @param mode - Режим генерации: summary, thesis, telegram
 * @param origin - Origin запроса для HTTP-Referer заголовка
 * @returns Сгенерированный текст на русском языке
 * @throws {Error} При ошибке обращения к AI-сервису
 */
export async function generateContent(
  title: string | null,
  content: string | null,
  mode: GenerateMode,
  origin: string | null = null,
): Promise<string> {
  if (!content || content.trim().length < 100) {
    throw new Error('Статья слишком короткая для обработки')
  }

  const apiKey = getOpenRouterApiKey()
  const prompt = buildPrompt(title, content, mode)

  console.log('[ai-client] Запрос к OpenRouter', {
    mode,
    contentLength: content.length,
    titleLength: title?.length ?? 0,
  })

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
          content: prompt,
        },
      ],
      max_tokens: 2048,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[ai-client] Ошибка OpenRouter', {
      status: response.status,
      body: errText,
    })
    throw new Error(
      `Ошибка сервиса генерации (${response.status}). Попробуйте позже.`,
    )
  }

  const data = (await response.json()) as OpenRouterResponse

  const result = data?.choices?.[0]?.message?.content?.trim() ?? ''

  if (!result) {
    console.error('[ai-client] Пустой ответ от модели')
    throw new Error('Сервис вернул пустой результат')
  }

  console.log('[ai-client] Успешно сгенерирован контент', {
    mode,
    resultLength: result.length,
  })

  return result
}

function buildPrompt(
  title: string | null,
  content: string,
  mode: GenerateMode,
): string {
  const titlePart = title ? `Заголовок статьи: ${title}\n\n` : ''

  switch (mode) {
    case 'summary':
      return `Ты — эксперт по анализу статей. Прочитай следующую статью на английском языке и напиши краткое описание на русском языке (2-4 абзаца).

Опиши:
- Основную тему и цель статьи
- Ключевые идеи и выводы автора
- Для кого статья может быть полезна

Сохрани нейтральный тон, не добавляй свои комментарии или оценки.

${titlePart}Текст статьи:
${content}`

    case 'thesis':
      return `Ты — эксперт по анализу статей. Прочитай следующую статью на английском языке и выдели ключевые тезисы на русском языке.

Формат ответа:
- Каждый тезис на отдельной строке
- Начинай каждый тезис с маркера "•" или "-"
- Тезисы должны быть краткими (1-2 предложения каждый)
- Выдели 5-10 самых важных тезисов
- Сохрани логическую структуру (если есть порядок изложения в статье)

${titlePart}Текст статьи:
${content}`

    case 'telegram':
      return `Ты — копирайтер, который пишет посты для Telegram-каналов. Прочитай следующую статью на английском языке и создай готовый пост для Telegram на русском языке.

Требования к посту:
- Заголовок (первая строка, можно использовать эмодзи для привлечения внимания)
- 2-4 абзаца основного текста
- Используй короткие предложения и абзацы (Telegram лучше читается с переносами строк)
- Добавь хештеги в конце (3-5 релевантных хештегов)
- Тон: информативный, но живой и понятный
- Длина: примерно 500-800 символов (оптимально для Telegram)

Не добавляй ссылки на оригинал, не упоминай источник — только содержание статьи.

${titlePart}Текст статьи:
${content}`

    default:
      throw new Error(`Недопустимый режим генерации: ${mode}`)
  }
}
