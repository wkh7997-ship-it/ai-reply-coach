from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import requests
import json

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_file(path):
    return send_from_directory(app.static_folder, path)


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json()
        image_base64 = data.get("image")

        if not image_base64:
            return jsonify({"error": "이미지가 전달되지 않았습니다."}), 400

        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "너는 전문 피부과 AI다. 사진을 보고 "
                        "1) 전체 요약 2) 문제 부위 3) 관리 팁 "
                        "을 한국어로 간결하게 정리해라."
                    )
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "피부 분석해줘."},
                        {"type": "image_url", "image_url": {"url": image_base64}}
                    ]
                }
            ]
        }

        resp = requests.post(OPENAI_URL, headers=headers, data=json.dumps(payload))
        result_data = resp.json()

        if resp.status_code != 200:
            return jsonify({
                "error": result_data.get("error", {}).get("message", "OpenAI 오류 발생")
            }), 500

        result_text = result_data["choices"][0]["message"]["content"]
        return jsonify({"result": result_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
