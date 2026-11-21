// Vercel 무료 중계 서버 (경로: api/gemini.js)
// 사용자의 브라우저가 보낸 사진을 받아, 숨겨둔 API 키를 붙여 구글 Gemini로 대신 보내줍니다.

module.exports = async function handler(req, res) {
  // 1. POST 방식의 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '허용되지 않은 요청 방식입니다.' });
  }

  // 2. Vercel 환경변수(금고)에 숨겨둔 내 API 키 꺼내기
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '서버에 API 키가 설정되지 않았습니다.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (!body || !Array.isArray(body.contents)) {
      return res.status(400).json({ error: '잘못된 요청 데이터입니다.' });
    }

    // 3. 구글 Gemini API 호출 (무료 티어 지원 빠른 비전 모델)
    const model = 'gemini-2.5-flash';
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

    // 4. 팔로워가 몰려 무료 한도(429)에 걸렸을 때 친절한 안내 반환
    if (geminiRes.status === 429) {
      return res.status(429).json({
        error: '지금 이용자가 많아 AI가 잠시 쉬고 있어요. 1분 뒤에 다시 시도해 주세요! 🍣',
      });
    }

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({
        error: data?.error?.message || 'AI 분석 중 오류가 발생했습니다.',
      });
    }

    // 5. 성공 결과만 브라우저로 안전하게 전달
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: '서버 처리 중 문제가 발생했습니다: ' + err.message });
  }
};
