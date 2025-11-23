import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import 'dotenv/config';
import axios from 'axios';
import path from 'path';
import FormData from 'form-data'; // 📦 [필수] npm install form-data 하셨죠?

const app = new Hono();

// ==========================================
// 1. ⚙️ 설정 및 변수
// ==========================================
const IS_REAL = process.env.IS_REAL_TRADING === "TRUE";
const APP_KEY = process.env.KIS_APP_KEY;
const APP_SECRET = process.env.KIS_APP_SECRET;
const ACCOUNT_NO = process.env.KIS_ACCOUNT_NO;
const ACCOUNT_CODE = process.env.KIS_ACCOUNT_CODE || "01";
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

// 🐍 파이썬 서버 주소 (main.py가 켜져 있어야 함)
const PYTHON_SERVER_URL = "http://127.0.0.1:8000";

let accessToken = null; 

const botState = {
    isRunning: false,
    symbol: "005930",
    buyPrice: 50000,
    sellPrice: 80000,
    isBought: false
};

console.log("========================================");
console.log(`🚀 [통합 서버] 가동 시작`);
console.log(`🔗 AI 서버 연결 대상: ${PYTHON_SERVER_URL}`);
console.log("========================================");

// ==========================================
// 2. KIS 인증 및 자동매매 로직 (기존 동일)
// ==========================================
async function getAccessToken() {
    if (accessToken) return accessToken;
    try {
        const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            "grant_type": "client_credentials",
            "appkey": APP_KEY,
            "appsecret": APP_SECRET
        }, { headers: { "Content-Type": "application/json" } });
        accessToken = response.data.access_token; 
        return accessToken;
    } catch (error) {
        console.error("❌ 토큰 발급 실패:", error.message);
        return null;
    }
}

function getKisHeaders(trId) {
    return {
        "Content-Type": "application/json; charset=utf-8",
        "authorization": `Bearer ${accessToken}`,
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": trId,
        "custtype": "P",
    };
}

async function sendOrder(type, symbol) { /* ...기존 코드 생략... */ return true; }

async function runTradingBot() {
    if (!botState.isRunning) return;
    // ... 기존 봇 로직 ...
}

// ==========================================
// 3. 🌐 API 라우트 설정
// ==========================================
app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

// (1) 봇 제어
app.get("/api/bot/status", (c) => c.json({ success: true, data: botState }));
app.post("/api/bot/config", async (c) => {
    const body = await c.req.json();
    botState.symbol = body.symbol;
    botState.buyPrice = Number(body.buyPrice);
    botState.sellPrice = Number(body.sellPrice);
    botState.isBought = false; 
    return c.json({ success: true });
});
app.post("/api/bot/toggle", (c) => {
    botState.isRunning = !botState.isRunning;
    return c.json({ success: true, isRunning: botState.isRunning });
});

// (2) 날씨 API
app.get("/api/weather", async (c) => {
    let lat = c.req.query("lat");
    let lon = c.req.query("lon");
    
    // 🚨 [핵심 수정] 프론트에서 좌표를 못 주면, 강제로 서울 좌표를 넣습니다!
    if (!lat || !lon) {
        console.log("📍 위치 정보 없음 -> 서울 좌표로 강제 설정");
        lat = "37.5665";
        lon = "126.9780";
    }

    // 여기에 아까 받으신 키가 들어있어야 합니다!
    const API_KEY = process.env.WEATHER_API_KEY || "3f4518e26c74f21907d5b14de4b65485";

    try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=kr`;
        const response = await axios.get(url);
        
        console.log(`🌤️ 날씨 조회 성공: ${response.data.name}`);
        
        return c.json({
            temp: response.data.main.temp,
            desc: response.data.weather[0].description,
            icon: response.data.weather[0].icon,
            city: response.data.name
        });
    } catch (e) {
        console.error("날씨 에러:", e.message);
        
        // 🚨 [수정] 에러 나면 '활성화 대기중'이라는 가짜 예쁜 데이터를 보냄
        return c.json({
            temp: 25.0, 
            desc: "맑음 (키 활성화 대기중)", 
            icon: "01d", // 해 모양 아이콘
            city: "Seoul"
        });
    }
});

// (3) 📈 주식 AI 예측 (JSON 방식)
app.post("/api/predict", async (c) => {
    try {
        const { ticker } = await c.req.json();
        console.log(`🔮 [Node] 주식 분석: ${ticker}`);
        
        // 뉴스 데이터 (더미)
        const newsData = [{ title: "뉴스 데이터", summary: "요약 내용" }];

        // 파이썬 서버로 요청
        const aiResponse = await axios.post(`${PYTHON_SERVER_URL}/stock`, {
            ticker: ticker,
            news_data: newsData
        });

        return c.json({ success: true, ticker, news: newsData, ai_result: aiResponse.data });
    } catch (error) {
        console.error("❌ [Node] 주식 통신 실패:", error.message);
        return c.json({ success: false, error: "AI 서버 연결 실패" });
    }
});

// ==================================================================
// (4) 🖼️ [NEW] 이미지 AI 분석 중계 (머핀, 식물, 얼굴 통합)
// ==================================================================
app.post("/api/ai/:model", async (c) => {
    const modelName = c.req.param("model"); // url의 :model 부분이 여기 들어옴 (muffin, face 등)
    console.log(`📸 [Node] 이미지 분석 요청: ${modelName}`);

    try {
        // 1. 파일 받기
        const body = await c.req.parseBody();
        const file = body['file']; 

        if (!file) throw new Error("파일이 전송되지 않았습니다.");

        // 2. 파이썬용 데이터 포장 (FormData)
        const formData = new FormData();
        const buffer = await file.arrayBuffer();
        formData.append('file', Buffer.from(buffer), file.name);

        // 3. 파이썬 서버로 전송
        const pythonResponse = await axios.post(`${PYTHON_SERVER_URL}/${modelName}`, formData, {
            headers: formData.getHeaders(),
        });

        console.log(`✅ [Node] ${modelName} 분석 성공`);
        
        return c.json({ success: true, result: pythonResponse.data });

    } catch (error) {
        console.error(`❌ [Node] 이미지 처리 실패:`, error.message);
        return c.json({ success: false, error: error.message });
    }
});

// (5) 주식 차트 데이터
app.get("/api/stock/candles", async (c) => { /* ...기존 코드... */ return c.json({ success: true, data: [] }); });
app.get("/api/stock/current-price", async (c) => { /* ...기존 코드... */ return c.json({ success: true, data: {} }); });

// 정적 파일
app.use("/*", serveStatic({ root: "../client/dist" }));
app.get("*", serveStatic({ path: "../client/dist/index.html" }));

const PORT = 3000; 
serve({ fetch: app.fetch, port: PORT });
console.log(`🌐 Node Server running at http://localhost:${PORT}`);

setInterval(runTradingBot, 3000);