import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const upload = multer({ storage: multer.memoryStorage() });

// 테스트용 답장 3개 생성 함수
function generateDummyReplies() {
  return [
    `좋아! 이건 진짜 무난하고 자연스러운 답장이야 || 25 || 85 || 아주 안전한 분위기`,
    `오 괜찮다! 부담 없으면서 센스 있게 대답 가능해 || 35 || 78 || 약간의 센스 강조`,
    `응 좋아 :) 너 느낌대로 더 말해도 돼 || 15 || 92 || 귀엽고 가볍게 마무리하는 톤`
  ].join("\n");
}

// 텍스트 기반 답장 API
app.post("/reply", async (req, res) => {
  const { text, tone } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text가 필요합니다." });
  }

  const replyText = generateDummyReplies();
  return res.json({ reply: replyText });
});

// 캡처 기반 답장 API
app.post("/capture-reply", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "캡처 이미지가 필요합니다." });
  }

  const replyText = generateDummyReplies();
  return res.json({ reply: replyText });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
