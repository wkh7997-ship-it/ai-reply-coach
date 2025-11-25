// server.js
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" })); // 이미지 Base64 데이터 받을 수 있도록 용량 증가

// 정적 파일 경로 설정
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname)));

// ------------------------
// 1) AI 분석 API (Gemini 호출)
// ------------------------
app.post("/api/analyze", async (req, res) => {
  try {
    const { skin_type, problem_area, concerns, notes } = req.body;

    // Gemini API 키
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: "Gemini API KEY 누락됨" });
    }

    // Gemini 호출
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
사용자 피부 분석:
- 피부 타입: ${skin_type}
- 고민 부위: ${problem_area}
- 선택한 고민: ${concerns.join(", ")}
- 추가 메모: ${notes}

JSON 형식으로만 답변해줘:
{
 "score": 숫자(0~100),
 "skinType": "건성/지성/복합성/민감성",
 "riskLevel": "low/mid/high",
 "issues": ["문제1", "문제2"],
 "summary": "한 줄 요약",
 "detailAdvice": "상세 관리 팁"
}
`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    let text = "";
    try {
      text = data.candidates[0].content.parts[0].text;
    } catch {
      return res.status(500).json({ error: "Gemini 응답 파싱 실패", raw: data });
    }

    // 응답이 JSON 형태인지 체크
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({
        error: "AI 응답 JSON 변환 실패",
        raw: text
      });
    }

    res.json(json);
  } catch (err) {
    console.error("AI 분석 오류:", err);
    res.status(500).json({ error: "서버 분석 오류", detail: err.message });
  }
});

// ------------------------
// 2) coupang-links.json 읽기 API
// ------------------------
app.get("/api/products", (req, res) => {
  try {
    const filePath = path.join(__dirname, "data", "coupang-links.json");

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "coupang-links.json 없음" });
    }

    const json = fs.readFileSync(filePath, "utf8");
    res.json(JSON.parse(json));
  } catch (err) {
    res.status(500).json({ error: "제품 JSON 로드 오류", detail: err.message });
  }
});

// ------------------------
// 3) SPA / 정적 HTML 서빙
// ------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ------------------------
// 4) 서버 실행
// ------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔥 서버 실행중: http://localhost:${PORT}`);
});
