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

// 정적 파일 제공 (index.html, confirm.html, result.html)
app.use(express.static(__dirname));

// ------------------------------
//  🔥 핵심! /api/analyze 라우트 추가
// ------------------------------
app.post("/api/analyze", async (req, res) => {
  try {
    console.log("🟣 /api/analyze 호출됨");

    const { skin_type, problem_area, concerns, notes } = req.body;

    // 실제 AI 분석 대신 임시 데이터 생성
    const fakeResult = {
      score: 73,
      skinType: "복합성",
      riskLevel: "mid",
      issues: ["피지", "모공", "볼 건조"],
      summary: "전반적으로 무난한 피부지만 T존 피지 조절이 필요해요.",
      detailAdvice:
        "아침에는 가벼운 젤타입 세안제, 저녁에는 진한 세안 후 보습을 권장합니다."
    };

    return res.json(fakeResult);
  } catch (err) {
    console.error("❌ 분석 오류:", err);
    return res.status(500).json({ error: "AI 분석 오류" });
  }
});

// 서버 실행
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
