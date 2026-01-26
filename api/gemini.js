export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not set.' });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "prompt" in request body.' });
  }

  const systemPrompt =
    'You are a specialized history tutor focused on the Chinese Civil War (1945-1949). Provide a concise, clear, and highly focused response to the user\'s query, ensuring your answer is directly relevant to the historical context of the conflict. The response must be a single, short paragraph.';

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
  };

  const apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=' +
    apiKey;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data && data.error && data.error.message ? data.error.message : 'Gemini API request failed.';
      return res.status(response.status).json({ error: message });
    }

    const candidate = data && data.candidates && data.candidates[0];
    let text = null;
    let sources = [];

    if (candidate && candidate.content && candidate.content.parts && candidate.content.parts[0]?.text) {
      text = candidate.content.parts[0].text;

      const groundingMetadata = candidate.groundingMetadata;
      if (groundingMetadata && Array.isArray(groundingMetadata.groundingAttributions)) {
        sources = groundingMetadata.groundingAttributions
          .map((attribution) => ({
            uri: attribution.web?.uri,
            title: attribution.web?.title,
          }))
          .filter((source) => source.uri && source.title);
      }
    }

    return res.status(200).json({ text, sources });
  } catch (err) {
    console.error('Gemini API proxy error:', err);
    return res.status(500).json({ error: 'Unexpected server error while contacting Gemini.' });
  }
}
