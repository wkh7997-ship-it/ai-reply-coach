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
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ──────────────────────────────
// Middlewares
// ──────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// 정적 파일 제공 (index.html, confirm.html, result.html, chat.html 등)
app.use(express.static(__dirname));

// ──────────────────────────────
// 1) /api/analyze : 피부 분석 (이제 진짜 OpenAI 연동)
// ──────────────────────────────
app.post("/api/analyze", async (req, res) => {
  try {
    console.log("🟣 /api/analyze 호출됨");

    const { skin_type, problem_area, concerns, notes } = req.body || {};

    // 프롬프트용 텍스트 정리
    const concernsText = Array.isArray(concerns) ? concerns.join(", ") : "";
    const promptContext =
      `사용자의 피부 사진과 간단한 정보를 기반으로 한국어로 피부 상태를 분석해 주세요.\n\n` +
      `- 피부 타입(추정 또는 추정 불가도 명시)\n` +
      `- 주요 고민 포인트(모공, 피지, 여드름, 붉은기, 잔주름 등)\n` +
      `- 전반적인 점수(0~100)\n` +
      `- 위험도(낮음/보통/높음)\n` +
      `- 일상에서 바로 실천 가능한 관리 가이드\n\n` +
      `다음은 참고용 텍스트 정보입니다:\n` +
      `- 사용자가 기록한 피부 타입: ${skin_type || "정보 없음"}\n` +
      `- 고민 부위: ${problem_area || "정보 없음"}\n` +
      `- 주요 고민들: ${concernsText || "정보 없음"}\n` +
      `- 기타 메모/이미지 설명: ${(notes || "").slice(0, 400)}\n\n` +
      `반드시 아래 JSON 형식으로만 응답하세요. 설명 문장 없이 JSON만 반환해야 합니다.\n\n` +
      `{\n` +
      `  "score": 0에서 100 사이의 숫자,\n` +
      `  "skinType": "예: 건성/지성/복합성/중성/민감성" 중 하나 또는 조합,\n` +
      `  "riskLevel": "low" 또는 "mid" 또는 "high",\n` +
      `  "issues": ["주요 고민1", "주요 고민2" ...],\n` +
      `  "summary": "두세 문장으로 전체 한 줄 요약",\n` +
      `  "detailAdvice": "일상 관리 가이드, 루틴 및 주의사항 등을 5~8문장 정도로 자세히"\n` +
      `}`;

    // 🔥 OpenAI 호출 (가벼운 모델: gpt-4.1-mini)
    const aiRes = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: promptContext,
    });

    const rawText =
      aiRes.output?.[0]?.content?.[0]?.text?.trim() || "";

    console.log("🟢 OpenAI 원본 응답 텍스트:", rawText);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      console.warn("⚠ JSON 파싱 실패, fallback 사용:", e);

      // JSON으로 못 받은 경우: 기본값 + 원문 텍스트를 detailAdvice로 사용
      parsed = {
        score: 70,
        skinType: skin_type || "복합성",
        riskLevel: "mid",
        issues: Array.isArray(concerns) && concerns.length ? concerns : ["모공", "피지"],
        summary: "전반적으로 무난한 피부 상태지만 일부 부위의 균형 관리가 필요해 보여요.",
        detailAdvice:
          rawText ||
          "기본적인 세안, 보습, 자외선 차단제를 꾸준히 사용하는 것만으로도 피부 컨디션이 점점 더 안정될 수 있어요.",
      };
    }

    // 안전하게 타입/범위 보정
    const scoreNum = Number(parsed.score);
    const score =
      Number.isFinite(scoreNum) ? Math.min(Math.max(scoreNum, 0), 100) : 70;

    const risk =
      parsed.riskLevel === "low" || parsed.riskLevel === "high"
        ? parsed.riskLevel
        : "mid";

    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

    const result = {
      score,
      skinType: parsed.skinType || "복합성",
      riskLevel: risk,
      issues,
      summary:
        parsed.summary ||
        "전반적으로 무난한 피부 상태입니다. 특정 부위 관리에 조금 더 신경 써주면 좋아요.",
      detailAdvice:
        parsed.detailAdvice ||
        "세안 후 피부 타입에 맞는 보습제를 충분히 사용하고, 낮에는 자외선 차단제를 꼼꼼히 바르는 것만으로도 큰 도움이 됩니다.",
    };

    return res.json(result);
  } catch (err) {
    console.error("❌ /api/analyze OpenAI 분석 오류:", err);
    return res.status(500).json({
      error: "AI 분석 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }
});

// ──────────────────────────────
// 2) /api/chat : AI 피부 상담 챗봇 (아직은 가짜 응답 or 나중에 OpenAI 붙이기)
// ──────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    console.log("🟣 /api/chat 호출됨");
    const { message, context } = req.body || {};

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "message는 반드시 문자열로 보내야 합니다." });
    }

    // 지금은 아직 OpenAI 말고, 테스트용 고정 답변 유지
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
        infoLines.push(`- 요약: ${context.summary}`);
      }
    }

    const contextText = infoLines.length
      ? `지금 알려진 피부 정보는 아래와 같아요:\n${infoLines.join(
          "\n"
        )}\n\n`
      : "";

    const reply =
      contextText +
      `질문 주신 내용은 다음과 같아요:\n"${message}"\n\n` +
      "지금은 테스트 모드라 기본적인 안내만 드릴 수 있어요.\n" +
      "· 자극적인 클렌징/스크럽은 주 1~2회 이내로 줄이기\n" +
      "· 본인 피부 타입에 맞는 보습제(수분/유분 밸런스) 꾸준히 바르기\n" +
      "· 자외선 차단제는 오전에 충분히, 야외 활동 시 2~3시간마다 덧바르기\n\n" +
      "증상이 심해지거나 오래 지속된다면, 꼭 피부과 전문의와 상담해 보시는 걸 권장드릴게요 🙂";

    return res.json({ reply });
  } catch (err) {
    console.error("❌ /api/chat 오류:", err);
    return res
      .status(500)
      .json({ error: "AI 상담 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  }
});

// ──────────────────────────────
// 서버 실행
// ──────────────────────────────
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
