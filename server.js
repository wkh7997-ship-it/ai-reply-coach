// server.js
// Render용 Node + Express 서버 (OpenAI + 제품 JSON API)

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import "dotenv/config"; // .env에서 OPENAI_API_KEY 불러오기

const app = express();

// ─────────────────────────────────────
// 공통 설정
// ─────────────────────────────────────

// CORS 허용 (file://, 앱 WebView 등에서 호출 가능)
app.use(
  cors({
    origin: "*",
  })
);

// JSON 파서 (사진 base64 같은 것도 받으려면 여유있게)
app.use(express.json({ limit: "20mb" }));

// 정적 파일 서빙 (index.html, result.html, options.html 등)
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname)));

// ─────────────────────────────────────
// 1) AI 분석 API (OpenAI 호출)
//    POST /api/analyze
// ─────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  try {
    const { skin_type, problem_area, concerns, notes } = req.body;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res
        .status(500)
        .json({ error: "OPENAI_API_KEY 누락됨 (서버 환경 변수 확인 필요)" });
    }

    const concernsText = Array.isArray(concerns)
      ? concerns.join(", ")
      : concerns || "";

    const prompt = `
사용자 피부 분석:
- 피부 타입: ${skin_type || "미입력"}
- 고민 부위: ${problem_area || "미입력"}
- 선택한 고민: ${concernsText || "없음"}
- 추가 메모: ${notes || "없음"}

아래 JSON 형식으로만, 설명 없이 순수 JSON만 반환해줘:

{
 "score": 숫자(0~100),
 "skinType": "건성/지성/복합성/민감성 중 하나",
 "riskLevel": "low/mid/high 중 하나",
 "issues": ["문제1", "문제2"],
 "summary": "한 줄 요약",
 "detailAdvice": "상세 관리 팁"
}
    `.trim();

    // Node 18 이상: 글로벌 fetch 사용 가능
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 필요하면 gpt-4o 등으로 변경 가능
        messages: [
          {
            role: "system",
            content:
              "너는 피부과 전문의와 스킨케어 코치 역할을 하는 AI야. 사용자의 고민을 보고 피부 상태를 평가하고, JSON 형식으로만 답을 반환해.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("OpenAI API 오류:", response.status, errorText);
      return res.status(500).json({
        error: "OpenAI API 호출 실패",
        status: response.status,
        detail: errorText,
      });
    }

    const data = await response.json();

    let text;
    try {
      text = data.choices[0].message.content;
    } catch (e) {
      console.error("OpenAI 응답 구조 예기치 못함:", data);
      return res.status(500).json({
        error: "OpenAI 응답 파싱 실패",
        raw: data,
      });
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.error("JSON.parse 실패, 원문:", text);
      return res.status(500).json({
        error: "AI 응답 JSON 변환 실패",
        raw: text,
      });
    }

    // 최종 결과 반환 (result.html에서 그대로 사용)
    res.json(json);
  } catch (err) {
    console.error("AI 분석 서버 오류:", err);
    res.status(500).json({ error: "서버 분석 오류", detail: err.message });
  }
});

// ─────────────────────────────────────
// 2) 제품 JSON API
//    GET /api/products
//    ./data/coupang-links.json 읽어서 반환
// ─────────────────────────────────────
app.get("/api/products", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "coupang-links.json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "coupang-links.json 없음" });
    }

    const json = fs.readFileSync(filePath, "utf8");
    res.json(JSON.parse(json));
  } catch (err) {
    console.error("제품 JSON 로드 오류:", err);
    res
      .status(500)
      .json({ error: "제품 JSON 로드 오류", detail: err.message });
  }
});

// ─────────────────────────────────────
// 3) SPA용 라우팅 처리
//    /api/* 가 아닌 나머지는 index.html 반환
// ─────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─────────────────────────────────────
// 4) 서버 실행
// ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 서버 실행중: http://localhost:${PORT}`);
});
