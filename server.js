// server.js
// 메인 서버 파일: Render에서 실행되는 실제 서버

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

// .env 로드 (OPENAI_API_KEY 포함)
dotenv.config();

const app = express();

// __dirname 대체 (ES Module 방식)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 미들웨어 설정 =====
app.use(cors());
app.use(
  bodyParser.json({
    limit: "50mb",
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

// ===== 정적 파일 서빙 =====
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(__dirname));

// 루트("/") → index.html
app.get("/", (req, res) => {
  const publicIndex = path.join(__dirname, "public", "index.html");
  const rootIndex = path.join(__dirname, "index.html");

  res.sendFile(publicIndex, (err) => {
    if (err) {
      res.sendFile(rootIndex, (err2) => {
        if (err2) {
          console.error("❌ index.html을 찾을 수 없습니다.");
          res.status(404).send("index.html 파일을 찾을 수 없습니다.");
        }
      });
    }
  });
});

// ===== OpenAI 클라이언트 =====
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 헬스 체크용
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 🔹 fallback용 더미 결과 (OpenAI 문제 시 사용)
const demoResult = {
  score: 72,
  skinType: "복합성",
  issues: ["모공", "피지", "잔주름"],
  riskLevel: "mid",
  summary: "전반적으로 무난한 복합성 피부지만, T존 피지와 모공 관리가 필요해 보여요.",
  detailAdvice:
    "아침에는 자극 적은 젤 타입 세안제로 가볍게 세안하고, 유분이 많은 부위에는 유분 조절 토너를 한 번 더 사용해 주세요. 저녁에는 진한 세안 후 수분 위주의 세럼과 크림으로 충분히 보습해 주는 것이 좋아요. 주 1~2회 정도 각질/피지 케어 제품(필링 패드, 클레이 마스크 등)을 T존 위주로만 사용해 주면 모공 관리에 도움이 됩니다. 자외선 차단제는 사계절 매일 꼼꼼하게 발라주세요."
};

/**
 * 피부 분석 API
 * POST /api/skin-analyze
 *
 * body 예시:
 * {
 *   "imageBase64": "data:image/jpeg;base64,...."
 * }
 */
app.post("/api/skin-analyze", async (req, res) => {
  // body에서 이미지 찾기
  const {
    imageBase64: rawImageBase64,
    uploadedImage,
    image,
    dataUrl,
  } = req.body || {};
  const imageBase64 =
    rawImageBase64 || uploadedImage || image || dataUrl;

  console.log("📩 /api/skin-analyze body keys:", Object.keys(req.body || {}));

  if (!imageBase64 || typeof imageBase64 !== "string") {
    // 그래도 500 말고 400으로 깔끔하게
    return res.status(400).json({
      success: false,
      error:
        "imageBase64(또는 uploadedImage) 필드가 비어 있습니다. 사진을 다시 업로드해 주세요.",
    });
  }

  // 🔸 OPENAI_API_KEY 가 없다 → 더미 결과라도 반환 (500 안 띄움)
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY 미설정 – demoResult 반환");
    return res.json({
      success: true,
      data: demoResult,
      usedFallback: true,
      reason: "OPENAI_API_KEY 미설정으로 더미 결과를 반환했습니다."
    });
  }

  try {
    const systemPrompt = `
당신은 전문 피부과 전문의입니다.
사용자가 보낸 얼굴 사진을 분석해서 피부 상태를 평가합니다.

반드시 다음 JSON 형식으로만 대답하세요. 추가 설명 문장은 절대 넣지 마세요.

{
  "score": number,           // 0~100, 점수가 높을수록 전반적으로 건강한 피부
  "skinType": "건성" | "지성" | "복합성" | "중성",
  "issues": string[],        // 주요 고민: 예) ["모공", "트러블", "색소침착", "주름", "피지", "홍조"]
  "riskLevel": "low" | "mid" | "high",
  "summary": string,         // 한 줄 요약 (한국어, 1~2문장)
  "detailAdvice": string     // 사용자의 상태를 바탕으로 한 4~7줄 정도의 구체적인 피부 관리 팁 (한국어)
}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "다음 얼굴 사진을 보고 위 JSON 형식에 맞춰서 피부 상태를 분석해 주세요.",
            },
            {
              type: "input_image",
              image_url: {
                url: imageBase64, // data URL 그대로 사용
              },
            },
          ],
        },
      ],
    });

    const messageContent = completion.choices?.[0]?.message?.content;
    if (!messageContent) {
      throw new Error("OpenAI 응답에서 content를 찾을 수 없습니다.");
    }

    let parsed;
    try {
      parsed = JSON.parse(messageContent);
    } catch (e) {
      console.error("🔴 JSON 파싱 오류, 원본 content:", messageContent);
      throw new Error("AI 응답을 파싱하는 중 오류가 발생했습니다.");
    }

    const safeResult = {
      score:
        typeof parsed.score === "number"
          ? Math.min(Math.max(parsed.score, 0), 100)
          : demoResult.score,
      skinType: parsed.skinType || demoResult.skinType,
      issues: Array.isArray(parsed.issues) && parsed.issues.length
        ? parsed.issues
        : demoResult.issues,
      riskLevel:
        parsed.riskLevel === "low" ||
        parsed.riskLevel === "mid" ||
        parsed.riskLevel === "high"
          ? parsed.riskLevel
          : demoResult.riskLevel,
      summary: parsed.summary || demoResult.summary,
      detailAdvice: parsed.detailAdvice || demoResult.detailAdvice,
    };

    return res.json({
      success: true,
      data: safeResult,
      usedFallback: false,
    });
  } catch (error) {
    console.error("❌ /api/skin-analyze OpenAI 호출 오류:", error);

    // 🔸 OpenAI 쪽 에러여도, 더미 결과 반환 (500 대신 200)
    return res.json({
      success: true,
      data: demoResult,
      usedFallback: true,
      reason: error?.message || "OpenAI 호출 중 오류가 발생하여 더미 결과를 반환했습니다.",
    });
  }
});

// ===== 서버 실행 =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ 서버가 포트 ${PORT}에서 실행 중입니다. (PORT=${PORT})`);
});
