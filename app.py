import os
import time
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

# ===== 정적 파일 / PWA =====

@app.route("/")
def index():
    # 같은 폴더 안의 index.html 반환
    return send_from_directory(".", "index.html")

@app.route("/manifest.json")
def manifest():
    return send_from_directory(".", "manifest.json")

@app.route("/service-worker.js")
def service_worker():
    return send_from_directory(".", "service-worker.js")

# icon-192.png, icon-512.png 는 static_folder="." 설정 덕분에 자동 서빙됨


# ===== 1) /reply : AI 답장 생성 =====
@app.post("/reply")
def reply():
    data = request.get_json(force=True) or {}

    text     = (data.get("text") or "").strip()
    tone     = data.get("tone", "기본")
    length   = data.get("length", "short")          # 'short' | 'normal' | 'long' | 'chat'
    mode     = data.get("mode", "single")           # 'single' | 'conversation' | 'capture'
    style_id = data.get("styleId")                  # 내 말투 id (지금은 안 써도 됨)

    if not text:
        return jsonify({"error": "text가 비어 있습니다."}), 400

    # ===== TODO: 여기서 실제 AI 호출 로직 사용 =====
    #  - text, tone, length, mode, style_id 를 프롬프트에 활용하면 됨
    #  - 응답 형식은 "문장 || 위험도 25점 · 낮음 || 센스 85점 · 높음 || 한줄설명" 줄바꿈으로 3줄 정도

    reply_text = (
        "1. 오늘 영화 보러 가는 건 어때? || 위험도 25점 · 낮음 || 센스 85점 · 높음 || 부드럽게 호감을 표현하는 답장\n"
        "2. 너랑 뭐 해도 재밌을 것 같아. || 위험도 25점 · 낮음 || 센스 75점 · 중간 || 상대방과 함께하고 싶은 마음을 전함\n"
        "3. 그냥 수다 떨면서 쉬는 것도 좋지! || 위험도 25점 · 낮음 || 센스 70점 · 중간 || 편안한 분위기를 유지하는 답장"
    )

    return jsonify({"reply": reply_text})


# ===== 2) /ocr : 톡 캡처 이미지 → 텍스트 =====
@app.post("/ocr")
def ocr():
    """
    form-data 로 넘어온 image 파일을 받아서
    { "text": "...." } 형태로 돌려주는 엔드포인트.
    지금은 실제 OCR 대신 '준비 중' 문구만 내려줌.
    """
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "image 파일이 없습니다."}), 400

    # TODO: 나중에 여기서 실제 OCR 붙이면 됨 (구글 비전, Tesseract 등)
    fake_text = (
        "이미지에서 텍스트를 읽는 기능은 준비 중입니다.\n"
        "일단은 상대방 메시지를 직접 입력해서 사용해 주세요."
    )

    return jsonify({"text": fake_text})


# ===== 3) /style : 내 말투 분석 / 저장 =====
@app.post("/style")
def style():
    """
    내 말투 예시(examples)를 받아서
    { styleId, label } 형식으로 간단한 프로필을 반환.
    지금은 examples 길이로 대충 label 만듦.
    """
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
