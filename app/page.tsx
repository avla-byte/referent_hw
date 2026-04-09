'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  messageForApiFailure,
  NETWORK_ERROR_MESSAGE,
  USER_FACING_API_MESSAGES,
} from '@/lib/user-facing-api-errors'

interface ParsedArticle {
  date: string | null
  title: string | null
  content: string | null
}

type ActionType = 'summary' | 'thesis' | 'telegram' | 'translate'

interface ActionMeta {
  id: ActionType
  label: string
  description: string
}

const ACTIONS: ActionMeta[] = [
  {
    id: 'summary',
    label: 'О чем статья?',
    description: 'Краткий пересказ основного смысла статьи.',
  },
  {
    id: 'thesis',
    label: 'Тезисы',
    description: 'Список ключевых тезисов и идей.',
  },
  {
    id: 'telegram',
    label: 'Пост для Telegram',
    description: 'Готовый пост для канала или личного блога.',
  },
  {
    id: 'translate',
    label: 'Перевод',
    description: 'Полный перевод статьи на русский язык.',
  },
]

function validateUrl(value: string): string | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return 'Введите URL статьи.'
  }

  try {
    // Базовая проверка корректности URL
    const parsed = new URL(trimmed)

    if (!/^https?:$/.test(parsed.protocol)) {
      return 'URL должен начинаться с http:// или https://.'
    }

    if (!parsed.hostname) {
      return 'Некорректный адрес: отсутствует домен.'
    }
  } catch (error) {
    console.error('[validateUrl] Ошибка парсинга URL', error)
    return 'Некорректный URL. Проверьте адрес статьи.'
  }

  return null
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null)
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null)
  const [result, setResult] = useState<string>('')
  const [isCopied, setIsCopied] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)

  const resultSectionRef = useRef<HTMLElement>(null)
  const requestEpochRef = useRef(0)

  const selectedActionMeta = useMemo(
    () => ACTIONS.find((action) => action.id === selectedAction) ?? null,
    [selectedAction],
  )

  const handleUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value
      setUrl(nextValue)

      if (isCopied) {
        setIsCopied(false)
      }

      if (error) {
        // Перепроверяем валидацию по мере ввода
        const nextError = validateUrl(nextValue)
        setError(nextError)
      }

      if (operationError) {
        setOperationError(null)
      }
    },
    [error, isCopied, operationError],
  )

  const handleCopyClick = useCallback(async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setIsCopied(true)
      console.log('[UI] Результат скопирован в буфер обмена')
    } catch (copyError) {
      console.error('[UI] Не удалось скопировать текст', copyError)
      setIsCopied(false)
    }
  }, [result])

  const handleClear = useCallback(() => {
    requestEpochRef.current += 1
    setUrl('')
    setError(null)
    setIsLoading(false)
    setLoadingStatus(null)
    setSelectedAction(null)
    setResult('')
    setIsCopied(false)
    setOperationError(null)
    console.log('[UI] Сброс формы и состояния')
  }, [])

  const handleActionClick = useCallback(
    async (action: ActionType) => {
      console.log('[UI] Нажата кнопка действия', { action })

      const validationError = validateUrl(url)
      if (validationError) {
        console.warn('[UI] Ошибка валидации URL', { validationError })
        setError(validationError)
        setResult('')
        setOperationError(null)
        return
      }

      requestEpochRef.current += 1
      const epoch = requestEpochRef.current

      const isStale = () => requestEpochRef.current !== epoch

      setError(null)
      setOperationError(null)
      setSelectedAction(action)
      setIsLoading(true)
      setResult('')

      const loadingMessage =
        action === 'translate'
          ? 'Загружаю статью…'
          : 'Загружаю статью и формирую ответ…'
      setLoadingStatus(loadingMessage)

      try {
        // Для кнопок summary, thesis, telegram используем новый endpoint /api/generate
        if (action === 'summary' || action === 'thesis' || action === 'telegram') {
          console.log('[UI] Запускаем генерацию через API /generate', {
            url,
            action,
          })

          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, mode: action }),
          })

          if (!response.ok) {
            const errorPayload = await response.json().catch(() => null)

            console.error('[UI] API /generate вернул ошибку', {
              status: response.status,
              statusText: response.statusText,
              body: errorPayload,
            })

            if (!isStale()) {
              setOperationError(
                messageForApiFailure(response.status, errorPayload),
              )
            }
            return
          }

          const data = (await response.json()) as { result: string }

          console.log('[UI] Успешно получили результат генерации', {
            action,
            resultLength: data.result?.length ?? 0,
          })

          if (!isStale()) {
            setResult(data.result ?? '')
          }
          return
        }

        // Для translate используем старый путь через /api/parse и /api/translate
        if (action === 'translate') {
          console.log('[UI] Запускаем перевод через API /parse и /api/translate', {
            url,
          })

          const parseResponse = await fetch('/api/parse', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          })

          if (!parseResponse.ok) {
            const errorPayload = await parseResponse.json().catch(() => null)

            console.error('[UI] API /parse вернул ошибку', {
              status: parseResponse.status,
              body: errorPayload,
            })

            if (!isStale()) {
              setOperationError(
                messageForApiFailure(parseResponse.status, errorPayload),
              )
            }
            return
          }

          const parsedData = (await parseResponse.json()) as ParsedArticle

          const textToTranslate = [parsedData.title, parsedData.content]
            .filter(Boolean)
            .join('\n\n')
          if (!textToTranslate.trim()) {
            if (!isStale()) {
              setOperationError(USER_FACING_API_MESSAGES.ARTICLE_TEXT_MISSING)
            }
            return
          }

          if (isStale()) return

          setLoadingStatus('Перевожу статью…')

          const translateRes = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: textToTranslate }),
          })

          if (!translateRes.ok) {
            const errPayload = await translateRes.json().catch(() => null)
            if (!isStale()) {
              setOperationError(
                messageForApiFailure(translateRes.status, errPayload),
              )
            }
            return
          }

          const { translation } = (await translateRes.json()) as {
            translation: string
          }
          if (!isStale()) {
            setResult(translation ?? '')
          }
          return
        }

        // Фоллбек для неизвестных действий (не должно произойти)
        if (!isStale()) {
          setOperationError(USER_FACING_API_MESSAGES.INTERNAL)
        }
      } catch (caughtError) {
        console.error('[UI] Ошибка при обращении к API', caughtError)
        if (!isStale()) {
          setOperationError(NETWORK_ERROR_MESSAGE)
        }
      } finally {
        if (!isStale()) {
          setIsLoading(false)
          setLoadingStatus(null)
        }
      }
    },
    [url],
  )

  useEffect(() => {
    if (!result || operationError || isLoading) return
    resultSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [result, operationError, isLoading])

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-6 sm:px-5 sm:py-8 md:px-6">
      <div className="w-full max-w-3xl min-w-0 space-y-6 sm:space-y-8 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/60 backdrop-blur sm:rounded-2xl sm:p-5 md:p-6">
        <header className="space-y-2">
          <p className="inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-left text-xs font-medium leading-snug tracking-wide text-emerald-300">
            Референт AI · английские статьи → русский конспект
          </p>
          <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight text-slate-50 md:text-3xl">
            Суммаризация английских статей в один клик
          </h1>
          <p className="break-words text-sm leading-relaxed text-slate-400 md:text-base">
            Вставьте ссылку на англоязычную статью, выберите формат ответа и
            получите готовый русский текст: обзор, тезисы или пост для Telegram.
          </p>
        </header>

        <section className="space-y-4">
          <label className="block break-words text-sm font-medium text-slate-200">
            URL англоязычной статьи
            <span className="ml-1 text-xs font-normal text-emerald-300">
              (обязательно)
            </span>
          </label>
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start">
            <div className="relative min-w-0 flex-1">
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="Введите URL статьи, например: https://example.com/article"
                className="box-border block w-full max-w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/60 placeholder:text-slate-500"
              />
              {error && (
                <p className="mt-1 break-words text-xs text-rose-400">{error}</p>
              )}
              {!error && (
                <p className="mt-1 break-words text-xs text-slate-500">
                  Укажите ссылку на англоязычную статью
                </p>
              )}
            </div>
            <button
              type="button"
              title="Очистить поле URL, результат, ошибки и выбранный режим"
              onClick={handleClear}
              className="w-full shrink-0 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 md:w-auto md:self-start"
            >
              Очистить
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="break-words text-sm font-medium text-slate-200">
            Что нужно получить от статьи?
          </p>
          <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {ACTIONS.map((action) => {
              const isSelected = selectedAction === action.id

              return (
                <button
                  key={action.id}
                  type="button"
                  title={action.description}
                  onClick={() => handleActionClick(action.id)}
                  disabled={isLoading}
                  className={`group flex min-h-[4.5rem] w-full min-w-0 flex-col items-start rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]'
                      : 'border-slate-700 bg-slate-900/60 hover:border-emerald-400/70 hover:bg-slate-900'
                  } ${isLoading ? 'opacity-70' : ''}`}
                >
                  <span className="mb-1 break-words font-semibold text-slate-50">
                    {action.label}
                  </span>
                  <span className="break-words text-xs leading-snug text-slate-400">
                    {action.description}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="break-words text-xs leading-relaxed text-slate-500">
            Кнопка запускает обработку указанной статьи через AI. Для генерации
            используется модель deepseek/deepseek-chat через OpenRouter.
          </p>
        </section>

        <section
          ref={resultSectionRef}
          aria-label="Результат генерации"
          className="min-w-0 space-y-3 scroll-mt-20 rounded-xl border border-slate-800 bg-slate-950/60 p-3 sm:scroll-mt-24 sm:p-4"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-medium text-slate-200">
              Результат генерации
            </p>
            <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-500">
              Здесь появится текст на русском после обработки статьи.
            </p>
          </div>

          {operationError && (
            <Alert variant="destructive" className="mt-3 min-w-0">
              <AlertTitle>Не получилось выполнить действие</AlertTitle>
              <AlertDescription>
                <p className="break-words">{operationError}</p>
              </AlertDescription>
            </Alert>
          )}

          {loadingStatus && (
            <div
              role="status"
              aria-live="polite"
              className="mt-2 flex min-w-0 items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200/95"
            >
              <span
                className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-400"
                aria-hidden
              />
              <span className="min-w-0 flex-1 break-words">{loadingStatus}</span>
            </div>
          )}

          <div className="mt-2 min-h-[120px] min-w-0 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-sm leading-relaxed text-slate-200 sm:p-4">
            {result && !operationError ? (
              <>
                <div className="mb-3 flex min-w-0 flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  {selectedActionMeta ? (
                    <p className="min-w-0 break-words text-xs font-medium uppercase tracking-wide text-emerald-300">
                      {selectedActionMeta.label}
                    </p>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                  {!isLoading && (
                    <button
                      type="button"
                      title="Скопировать весь текст результата в буфер обмена"
                      onClick={handleCopyClick}
                      className="inline-flex w-full shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-900/90 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-sm transition hover:border-emerald-400 hover:text-emerald-300 sm:w-auto sm:justify-start sm:py-1"
                    >
                      {isCopied ? 'Скопировано' : 'Копировать'}
                    </button>
                  )}
                </div>
                {selectedAction === 'thesis' ? (
                  <div className="space-y-1.5 text-xs text-slate-100">
                    {result
                      .split('\n')
                      .filter((line) => line.trim())
                      .map((line, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="mt-1 text-emerald-400">•</span>
                          <span className="min-w-0 flex-1 break-words">
                            {line.trim()}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <pre className="max-w-full min-w-0 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-100">
                    {result}
                  </pre>
                )}
              </>
            ) : (
              <p className="break-words text-xs leading-relaxed text-slate-500">
                {operationError
                  ? 'Исправьте ссылку или выберите действие снова — текст появится здесь после успешной обработки.'
                  : 'Вставьте URL статьи и нажмите одну из кнопок сверху, чтобы сгенерировать ответ.'}
              </p>
            )}
          </div>
        </section>

        <footer className="flex min-w-0 flex-col items-stretch justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:items-start md:flex-row md:items-center">
          <span className="max-w-full break-words">
            Референт HW · учебное приложение на Next.js + Tailwind CSS
          </span>
          <span className="max-w-full break-words text-slate-600">
            Генерация через OpenRouter AI (deepseek/deepseek-chat)
          </span>
        </footer>
      </div>
    </main>
  )
}

