// ===================================================
// Gemini에게 물어보는 Vercel 서버리스 함수
//
// 왜 서버가 필요한가요?
//   API 키를 브라우저 코드(app.js)에 적으면 누구나 볼 수 있습니다.
//   그래서 키는 서버에만 두고(process.env.GEMINI_API_KEY), 브라우저는 이 주소로 부탁만 합니다.
//
// 왜 Firebase Functions가 아니라 여기인가요?
//   Firebase Functions는 유료 요금제(Blaze)라야 씁니다.
//   이 프로젝트는 무료 요금제(Spark)로 진행하므로,
//   서버가 필요한 일은 Vercel의 무료 서버리스 함수로 처리합니다.
// ===================================================

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { text } = req.body || {};

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "메모 내용(text)이 필요합니다." });
  }

  // Vercel 환경변수에서 Gemini API 키를 가져옵니다
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Vercel 환경변수(GEMINI_API_KEY)가 설정되지 않았습니다. Vercel 대시보드의 Settings -> Environment Variables에서 GEMINI_API_KEY를 등록해 주세요."
    });
  }

  try {
    // 무료 티어로 제공되는 최신 Gemini 2.0 Flash 모델 사용
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const payload = {
      system_instruction: {
        parts: [
          {
            text: "당신은 초·중등학교 담벼락 게시판의 친절하고 따뜻한 AI 선생님입니다. 학생이 남긴 메모 내용을 읽고, 1~2문장의 따뜻한 공감과 칭찬, 격려의 피드백을 작성해 주세요. 다정하고 부드러운 말투(예: ~했구나! 응원할게✨)와 어울리는 이모지를 사용해 주세요."
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: `학생이 작성한 메모: "${text.trim()}"`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API 호출 오류:", errorData);
      return res.status(response.status).json({
        error: errorData.error?.message || "Gemini API 호출 중 오류가 발생했습니다."
      });
    }

    const data = await response.json();
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "좋은 생각이에요! 선생님도 항상 응원할게요. 😊✨";

    return res.status(200).json({ comment });
  } catch (err) {
    console.error("서버 내부 오류:", err);
    return res.status(500).json({ error: "AI 코멘트를 생성하는 중 서버 오류가 발생했습니다: " + err.message });
  }
}

