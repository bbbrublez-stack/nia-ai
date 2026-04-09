// api/chat.js
// Надёжный бэкенд с несколькими бесплатными моделями и fallback-логикой.
// Работает из России без VPN. Карта не нужна.

export const config = { maxDuration: 30 };

// Список бесплатных моделей — пробуем по очереди если одна занята.
// ВСЕ модели ниже бесплатны и не требуют пополнения баланса.
const FREE_MODELS = [
  'deepseek/deepseek-chat-v3.1:free',         // DeepSeek V3 — мощный, надёжный
  'meta-llama/llama-4-maverick:free',          // Llama 4 Maverick — vision + text
  'qwen/qwen3-235b-a22b:free',                 // Qwen 3 235B — очень мощный
  'deepseek/deepseek-r1:free',                 // DeepSeek R1 — хорошее рассуждение
  'meta-llama/llama-3.3-70b-instruct:free',   // Llama 3.3 70B — стабильный
];

// Vision-модели (понимают изображения) — пробуем по очереди
const VISION_MODELS = [
  'meta-llama/llama-4-maverick:free',          // vision + text (primary)
  'qwen/qwen2.5-vl-72b-instruct:free',         // Qwen 72B VL — если maverick недоступен
  'moonshotai/kimi-vl-a3b-thinking:free',      // Kimi VL — запасной vision
];

export default async function handler(req, res) {
  // Только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Читаем тело запроса
  const { messages, system } = req.body || {};

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Неверный запрос: messages обязательны' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY не задан в переменных окружения Vercel!');
    return res.status(500).json({ error: 'API-ключ не настроен. Проверь Environment Variables в Vercel.' });
  }

  // Проверяем есть ли изображение в последнем сообщении
  const lastMsg = messages[messages.length - 1];
  const hasImage = Array.isArray(lastMsg?.content) &&
    lastMsg.content.some(p => p.type === 'image_url');

  // Выбираем список моделей
  const modelList = hasImage ? VISION_MODELS : FREE_MODELS;

  // Формируем массив messages для OpenRouter
  // OpenRouter использует формат OpenAI: role + content
  const apiMessages = [
    { role: 'system', content: system || `Ты Ниа — умный AI-ассистент. Отвечай на языке пользователя.` },
    ...messages
  ];

  // Пробуем модели по очереди
  let lastError = null;
  for (const model of modelList) {
    try {
      const result = await callOpenRouter(apiKey, model, apiMessages);
      if (result.ok) {
        return res.status(200).json({ text: result.text });
      }
      // Если модель вернула ошибку — логируем и пробуем следующую
      console.warn(`Модель ${model} вернула ошибку:`, result.error);
      lastError = result.error;

      // Если ошибка не связана с доступностью модели — не пробуем дальше
      if (result.status === 401) {
        return res.status(401).json({ error: 'Неверный API-ключ OpenRouter. Проверь OPENROUTER_API_KEY.' });
      }
    } catch (e) {
      console.warn(`Исключение при запросе к ${model}:`, e.message);
      lastError = e.message;
    }
  }

  // Все модели исчерпаны
  console.error('Все модели недоступны. Последняя ошибка:', lastError);
  return res.status(503).json({
    error: 'Все AI-модели временно перегружены. Подожди минуту и попробуй снова.'
  });
}

async function callOpenRouter(apiKey, model, messages) {
  const body = {
    model,
    messages,
    max_tokens: 1500,
    temperature: 0.8,
  };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nia-ai.vercel.app',
      'X-Title': 'Ниа AI',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error?.message || `HTTP ${response.status}`,
    };
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    return { ok: false, status: 200, error: 'Пустой ответ от модели' };
  }

  return { ok: true, text };
}
