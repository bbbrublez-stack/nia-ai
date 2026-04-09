// api/generate-image.js
// Pollinations.ai — бесплатная генерация изображений.
// Без API-ключа, без регистрации, работает из России.

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'Нет prompt' });
  }

  try {
    const seed = Math.floor(Math.random() * 2147483647);
    // Добавляем улучшающий суффикс для лучшего качества
    const enhanced = prompt + ', high quality, detailed, beautiful, 8k';
    const encoded  = encodeURIComponent(enhanced);

    // Pollinations.ai: генерация по URL, Flux модель
    const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

    return res.status(200).json({ url });
  } catch (err) {
    console.error('Image gen error:', err);
    return res.status(500).json({ error: 'Ошибка генерации изображения' });
  }
}
