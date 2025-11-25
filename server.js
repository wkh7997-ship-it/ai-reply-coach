import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";

const app = express();

// ──────────────────────────────
// 경로 설정
// ──────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ──────────────────────────────
// OpenAI 클라이언트
// ──────────────────────────────
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY가 설정되지 않음");
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ──────────────────────────────
// Middlewares
// ──────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// 정적 파일 제공
app.use(express.static(__dirname));

// ──────────────────────────────
// 1) 피부 분석 API
// ──────────────────────────────
app.post("/api/analyze", async (req, res) => {
  try {
    console.log("🟣 /api/analyze 호출됨");

    const { skin_type, problem_area, concerns, notes } = req.body || {};
    const concernsText = Array.isArray(concerns)
      ? concerns.join(", ")
      : "";

    const systemPrompt =
      "너는 한국어로 답하는 전문 'AI 피부 코치'야. " +
      "모든 리포트는 사람마다 다르게, 표현도 매번 다르게 작성해.\n" +
      "- 템플릿 반복 금지\n" +
      "- 자연스러운 존댓말\n" +
      "- 과학적 근거 기반의 관리 조언";

    const userPrompt =
      `사용자의 피부 정보:\n` +
      `- 피부 타입: ${skin_type || "정보 없음"}\n` +
      `- 고민 부위: ${problem_area || "정보 없음"}\n` +
      `- 주요 고민: ${concernsText || "정보 없음"}\n` +
      `- 이미지 일부 정보: ${(notes || "").slice(0, 400)}\n\n` +
      "아래 JSON 형식으로만 응답:\n" +
      "{\n" +
      '  "score": 숫자,\n' +
      '  "skinType": 문자열,\n' +
      '  "riskLevel": "low" | "mid" | "high",\n' +
      '  "issues": ["문제1", "문제2"],\n' +
      '  "summary": "두세 문장 요약",\n' +
      '  "detailAdvice": "루틴 및 상세관리 (5~8문장)"\n' +
      "}";

    const aiRes = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 1.1,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const rawText =
      aiRes.output?.[0]?.content?.[0]?.text?.trim() || "";

    console.log("🟢 OpenAI raw:", rawText);

    let parsed = JSON.parse(rawText);

    const scoreNum = Number(parsed.score);
    parsed.score = Number.isFinite(scoreNum)
      ? Math.min(Math.max(scoreNum, 0), 100)
      : 70;

    if (!["low", "mid", "high"].includes(parsed.riskLevel)) {
      parsed.riskLevel = "mid";
    }

    return res.json(parsed);
  } catch (err) {
    console.error("❌ /api/analyze 오류:", err);
    return res.status(500).json({
      error:
        "AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
});

// ──────────────────────────────
// 서버 실행
// ──────────────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server is running on port ${PORT}`);
});
