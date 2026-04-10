import {
  InferenceClient,
  type InferenceProviderOrPolicy,
} from '@huggingface/inference'
import {
  getHuggingFaceApiKey,
  getHuggingFaceImageModel,
  getHuggingFaceInferenceProvider,
} from './huggingface'

/**
 * Генерирует изображение по текстовому промпту через Hugging Face Inference Providers.
 * Используется официальный клиент: он сам запрашивает маршрут у Hub и не ходит на устаревший api-inference.huggingface.co (410 Gone).
 */
export async function textToImage(
  prompt: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const token = getHuggingFaceApiKey()
  const model = getHuggingFaceImageModel()
  const provider = getHuggingFaceInferenceProvider()
  const trimmedPrompt = prompt.trim().slice(0, 2000)

  if (!trimmedPrompt) {
    throw new Error('Пустой промпт для генерации изображения')
  }

  console.log('[huggingface-image] textToImage через InferenceClient', {
    model,
    provider: provider ?? 'auto',
    promptLength: trimmedPrompt.length,
  })

  const client = new InferenceClient(token)

  try {
    const blob = await client.textToImage(
      {
        model,
        inputs: trimmedPrompt,
        ...(provider
          ? { provider: provider as InferenceProviderOrPolicy }
          : {}),
      },
      { outputType: 'blob' },
    )

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 80) {
      console.error('[huggingface-image] Слишком короткий ответ', {
        length: buffer.length,
      })
      throw new Error('Сервис вернул некорректные данные изображения.')
    }

    const mime =
      blob.type && blob.type.startsWith('image/')
        ? blob.type.split(';')[0].trim()
        : 'image/png'

    console.log('[huggingface-image] Изображение получено', {
      bytes: buffer.length,
      mime,
    })

    return { buffer, contentType: mime }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[huggingface-image] Ошибка InferenceClient', {
      message,
      error,
    })
    throw new Error(
      message ||
        'Ошибка генерации изображения. Проверьте модель и токен Hugging Face.',
    )
  }
}
