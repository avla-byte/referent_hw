/**
 * Токен Hugging Face для Inference API (text-to-image и др.).
 * В .env.local можно задать HUGGINGFACE или HUGGINGFACE_API_KEY.
 */
export function getHuggingFaceApiKey(): string {
  const key =
    process.env.HUGGINGFACE?.trim() ||
    process.env.huggingface?.trim() ||
    process.env.HUGGINGFACE_API_KEY?.trim()

  if (!key) {
    console.error(
      '[huggingface] Не задан токен: укажите HUGGINGFACE в .env.local',
    )
    throw new Error('Сервис изображений не настроен: отсутствует API-ключ')
  }

  return key
}

/**
 * ID модели на Hub (формат org/name).
 * Переопределение: HUGGINGFACE_IMAGE_MODEL в .env / Vercel.
 */
export function getHuggingFaceImageModel(): string {
  const model = process.env.HUGGINGFACE_IMAGE_MODEL?.trim()
  return model || 'black-forest-labs/FLUX.1-schnell'
}

/**
 * Провайдер Inference (например hf-inference, replicate). Пусто = auto (как в настройках hf.co).
 * См. https://huggingface.co/docs/inference-providers/index
 */
export function getHuggingFaceInferenceProvider(): string | undefined {
  const p = process.env.HUGGINGFACE_INFERENCE_PROVIDER?.trim()
  return p || undefined
}
