import os
from flask import Flask, send_from_directory, request, jsonify
from openai import OpenAI

# Flask 앱 설정
app = Flask(__name__, static_folder=".", static_url_path="")

# OpenAI 클라이언트
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------
# 1) 정적 페이지 라우트
# ------------------------------

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path: str):
    return send_from_directory(".", path)

# ------------------------------
# 2) AI 피부 분석 API
# ------------------------------

SYSTEM_PROMPT = """
당신은 '피부 관리 코치'입니다.
- 의료적 진단이나 특정 질환 확정 표현 금지
- '경향', '가능성', '패턴' 같은 완화된 표현 사용
- 과도한 공포 유발 금지
- 마지막에 반드시 '정확한 진단은 피부과 전문의에게 받으세요.' 문구 포함
"""

@app.route("/api/analyze", methods=["POST"])
def analyze_skin():
    data = request.json or {}

    skin_type = data.get("skin_type", "정보 없음")
    concerns = data.get("concerns", [])
    area = data.get("problem_area", "정보 없음")
    notes = data.get("notes", "")

    if isinstance(concerns, list):
        concerns_text = ", ".join(concerns)
    else:
        concerns_text = str(concerns)

    user_prompt = f"""
사용자의 피부 고민 정보는 다음과 같습니다:

- 피부 타입: {skin_type}
- 주 고민: {concerns_text}
- 특히 신경 쓰이는 부위: {area}
- 사용자의 추가 설명: {notes}

아래 구조로 한국어로 자연스럽게 설명해 주세요.

1. 전체 평가 (2~3문장)
2. 부위별 관찰 (눈가 / 볼·광대 / 턱·입 주변 / 피부결·민감도)
3. 집에서 체크해볼 수 있는 셀프 확인 포인트
4. 관리 방향 (클렌저, 각질/피지 관리, 진정/수분, 레티놀 주의점)
5. 안전 문구 (정확한 진단은 피부과 전문의에게 받아야 한다는 내용 포함)

톤:
- 실제 사람이 설명해주는 것처럼 부드럽게
- 과한 공포 유발 없이 차분하게
- 질환명을 단정적으로 말하지 말고, '패턴'과 '경향' 중심으로 설명
"""

    try:
        # 👉 Chat Completions API 사용 (파싱이 훨씬 단순함)
        completion = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )

        analysis_text = completion.choices[0].message.content.strip()

        if not analysis_text:
            analysis_text = "결과를 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."

        return jsonify({"analysis": analysis_text})

    except Exception as e:
        # Render 로그에서 에러 확인용
        print("ERROR in /api/analyze:", e, flush=True)
        return jsonify({
            "analysis": "",
            "error": "analysis_failed",
            "message": str(e)
        }), 500


# ------------------------------
# 3) 로컬 실행
# ------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)

