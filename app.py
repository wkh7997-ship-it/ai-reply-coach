 from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, requests, json

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/<path:path>")
def static_file(path):
    # index.html, confirm.html, result.html, icon, manifest 등 정적 파일 서빙
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
                    "content": "너는 전문 피부과 의사 수준의 피부 분석 AI다. 한국어로 1) 전체 요약 2) 문제 부위 3) 관리 팁 순서로 8줄 이내로 정리해라."
                },
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "이 얼굴 피부를 분석해 줘."},
                        {"type": "image_url", "image_url": {"url": image_base64}}
                    ]
                }
            ]
        }

        resp = requests.post(OPENAI_URL, headers=headers, data=json.dumps(payload))
        resp_data = resp.json()
        if resp.status_code != 200:
            return jsonify({"error": resp_data.get("error", {}).get("message", "OpenAI 오류")}), 500

        result_text = resp_data["choices"][0]["message"]["content"]
        return jsonify({"result": result_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
      
