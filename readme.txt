# 🖥️ Node.js API Gateway

프론트엔드(React)와 AI 서버(Python), 외부 API를 연결하는 중계 서버입니다.

## ✨ 주요 기능
- **📡 RSS Aggregator:** 구글 뉴스, 매일경제 등 외부 RSS를 수집하여 JSON으로 변환 (`rss-parser`).
- **🤖 AI Proxy:** React에서 받은 이미지 파일을 Python AI 서버(FastAPI)로 안전하게 전달.
- **🛡️ CORS Handling:** 클라이언트와 서버 간의 통신 보안 정책 관리.

## 🛠️ 기술 스택
- **Hono:** 초경량/고속 웹 프레임워크.
- **rss-parser:** 뉴스 데이터 크롤링 및 파싱.

## 🚀 실행 방법

npm install
npm run dev
# (포트: 8080)

pip install fastapi uvicorn
pip install pillow torch torchvision insightface onnxruntime faiss-cpu scikit-learn opencv-python-headless
pip install pillow
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
# 1. pip 및 setuptools 최신화
visual studio community 2026 데스크탑 C++ 컴파일러 다운로드
pip install --upgrade pip setuptools wheel

# 2. NumPy를 먼저 강제 설치 (문제의 패키지)
pip install numpy

# 3. 그 다음, 원래 설치하려던 OpenCV 재설치
pip install opencv-python-headless
pip install faiss-cpu
pip install insightface
pip install --no-cache-dir scikit-image onnxruntime faiss-cpu torch torchvision insightface opencv-python-headless

npm install axios 
npm install dotenv


npm run dev
D:\MyPowerShellPractice\server\ai-server> .\final_env\Scripts\activate
(final_env) D:\MyPowerShellPractice\server\ai-server> python main.py