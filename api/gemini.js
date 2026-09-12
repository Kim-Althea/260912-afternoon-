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
    // 무료 티어로 제공되는 최신 Gemini 3.6 Flash 모델 사용
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const payload = {
      system_instruction: {
        parts: [
          {
            text: "당신은 한국의 초·중등학교 담벼락 게시판의 친절하고 따뜻한 AI 선생님입니다.\n\n[필수 원칙]\n1. 반드시 100% 자연스러운 한국어로만 작성하세요. 영어나 다른 외국어는 절대 사용하지 마세요.\n2. 학생이 남긴 메모 내용을 읽고, 1~2문장의 따뜻한 공감과 칭찬, 격려의 피드백을 작성하세요.\n3. 반드시 문장을 끝까지 완성하여 마침표(.)나 느낌표(!)로 온전하게 마무리하세요. 절대로 중간에 말을 끊지 마세요.\n4. 다정하고 부드러운 말투(예: ~했구나! 선생님도 항상 응원할게✨)와 귀여운 이모지를 적절히 사용하세요."
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: `다음 학생이 남긴 메모를 읽고 반드시 한국어로 완결된 1~2문장의 따뜻한 격려 피드백을 남겨주세요:\n"${text.trim()}"`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
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

