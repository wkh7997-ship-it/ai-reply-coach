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

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY가 설정되어 있지 않습니다. .env 파일을 확인하세요.");
}

const app = express();

// __dirname 대체 (ES Module 방식)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 미들웨어 설정 =====
app.use(cors());
app.use(
  bodyParser.json({
    // base64 이미지 때문에 넉넉하게
    limit: "50mb",
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

// ===== 정적 파일 서빙 설정 =====
// 1) /public 폴더가 있다면 거기서도 파일 서빙
app.use(express.static(path.join(__dirname, "public")));

// 2) HTML 파일이 server.js와 같은 폴더에 있어도 동작하도록 루트도 정적 경로로 추가
app.use(express.static(__dirname));

// 3) 루트("/") 접속 시 index.html 반환
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
  try {
    // 혹시 다른 키 이름으로 들어와도 대응하도록 안전하게 처리
    const {
      imageBase64: rawImageBase64,
      uploadedImage,
      image,
      dataUrl,
    } = req.body || {};

    const imageBase64 =
      rawImageBase64 || uploadedImage || image || dataUrl;

    // 디버깅용: 어떤 키가 들어왔는지 로그
    console.log("📩 /api/skin-analyze body keys:", Object.keys(req.body || {}));

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({
        success: false,
        error:
          "imageBase64(또는 uploadedImage) 필드가 필요합니다. 프론트에서 전송 필드를 확인하세요.",
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "서버에 OPENAI_API_KEY가 설정되어 있지 않습니다.",
      });
    }

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
      model: "gpt-4.1-mini",
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
                // 클라이언트에서 "data:image/jpeg;base64,..." 형식으로 보내주면 그대로 사용
                url: imageBase64,
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
          : 70,
      skinType: parsed.skinType || "복합성",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      riskLevel:
        parsed.riskLevel === "low" ||
        parsed.riskLevel === "mid" ||
        parsed.riskLevel === "high"
          ? parsed.riskLevel
          : "mid",
      summary: parsed.summary || "전반적으로 무난한 피부 상태입니다.",
      detailAdvice:
        parsed.detailAdvice ||
        "세안 후 기본 보습을 꼼꼼하게 해주시고, 자외선 차단제를 매일 사용하는 것만으로도 지금보다 훨씬 건강한 피부 컨디션을 유지할 수 있습니다.",
    };

    return res.json({
      success: true,
      data: safeResult,
    });
  } catch (error) {
    console.error("❌ /api/skin-analyze 오류:", error);

    return res.status(500).json({
      success: false,
      error: "피부 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    });
  }
});

// ===== 서버 실행 =====
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ 서버가 포트 ${PORT}에서 실행 중입니다. (PORT=${PORT})`);
});
