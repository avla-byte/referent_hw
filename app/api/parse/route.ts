import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

interface ParseRequestBody {
  url?: string
}

interface ParsedArticle {
  date: string | null
  title: string | null
  content: string | null
}

function validateAndNormalizeUrl(rawUrl: string | undefined): string {
  if (!rawUrl || !rawUrl.trim()) {
    throw new Error('URL статьи обязателен')
  }

  const trimmed = rawUrl.trim()

  try {
    const parsed = new URL(trimmed)

    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error('URL должен начинаться с http:// или https://')
    }

    if (!parsed.hostname) {
      throw new Error('Некорректный URL: отсутствует домен')
    }

    return parsed.toString()
  } catch (error) {
    console.error('[API /parse] Ошибка валидации URL', {
      rawUrl,
      error,
    })
    throw new Error('Некорректный URL статьи')
  }
}

function extractDate($: cheerio.CheerioAPI): string | null {
  try {
    const candidates: string[] = []

    const metaSelectors = [
      'meta[property="article:published_time"]',
      'meta[property="og:published_time"]',
      'meta[name="article:published_time"]',
      'meta[name="pubdate"]',
      'meta[name="date"]',
      'meta[itemprop="datePublished"]',
    ]

    for (const selector of metaSelectors) {
      const value = $(selector).attr('content')
      if (value) candidates.push(value)
    }

    $('time').each((_, el) => {
      const datetime = $(el).attr('datetime')
      const text = $(el).text().trim()
      if (datetime) candidates.push(datetime)
      if (text) candidates.push(text)
    })

    const normalized = candidates
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value, index, self) => self.indexOf(value) === index)

    return normalized[0] ?? null
  } catch (error) {
    console.error('[API /parse] Ошибка извлечения даты', error)
    return null
  }
}

function extractTitle($: cheerio.CheerioAPI): string | null {
  try {
    const ogTitle = $('meta[property="og:title"]').attr('content')
    if (ogTitle && ogTitle.trim()) {
      return ogTitle.trim()
    }

    const h1 = $('h1').first().text()
    if (h1 && h1.trim()) {
      return h1.trim()
    }

    const titleTag = $('title').first().text()
    if (titleTag && titleTag.trim()) {
      return titleTag.trim()
    }

    return null
  } catch (error) {
    console.error('[API /parse] Ошибка извлечения заголовка', error)
    return null
  }
}

function extractMainContent($: cheerio.CheerioAPI): string | null {
  try {
    const containerSelectors = [
      'article',
      '[role="article"]',
      '.post',
      '.post-content',
      '.article',
      '.article-body',
      '.entry-content',
      '.content',
      '.main-content',
      '#content',
      '#main',
    ]

    const noisySelectors = [
      'script',
      'style',
      'noscript',
      'header',
      'footer',
      'nav',
      'aside',
      '.sidebar',
      '.comments',
      '#comments',
      '.share',
      '.social',
      '.breadcrumbs',
    ]

    // Убираем заведомо «шумные» элементы
    $(noisySelectors.join(',')).remove()

    let bestElement: cheerio.Cheerio<any> | null = null
    let bestLength = 0

    const seen = new Set<any>()

    for (const selector of containerSelectors) {
      $(selector).each((_, element) => {
        if (seen.has(element)) return
        seen.add(element)

        const $el = $(element)

        // Берём только текст абзацев и списков внутри контейнера,
        // игнорируя вложенные кнопки, формы и т.п.
        const textParts: string[] = []
        $el.find('p, li').each((__, node) => {
          const part = $(node).text().replace(/\s+/g, ' ').trim()
          if (part.length > 0) {
            textParts.push(part)
          }
        })

        const text = textParts.join('\n\n').trim()
        const length = text.length

        if (length > bestLength) {
          bestLength = length
          bestElement = $el
        }
      })
    }

    let finalText: string | null = null

    if (bestElement != null && bestLength > 0) {
      const parts: string[] = []
      const $best = bestElement as cheerio.Cheerio<any>
      $best.find('p, li').each((_, node: any) => {
        const part = $(node).text().replace(/\s+/g, ' ').trim()
        if (part.length > 0) {
          parts.push(part)
        }
      })
      finalText = parts.join('\n\n').trim() || null
    }

    // Фоллбек: если ничего не нашли в спец‑контейнерах, аккуратно
    // собираем текст из <body>, также только из p и li.
    if (!finalText || finalText.length < 200) {
      const bodyParts: string[] = []
      $('body')
        .find('p, li')
        .each((_, node) => {
          const part = $(node).text().replace(/\s+/g, ' ').trim()
          if (part.length > 0) {
            bodyParts.push(part)
          }
        })

      const bodyText = bodyParts.join('\n\n').trim()
      if (bodyText.length > (finalText?.length ?? 0)) {
        finalText = bodyText || finalText
      }
    }

    // Ограничим разумную длину, чтобы не тащить мегабайты текста
    if (finalText && finalText.length > 20000) {
      finalText = `${finalText.slice(0, 20000)}\n\n[контент обрезан]`
    }

    return finalText ?? null
  } catch (error) {
    console.error('[API /parse] Ошибка извлечения основного контента', error)
    return null
  }
}

async function parseArticleFromUrl(url: string): Promise<ParsedArticle> {
  console.log('[API /parse] Старт парсинга статьи', { url })

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'ReferentHW/1.0 (+https://localhost) Mozilla/5.0 (compatible; ReferentBot/1.0)',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      console.error('[API /parse] Неуспешный HTTP-ответ', {
        url,
        status: response.status,
        statusText: response.statusText,
      })
      throw new Error(
        `Не удалось загрузить статью (HTTP ${response.status} ${response.statusText})`,
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const date = extractDate($)
    const title = extractTitle($)
    const content = extractMainContent($)

    console.log('[API /parse] Успешно спарсили статью', {
      hasDate: Boolean(date),
      hasTitle: Boolean(title),
      contentLength: content?.length ?? 0,
    })

    return {
      date,
      title,
      content,
    }
  } catch (error) {
    console.error('[API /parse] Ошибка при парсинге статьи', {
      url,
      error,
    })
    throw error
  }
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

