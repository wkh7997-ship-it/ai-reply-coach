import os
import time
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

# ===== 정적 파일 / PWA =====

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/manifest.json")
def manifest():
    return send_from_directory(".", "manifest.json")

@app.route("/service-worker.js")
def service_worker():
    return send_from_directory(".", "service-worker.js")


# ===== 1) /reply : AI 답장 생성 =====
@app.post("/reply")
def reply():
    data = request.get_json(force=True) or {}

    text   = (data.get("text") or "").strip()
    tone   = data.get("tone", "기본")

    if not text:
        return jsonify({"error": "text가 비어 있습니다."}), 400

    # TODO: 나중에 진짜 AI 붙이면 여기 수정
    reply_text = (
        "1. 오늘 영화 보러 가는 건 어때? || 위험도 25점 · 낮음 || 센스 85점 · 높음 || 부드럽게 호감을 표현하는 답장\n"
        "2. 너랑 뭐 해도 재밌을 것 같아. || 위험도 25점 · 낮음 || 센스 75점 · 중간 || 상대방과 함께하고 싶은 마음을 전함\n"
        "3. 그냥 수다 떨면서 쉬는 것도 좋지! || 위험도 25점 · 낮음 || 센스 70점 · 중간 || 편안한 분위기를 유지하는 답장"
    )

    return jsonify({"reply": reply_text})


# ===== 2) /ocr : 톡 캡처 이미지 → 텍스트 =====
@app.post("/ocr")
def ocr():
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "image 파일이 없습니다."}), 400

    # TODO: 실제 OCR 붙이면 여기서 이미지 분석
    fake_text = (
        "이미지에서 텍스트를 읽는 기능은 준비 중입니다.\n"
        "일단은 상대방 메시지를 직접 입력해서 사용해 주세요."
    )

    return jsonify({"text": fake_text})


# ===== 3) /style : 내 말투 분석 / 저장 (지금은 안 써도 됨) =====
@app.post("/style")
def style():
    data = request.get_json(force=True) or {}
    examples = (data.get("examples") or "").strip()

    if not examples:
        return jsonify({"error": "examples가 비어 있습니다."}), 400

    length = len(examples)
    if length < 50:
        label = "짧고 담백한 말투"
    elif length < 200:
        label = "편안한 일상 말투"
    else:
        label = "이모티콘 많은 말투"

    style_id = f"style-{int(time.time())}"

    return jsonify({"styleId": style_id, "label": label})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
