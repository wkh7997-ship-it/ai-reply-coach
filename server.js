// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ES 모듈에서 __dirname 구현
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 미들웨어
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // 이미지 base64 때문에 용량 늘림

// 정적 파일 서빙 (index.html, confirm.html, result.html 등)
app.use(express.static(__dirname));

// OpenAI 클라이언트 설정 (API 키는 코드에 직접 쓰지 말고 환경변수에서만!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 피부 분석 API
// 프론트에서: POST /api/skin-analyze  { imageData: "data:image/jpeg;base64,..." }
app.post("/api/skin-analyze", async (req, res) => {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ ok: false, error: "imageData가 필요합니다." });
    }

    // OpenAI Responses API 호출
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
너는 뷰티 카운셀러야. 아래 얼굴 사진을 보고 피부 상태의 "경향"만 설명해 줘.
의학적 진단이나 병명은 절대 말하지 마.
항상 JSON 하나로만 답하고, 한국어를 사용해.

반드시 이 구조를 지켜:
{
  "t_zone_oil": 0~5 정수,
  "u_zone_dry": 0~5 정수,
  "redness": 0~5 정수,
  "texture_bumps": 0~5 정수,
  "note": "한 줄~두 줄 정도의 요약 코멘트",
  "trend_text": "사람이 읽기 좋은 자연스러운 피부 경향 설명 4~7문장",
  "care_text": "관리 방향과 루틴을 설명하는 4~7문장",
  "warning_text": "피부과 상담이 필요할 수 있는 경우를 안내하는 안전 문장 2~4문장"
}

중요 규칙:
- 병명(예: 한관종, 지루성피부염, 두드러기, 암, 종양 등)을 절대 쓰지 마.
- "악성/양성" 같은 의학적 판정 단어를 쓰지 마.
- 대신 '오돌토돌한 돌기, 피지, 각질, 붉음기, 민감한 경향, 건조함' 같은 표현만 사용해.
- warning_text에는 항상 "정확한 진단은 피부과 전문의에게"라는 뉘앙스의 문장을 포함해.
              `,
            },
            {
              type: "input_image",
              // 프론트에서 보낸 data URL 그대로 사용
              image_url: imageData,
            },
          ],
        },
      ],
    });

    // Responses API에서 텍스트 꺼내기
    let jsonText;
    try {
      // 보통 이 구조로 내려옴 (안전하게 try/catch)
      jsonText = response.output[0].content[0].text;
    } catch (e) {
      console.error("응답 파싱 실패:", e);
      return res.status(500).json({
        ok: false,
        error: "AI 응답을 파싱하는 중 문제가 발생했습니다.",
      });
    }

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON 변환 실패. 원본 텍스트:", jsonText);
      return res.status(500).json({
        ok: false,
        error: "AI 응답이 JSON 형식이 아닙니다.",
        raw: jsonText,
      });
    }

    return res.json({ ok: true, data });
  } catch (err) {
    console.error("OpenAI 호출 중 오류:", err);
    return res.status(500).json({
      ok: false,
      error: "AI 분석 중 오류가 발생했습니다.",
    });
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
