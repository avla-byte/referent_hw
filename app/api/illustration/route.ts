import { NextResponse } from 'next/server'
import {
  parseArticleFromUrl,
  validateAndNormalizeUrl,
} from '@/lib/article-parser'
import { generateImagePromptFromArticle } from '@/lib/ai-client'
import { textToImage } from '@/lib/huggingface-image'
import { getHuggingFaceApiKey } from '@/lib/huggingface'
import { apiJsonError } from '@/lib/api-json-error'

interface IllustrationRequestBody {
  url?: string
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).slice(2, 10)

  console.log('[API /illustration] Новый запрос', { requestId })

  try {
    const body = (await request.json()) as IllustrationRequestBody

    if (!body?.url || typeof body.url !== 'string') {
      return apiJsonError('VALIDATION_BODY', 400)
    }

    let normalizedUrl: string

    try {
      normalizedUrl = validateAndNormalizeUrl(body.url)
    } catch (validationError) {
      console.error('[API /illustration] Ошибка валидации URL', {
        requestId,
        error: validationError,
      })
      return apiJsonError('VALIDATION_INPUT', 400)
    }

    let parsedArticle
    try {
      parsedArticle = await parseArticleFromUrl(normalizedUrl)
    } catch (parseError) {
      console.error('[API /illustration] Ошибка загрузки или парсинга', {
        requestId,
        url: normalizedUrl,
        error: parseError,
      })
      return apiJsonError('ARTICLE_LOAD_FAILED', 422)
    }

    if (!parsedArticle.content || parsedArticle.content.trim().length < 100) {
      console.error('[API /illustration] Контент слишком короткий', {
        requestId,
        contentLength: parsedArticle.content?.length ?? 0,
      })
      return apiJsonError('ARTICLE_CONTENT_SHORT', 422)
    }

    try {
      getHuggingFaceApiKey()
    } catch (keyError) {
      console.error('[API /illustration] Нет ключа Hugging Face', {
        requestId,
        error: keyError,
      })
      return apiJsonError('AI_SERVICE_UNAVAILABLE', 503)
    }

    const origin = request.headers.get('origin')

    let imagePrompt: string
    try {
      imagePrompt = await generateImagePromptFromArticle(
        parsedArticle.title,
        parsedArticle.content,
        origin,
      )
    } catch (aiError) {
      const message =
        aiError instanceof Error ? aiError.message : 'unknown'
      console.error('[API /illustration] Ошибка OpenRouter (промпт)', {
        requestId,
        error: message,
      })

      if (
        message.includes('API-ключ') ||
        message.includes('не настроен') ||
        message.includes('OPENROUTER')
      ) {
        return apiJsonError('AI_SERVICE_UNAVAILABLE', 503)
      }

      if (message.includes('пустой')) {
        return apiJsonError('AI_EMPTY_RESPONSE', 502)
      }

      return apiJsonError('AI_SERVICE_UNAVAILABLE', 502)
    }

    let imageBuffer: Buffer
    let mimeType: string

    try {
      const out = await textToImage(imagePrompt)
      imageBuffer = out.buffer
      mimeType = out.contentType
    } catch (hfError) {
      const message =
        hfError instanceof Error ? hfError.message : 'unknown'
      console.error('[API /illustration] Ошибка Hugging Face', {
        requestId,
        error: message,
      })
      return apiJsonError('IMAGE_GENERATION_FAILED', 502)
    }

    const imageBase64 = imageBuffer.toString('base64')

    console.log('[API /illustration] Успех', {
      requestId,
      promptLength: imagePrompt.length,
      imageBytes: imageBuffer.length,
      mimeType,
    })

    return NextResponse.json(
      {
        prompt: imagePrompt,
        imageBase64,
        mimeType,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    console.error('[API /illustration] Внутренняя ошибка', {
      requestId,
      error,
    })
    return apiJsonError('INTERNAL', 500)
  }
}
