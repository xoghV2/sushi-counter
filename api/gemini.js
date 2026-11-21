// Vercel 무료 중계 서버 v2 (경로: api/gemini.js)
// 모델 자동 전환 + API 키 공백 제거 + 정확한 오류 메시지 전달

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 요청 방식입니다.' });
  }

  // Vercel 금고에 숨겨둔 API 키 꺼내기 (실수로 들어간 앞뒤 공백 자동 제거)
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({
      error: 'Vercel 설정(Environment Variables)에 GEMINI_API_KEY가 비어 있습니다.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!body || !Array.isArray(body.contents)) {
      return res.status(400).json({ error: '잘못된 요청 데이터입니다.' });
    }

    // 1순위 모델이 404면 다음 모델로 자동 시도
    const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash'];
    let lastError = 'AI 응답을 받지 못했습니다.';
    let lastStatus = 502;

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: body.contents,
          generationConfig: body.generationConfig || {
            responseMimeType: 'application/json',
          },
        }),
      });

      const data = await geminiRes.json();

      if (geminiRes.ok) {
        return res.status(200).json(data);
      }

      if (geminiRes.status === 429) {
        return res.status(429).json({
          error: '지금 이용자가 많아 AI가 잠시 쉬고 있어요. 1분 뒤에 다시 시도해 주세요! 🍣',
        });
      }

      lastError = `[${model}] ${data?.error?.message || '오류 발생'}`;
      // 구글에서 404가 와도 앱이 "중계 서버 없음"으로 오해하지 않도록 502로 변환
      lastStatus = geminiRes.status === 404 ? 502 : geminiRes.status;

      // 모델 없음(404)일 때만 다음 후보 모델 시도, 그 외(키 오류 등)는 즉시 중단
      if (geminiRes.status !== 404) {
        break;
      }
    }

    return res.status(lastStatus).json({ error: lastError });
  } catch (err) {
    return res.status(500).json({ error: '서버 처리 중 오류: ' + err.message });
  }
};
