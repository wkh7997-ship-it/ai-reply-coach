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

    concerns_text = ", ".join(concerns) if isinstance(concerns, list) else str(concerns)

    user_prompt = f"""
사용자의 피부 고민 정보는 다음과 같습니다:

- 피부 타입: {skin_type}
- 주 고민: {concerns_text}
- 특히 신경 쓰이는 부위: {area}
- 사용자의 추가 설명: {notes}

아래 구조로 설명해주세요:

1) 전체 평가
2) 부위별 관찰  
3) 셀프 확인 포인트  
4) 관리 방향  
5) 안전 문구 (필수)  
"""

    # 🔥 Responses API 호출
    completion = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    # 🔥🔥 Responses API 결과 안전하게 파싱하기
    analysis_text = ""

    try:
        # 최상위 output 배열 검사
        if completion.output and len(completion.output) > 0:
            first = completion.output[0]

            # content 배열 검사
            if "content" in first and len(first["content"]) > 0:
                block = first["content"][0]

                # text 추출
                if "text" in block:
                    analysis_text = block["text"]

    except Exception as e:
        analysis_text = "AI 응답 처리 중 오류가 발생했습니다."

    # 혹시 빈값이면 fallback
    if not analysis_text:
        analysis_text = "결과를 생성하지 못했습니다. 잠시 후 다시 시도해주세요."

    return jsonify({"analysis": analysis_text})

# ------------------------------
# 3) 로컬 실행
# ------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
