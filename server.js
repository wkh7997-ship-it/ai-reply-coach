import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// 현재 파일 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

// 정적 파일 제공 (index.html, confirm.html, result.html, chat.html 등)
app.use(express.static(__dirname));

// ------------------------------
//  1) /api/analyze : 피부 분석 (임시/가짜 데이터)
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
//  2) /api/chat : AI 피부 상담 챗봇 (지금은 가짜 응답)
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

    // context를 간단하게 텍스트로 정리
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

    // 🔹 지금은 OpenAI 안 쓰고, 임시로 “규칙형 답변”만 보냄
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

// ------------------------------
//  서버 실행
// ------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
