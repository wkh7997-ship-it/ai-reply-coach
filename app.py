from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import openai
import os

app = Flask(__name__)
CORS(app)

openai.api_key = os.getenv("OPENAI_API_KEY")  # Render 환경변수에서 자동 로드

@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.json
        image_base64 = data.get("image")

        if not image_base64:
            return jsonify({"error": "이미지가 전달되지 않았습니다"}), 400

        # OpenAI Vision API 호출
        completion = openai.ChatCompletion.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "너는 전문 피부과 의사 수준의 피부 분석 AI다. (요약 → 문제점 → 원인 → 관리 팁 순으로 10줄 이내)"
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "이 얼굴 사진을 분석해줘."},
                        {"type": "image_url", "image_url": {"url": image_base64}}
                    ]
                }
            ]
        )

        result_text = completion["choices"][0]["message"]["content"]

        return jsonify({"result": result_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/")
def home():
    return "AI Skin Coach Server OK"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
