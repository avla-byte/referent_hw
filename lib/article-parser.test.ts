import { describe, it, expect } from 'vitest'
import { validateAndNormalizeUrl } from './article-parser'

describe('validateAndNormalizeUrl', () => {
  it('возвращает нормализованный URL для корректного http/https адреса', () => {
    const result = validateAndNormalizeUrl(' https://example.com/post ')
    expect(result).toBe('https://example.com/post')
  })

  it('выбрасывает ошибку, если URL пустой', () => {
    expect(() => validateAndNormalizeUrl('')).toThrow('URL статьи обязателен')
    expect(() => validateAndNormalizeUrl('   ')).toThrow('URL статьи обязателен')
  })

  it('выбрасывает ошибку для некорректного протокола', () => {
    expect(() =>
      validateAndNormalizeUrl('ftp://example.com/post'),
    ).toThrow('URL должен начинаться с http:// или https://')
  })

  it('выбрасывает общую ошибку для совсем некорректной строки', () => {
    expect(() => validateAndNormalizeUrl('not-a-url')).toThrow(
      'Некорректный URL статьи',
    )
  })
})

