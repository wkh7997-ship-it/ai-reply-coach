import os
from flask import Flask, send_from_directory, request, jsonify
from openai import OpenAI

# Flask 앱 설정 (현재 폴더를 static 폴더처럼 씀)
app = Flask(__name__, static_folder=".", static_url_path="")

# OpenAI 클라이언트 (환경변수에서 키 읽기)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

# ------------------------------
# 1) 정적 페이지 라우트
# ------------------------------

@app.route("/")
def index():
    # / 로 들어오면 index.html 보여주기
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_files(path: str):
    """
    /confirm.html, /result.html, css, js, 이미지 등
    파일 이름으로 들어오는 요청은 전부 현재 폴더에서 찾아서 서빙
    """
    return send_from_directory(".", path)

# ------------------------------
# 2) AI 피부 분석 API
# ------------------------------

SYSTEM_PROMPT = """
당신은 '피부 관리 코치'입니다.
- 피부과 전문의가 아니며, 의료적 진단/치료/질환명 확정은 하지 않습니다.
- 사진이나 설명을 기반으로, 사용자의 피부 '경향'과 '관리 방향'을 설명합니다.
- 특정 질환명(예: 한관종, 지방종, 암, 종양 등)을 단정적으로 말하지 마세요.
- 대신 '작은 돌기', '피지/각질/모공 막힘', '양성으로 보이는 패턴'처럼 완화된 표현을 사용하세요.
- 항상 마지막에 '정확한 진단은 피부과 전문의에게 받으세요.'라는 문장을 포함하세요.
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

다음 구조로 한국어로 자연스럽게 설명해 주세요.

1. 전체 평가 (2~3문장)
   - 지금 피부 패턴이 어떤 경향인지 정리
   - 너무 겁주지 말고, 관리하면 좋아질 수 있다는 톤

2. 부위별 관찰
   - 눈가 / 볼·광대 / 턱·입 주변 / 피부결·민감도 정도로 나누어 설명
   - '작은 돌기', '요철', '붉음기', '번들거림', '건조함' 등으로 표현
   - 질환을 확정하지 말고 '이런 패턴에서 자주 보이는 모습' 정도로만 설명

3. 집에서 체크해볼 수 있는 셀프 확인 포인트
   - 촉감(단단/말랑/매끈), 크기(1~2mm, 3~5mm 등), 색(피부색, 노르스름, 흰색 등) 기준으로
   - 대략적으로 구분하는 팁을 알려주되, 진단이 아님을 강조

4. 관리 방향
   - 클렌저(약산성 추천 등)
   - 각질/피지 관리(유리아, PHA 등 자극 낮은 옵션 위주)
   - 진정/수분 크림 사용법
   - 레티놀/강한 각질제는 어떻게 조심해야 하는지

5. 안전 문구
   - 이 내용은 일반적인 경향 안내이며, 정확한 진단이나 치료는 피부과 전문의에게 받아야 한다는 문장 포함

말투는:
- 실제 사람이 설명해주는 것처럼 부드럽게
- 너무 의학 논문처럼 딱딱하지 않게
- 그러나 공포심 유발은 피하고 차분하게.
"""

    # OpenAI Responses API 호출
    completion = client.responses.create(
        model="gpt-4.1-mini",
        input=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    # 텍스트만 추출
    analysis_text = completion.output[0].content[0].text

    return jsonify({"analysis": analysis_text})

# ------------------------------
# 3) 로컬 테스트용
# ------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
