from flask import Flask, request, jsonify, send_from_directory
import requests
import os

app = Flask(__name__)

# 👉 Render 환경 변수에 OPENAI_API_KEY 넣어둔 것 사용
API_KEY = os.environ.get("OPENAI_API_KEY")

# ----------------------
# 1) 정적 파일 / 메인 화면
# ----------------------

# 홈 화면: index.html
@app.route("/")
def index():
    return send_from_directory(".", "index.html")

# PWA manifest
@app.route("/manifest.json")
def manifest():
    return send_from_directory(".", "manifest.json")

# PWA 아이콘들 (나중에 파일만 루트에 올리면 됨)
@app.route("/icon-192.png")
def icon_192():
    return send_from_directory(".", "icon-192.png")

@app.route("/icon-512.png")
def icon_512():
    return send_from_directory(".", "icon-512.png")
@app.route("/service-worker.js")
def service_worker():
    # service-worker.js 파일을 루트에서 그대로 내려줌
    return send_from_directory(".", "service-worker.js")


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
            "연애": "연애/썸 상대에게 다정하고 호감 있게, 너무 부담스럽지 않게",
            "직장": "직장 상사나 회사 동료에게 공손하고 프로답게",
            "친구": "친한 친구에게 가볍고 편하게, 장난은 적당히",
            "가족": "가족에게 따뜻하지만 솔직하게, 걱정되지 않게",
        }
        tone_desc = tone_desc_map.get(tone, tone_desc_map["기본"])

        prompt = (
            f"상황: {tone}\n"
            f"설명: {tone_desc}\n\n"
            "아래 메시지에 대해 3가지 서로 다른 스타일의 한국어 답장을 생성해줘.\n"
            "각 답장은 다음 기준을 따른다:\n"
            "1) 매우 예의 있고 무난한 답장\n"
            "2) 약간 솔직하고 직설적인 답장\n"
            "3) 감정이 조금 섞여 다소 까칠하거나 민감하게 느껴질 수 있는 답장\n"
            "(단, 욕설/비하/폭력적 표현은 절대 금지)\n\n"
            "각 답장은 한 줄로 짧게 작성하고, 각 답장마다 다음 정보를 함께 제공해줘.\n"
            "- 위험도: 0~100 (숫자, 높을수록 상대가 기분 나쁠 위험이 큼)\n"
            "- 센스: 0~100 (숫자, 높을수록 자연스럽고 센스 있음)\n"
            "- 한 줄 코멘트: 톤에 대한 짧은 설명\n\n"
            "각 답장은 반드시 아래 형식의 한 줄로 만들어줘:\n"
            "답장문장 || 위험도 || 센스 || 한줄설명\n\n"
            "세 개의 답장을 각각 줄바꿈으로 구분해서 보내줘.\n\n"
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

        try:
            data = response.json()
        except Exception:
            return jsonify({
                "error": "OpenAI 응답 JSON 파싱 실패",
                "raw": response.text,
            }), 500

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
            "연애": "연애/썸 상대에게 다정하고 호감 있게, 너무 부담스럽지 않게",
            "직장": "직장 상사나 회사 동료에게 공손하고 프로답게",
            "친구": "친한 친구에게 가볍고 편하게, 장난은 적당히",
            "가족": "가족에게 따뜻하지만 솔직하게, 걱정되지 않게",
        }
        tone_desc = tone_desc_map.get(tone, tone_desc_map["기본"])

        prompt = (
            f"상황: {tone}\n"
            f"설명: {tone_desc}\n\n"
            "아래 한국어 문장은 상대방을 약간 불편하게 만들 수 있는 위험이 있습니다.\n"
            "원래 의미는 최대한 유지하되, 상대가 기분 나쁘지 않도록 부드럽고 예의 있게 다시 써주세요.\n"
            "가능하면 위험도는 20 이하로 떨어지도록 표현을 바꿔주세요.\n"
            "한 줄짜리 답장만 반환하세요.\n\n"
            f"원래 문장: '{original}'"
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

        fixed = data["choices"][0]["message"]["content"].strip()
        return jsonify({"fixed": fixed})

    except Exception as e:
        return jsonify({"error": f"서버 내부 오류: {str(e)}"}), 500


if __name__ == "__main__":
    # Render에서는 이 블록이 직접 실행되진 않지만, 로컬 테스트용으로 둬도 됨
    app.run(host="0.0.0.0", port=5000, debug=True)




