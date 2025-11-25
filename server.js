import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();

// 현재 파일 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// OpenAI 클라이언트 (챗봇용)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn("⚠ OPENAI_API_KEY가 설정되어 있지 않습니다. /api/chat에서 실제 AI 응답을 사용할 수 없습니다.");
}

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// 정적 파일 제공 (index.html, confirm.html, result.html, chat.html 등)
app.use(express.static(__dirname));

// ------------------------------
//  🔥 1) /api/analyze : 피부 분석 (현재는 임시/가짜 데이터)
// ------------------------------
app.post("/api/analyze", async (req, res) => {
  try {
    console.log("🟣 /api/analyze 호출됨");

    const { skin_type, problem_area, concerns, notes } = req.body;
    console.log("요청 바디:", { skin_type, problem_area, concerns, notes });

    // 👉 아직은 OpenAI 연동 대신, 임시 데이터(가짜 리포트) 반환
    const fakeResult = {
      score: 73,
      skinType: "복합성",
      riskLevel: "mid",
      issues: ["피지", "모공", "볼 건조"],
      summary: "전반적으로 무난한 피부지만 T존 피지 조절이 필요해요.",
      detailAdvice:
        "아침에는 가벼운 젤타입 세안제, 저녁에는 진한 세안 후 진정·보습 위주의 크림을 사용하는 것을 권장드려요.",
    };

    return res.json(fakeResult);
  } catch (err) {
    console.error("❌ /api/analyze 분석 오류:", err);
    return res.status(500).json({ error: "AI 분석 오류" });
  }
});

// ------------------------------
//  🔥 2) /api/chat : AI 피부 상담 챗봇
// ------------------------------
app.post("/api/chat", async (req, res) => {
  try {
    console.log("🟣 /api/chat 호출됨");
    const { message, context } = req.body || {};

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "message는 반드시 문자열로 보내야 합니다." });
    }

    // OpenAI API 키가 없으면 안내 메시지 반환
    if (!openai) {
      return res.json({
        reply:
          "현재 서버에 AI 키가 설정되어 있지 않아,\n실제 AI 상담은 불가능한 상태입니다.\n\n그래도 기본적인 피부 관리 원칙을 안내드리면:\n- 세안은 하루 2번, 자극적이지 않은 클렌저 사용\n- 본인 피부 타입에 맞는 보습제 꾸준히 사용\n- 자외선 차단제는 매일 충분히 바르는 것이 좋아요.",
      });
    }

    // 기본 컨텍스트 정리 (결과 페이지에서 보낸 진단 요약)
    const infoLines = [];
    if (context) {
      if (typeof context.score === "number") {
        infoLines.push(`- 피부 점수: ${context.score}/100`);
      }
      if (context.skinType) {
        infoLines.push(`- 피부 타입: ${context.skinType}`);
      }
      if (context.riskLevel) {
        infoLines.push(`- 위험도: ${context.riskLevel}`);
      }
      if (Array.isArray(context.issues) && context.issues.length) {
        infoLines.push(`- 고민 포인트: ${context.issues.join(", ")}`);
      }
      if (context.summary) {
        infoLines.push(`- AI 요약: ${context.summary}`);
      }
    }

    const userContextText =
      infoLines.length > 0
        ? "다음은 사용자의 기본 피부 정보입니다:\n" +
          infoLines.join("\n") +
          "\n\n"
        : "사용자의 상세 피부 정보는 제한적입니다.\n\n";

    const systemPrompt =
      "너는 한국어로 대답하는 'AI 피부 코치'야. " +
      "사용자의 피부 타입·고민·생활 습관을 고려해서, " +
      "일상에서 실천 가능한 스킨케어 루틴과 제품 선택 기준을 친절하게 설명해 줘.\n\n" +
      "- 단, 특정 질환에 대한 '진단'이나 '치료'를 단정적으로 말하지 말 것.\n" +
      "- '피부과 전문의 진료가 필요해 보입니다'처럼 병원 방문이 필요한 상황에서는 반드시 안내할 것.\n" +
      "- 답변은 너무 길게 말하지 말고, 3~6문장 정도로 핵심만 정리해서 말할 것.\n" +
      "- 말투는 '조언해주는 친구 + 전문가' 사이 느낌으로, 반말이 아닌 존댓말로 부드럽게.\n";

    const userPrompt =
      userContextText +
      "아래는 사용자의 질문입니다.\n" +
      "질문:\n" +
      message;

    const aiRes = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const reply =
      aiRes.output?.[0]?.content?.[0]?.text?.trim() ||
      "지금은 정확한 답변을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.";

    return res.json({ reply });
  } catch (err) {
    console.error("❌ /api/chat 오류:", err);
    return res
      .status(500)
      .json({ error: "AI 상담 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  }
});

// ------------------------------
//  서버 실행
// ------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
