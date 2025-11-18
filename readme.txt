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