import {
  getHuggingFaceApiKey,
  getHuggingFaceImageModel,
} from './huggingface'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Генерирует изображение по текстовому промпту через Hugging Face Inference API.
 */
export async function textToImage(
  prompt: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const token = getHuggingFaceApiKey()
  const model = getHuggingFaceImageModel()
  const url = `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`
  const trimmedPrompt = prompt.trim().slice(0, 2000)

  if (!trimmedPrompt) {
    throw new Error('Пустой промпт для генерации изображения')
  }

  const maxAttempts = 2

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log('[huggingface-image] Запрос text-to-image', {
      model,
      attempt,
      promptLength: trimmedPrompt.length,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: trimmedPrompt }),
    })

    const contentType = response.headers.get('content-type') || ''

    if (
      response.status === 503 &&
      contentType.includes('application/json') &&
      attempt < maxAttempts
    ) {
      let estimatedSeconds = 10
      try {
        const payload = (await response.json()) as {
          estimated_time?: number
        }
        if (typeof payload?.estimated_time === 'number') {
          estimatedSeconds = Math.min(
            Math.max(payload.estimated_time, 1),
            120,
          )
        }
      } catch {
        /* ignore */
      }
      const waitMs = estimatedSeconds * 1000
      console.log('[huggingface-image] Модель загружается, повтор', {
        waitMs,
      })
      await sleep(waitMs)
      continue
    }

    if (!response.ok) {
      let detail: string | undefined
      try {
        if (contentType.includes('application/json')) {
          const errJson = (await response.json()) as { error?: string }
          detail = errJson?.error
        } else {
          detail = (await response.text()).slice(0, 500)
        }
      } catch {
        detail = undefined
      }
      console.error('[huggingface-image] Ошибка ответа HF', {
        status: response.status,
        detail,
      })
      throw new Error(
        `Ошибка генерации изображения (${response.status}). Попробуйте позже.`,
      )
    }

    if (contentType.includes('application/json')) {
      let errMessage: string | undefined
      try {
        const errJson = (await response.json()) as { error?: string }
        errMessage = errJson?.error
      } catch {
        errMessage = undefined
      }
      console.error('[huggingface-image] Вместо изображения пришёл JSON', {
        errMessage,
      })
      throw new Error(
        errMessage ||
          'Сервис изображений вернул ошибку вместо файла картинки.',
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 80) {
      console.error('[huggingface-image] Слишком короткий бинарный ответ', {
        length: buffer.length,
      })
      throw new Error('Сервис вернул некорректные данные изображения.')
    }

    const mime =
      contentType.startsWith('image/') && !contentType.includes('json')
        ? contentType.split(';')[0].trim()
        : 'image/png'

    console.log('[huggingface-image] Изображение получено', {
      bytes: buffer.length,
      mime,
    })

    return { buffer, contentType: mime }
  }

  throw new Error('Не удалось получить изображение после повторной попытки.')
}
