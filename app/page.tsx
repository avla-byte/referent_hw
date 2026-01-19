'use client'

import { useCallback, useMemo, useState } from 'react'

type ActionType = 'summary' | 'thesis' | 'telegram'

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
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null)
  const [result, setResult] = useState<string>('')

  const selectedActionMeta = useMemo(
    () => ACTIONS.find((action) => action.id === selectedAction) ?? null,
    [selectedAction],
  )

  const handleUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value
      setUrl(nextValue)

      if (error) {
        // Перепроверяем валидацию по мере ввода
        const nextError = validateUrl(nextValue)
        setError(nextError)
      }
    },
    [error],
  )

  const handleActionClick = useCallback(
    async (action: ActionType) => {
      console.log('[UI] Нажата кнопка действия', { action })

      const validationError = validateUrl(url)
      if (validationError) {
        console.warn('[UI] Ошибка валидации URL', { validationError })
        setError(validationError)
        setResult('')
        return
      }

      setError(null)
      setSelectedAction(action)
      setIsLoading(true)

      try {
        console.log('[UI] Подготовка к запросу в AI', { url, action })

        // Здесь в будущем будет вызов вашего backend / AI-API.
        // Сейчас — заглушка, имитирующая ответ.
        await new Promise((resolve) => setTimeout(resolve, 800))

        let fakeResult: string

        switch (action) {
          case 'summary':
            fakeResult =
              'Здесь будет краткий пересказ статьи на русском языке на основе указанного URL.'
            break
          case 'thesis':
            fakeResult =
              'Здесь появится список ключевых тезисов статьи на русском языке.'
            break
          case 'telegram':
            fakeResult =
              'Здесь будет готовый пост для Telegram с основными идеями статьи.'
            break
          default:
            fakeResult = 'Неизвестный тип действия.'
        }

        console.log('[UI] Получен ответ (заглушка) от AI', {
          action,
          fakeResult,
        })

        setResult(fakeResult)
      } catch (caughtError) {
        console.error('[UI] Ошибка при обработке запроса к AI', caughtError)
        setResult(
          'Произошла ошибка при обращении к AI. Попробуйте ещё раз чуть позже.',
        )
      } finally {
        setIsLoading(false)
      }
    },
    [url],
  )

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-3xl space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/60 backdrop-blur">
        <header className="space-y-2">
          <p className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium tracking-wide text-emerald-300">
            Референт AI · английские статьи → русский конспект
          </p>
          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-slate-50 md:text-3xl">
            Суммаризация английских статей в один клик
          </h1>
          <p className="text-sm text-slate-400 md:text-base">
            Вставьте ссылку на англоязычную статью, выберите формат ответа и
            получите готовый русский текст: обзор, тезисы или пост для Telegram.
          </p>
        </header>

        <section className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            URL англоязычной статьи
            <span className="ml-1 text-xs font-normal text-emerald-300">
              (обязательно)
            </span>
          </label>
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <input
                type="url"
                value={url}
                onChange={handleUrlChange}
                placeholder="https://example.com/interesting-article-in-english"
                className="block w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-50 shadow-sm outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/60 placeholder:text-slate-500"
              />
              {error && (
                <p className="mt-1 text-xs text-rose-400">{error}</p>
              )}
              {!error && (
                <p className="mt-1 text-xs text-slate-500">
                  Пример: статья из блогов, медиа или документации на английском.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-medium text-slate-200">
            Что нужно получить от статьи?
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            {ACTIONS.map((action) => {
              const isSelected = selectedAction === action.id

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleActionClick(action.id)}
                  disabled={isLoading}
                  className={`group flex flex-col items-start rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]'
                      : 'border-slate-700 bg-slate-900/60 hover:border-emerald-400/70 hover:bg-slate-900'
                  } ${isLoading ? 'opacity-70' : ''}`}
                >
                  <span className="mb-1 font-semibold text-slate-50">
                    {action.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {action.description}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-500">
            Кнопка запускает обработку указанной статьи. В этой версии интерфейса
            показан только фронтенд; подключение реального AI будет добавлено
            отдельным шагом.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">
                Результат генерации
              </p>
              <p className="text-xs text-slate-500">
                Здесь появится текст на русском после обработки статьи.
              </p>
            </div>
            {isLoading && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Обработка...
              </span>
            )}
          </div>

          <div className="mt-2 min-h-[120px] rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-3 text-sm leading-relaxed text-slate-200">
            {result ? (
              <>
                {selectedActionMeta && (
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-emerald-300">
                    {selectedActionMeta.label}
                  </p>
                )}
                <p>{result}</p>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                Вставьте URL статьи и нажмите одну из кнопок сверху, чтобы
                сгенерировать ответ.
              </p>
            )}
          </div>
        </section>

        <footer className="flex flex-col items-start justify-between gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500 md:flex-row md:items-center">
          <span>Референт HW · учебное приложение на Next.js + Tailwind CSS</span>
          <span className="text-slate-600">
            Следующий шаг: подключить backend и реальный AI‑провайдер.
          </span>
        </footer>
      </div>
    </main>
  )
}

