from flask import Flask, request, jsonify, send_from_directory
import requests
import os

app = Flask(__name__)

API_KEY = os.environ.get("OPENAI_API_KEY")


# ----------------------
# 1) 정적 파일 라우트
# ----------------------
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/result")
def result_page():
    return send_from_directory(".", "result.html")

@app.route("/manifest.json")
def manifest():
    return send_from_directory(".", "manifest.json")

@app.route("/icon-192.png")
def icon_192():
    return send_from_directory(".", "icon-192.png")

@app.route("/icon-512.png")
def icon_512():
    return send_from_directory(".", "icon-512.png")


# ----------------------
# 2) 답장 생성 API
# ----------------------
@app.route("/reply", methods=["POST"])
def reply():
    try:
        data = request.get_json()
        if not data or "text" not in data:
            return jsonify({"error": "text가 전달되지 않았습니다."}), 400

        user_text = data["text"]
        tone = data.get("tone", "기본")

        tone_desc_map = {
            "기본": "일반적인 상황에서 무난하고 예의 있게",
            "연애": "연애/썸 상대에게 다정하고 호감 있게",
            "직장": "직장 상사나 동료에게 예의 있게 프로답게",
            "친구": "친한 친구에게 자연스럽고 편하게",
            "가족": "가족에게 따뜻하고 편하게"
        }

        tone_desc = tone_desc_map.get(tone, tone_desc_map["기본"])

        prompt = (
            f"상황: {tone}\n"
            f"설명: {tone_desc}\n\n"
            "아래 메시지에 대해 서로 다른 3가지 한국어 답장을 생성해줘.\n"
            "각 답장은 한 줄이며 형식은 다음과 같다.\n"
            "답장문장 || 위험도 || 센스 || 한줄설명\n"
            f"상대방 메시지: '{user_text}'"
        )

        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
            },
            timeout=30,
        )

        data = response.json()

        if response.status_code != 200:
            return jsonify({
                "error": "OpenAI API 호출 에러",
                "status": response.status_code,
                "details": data,
            }), response.status_code

        answer = data["choices"][0]["message"]["content"]
        return jsonify({"reply": answer})

    except Exception as e:
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500


# ----------------------
# 3) 위험한 답장 수정 API
# ----------------------
@app.route("/fix", methods=["POST"])
def fix_reply():
    try:
        data = request.get_json()
        original = data.get("text", "")
        tone = data.get("tone", "기본")

        if not original:
            return jsonify({"error": "text가 전달되지 않았습니다."}), 400

        tone_desc_map = {
            "기본": "일반적인 상황에서 무난하고 예의 있게",
            "연애": "연애/썸 상대에게 다정하고 호감 있게",
            "직장": "직장 상사나 동료에게 예의 있게 프로답게",
            "친구": "친한 친구에게 자연스럽고 편하게",
            "가족": "가족에게 따뜻하고 편하게"
        }
        tone_desc = tone_desc_map.get(tone, tone_desc_map["기본"])

        prompt = (
            f"상황: {tone}\n"
            f"설명: {tone_desc}\n"
            "아래 한국어 문장이 상대에게 불편할 수 있어.\n"
            "원래 의미는 유지하되 부드럽고 예의 있게 다시 작성해줘.\n"
            f"문장: '{original}'"
        )

        response = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }
        )

        data = response.json()

        if response.status_code != 200:
            return jsonify({
                "error": "OpenAI API 호출 에러",
                "status": response.status_code,
                "details": data,
            }), response.status_code

        fixed = data["choices"][0]["message"]["content"].strip()
        return jsonify({"fixed": fixed})

    except Exception as e:
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)









