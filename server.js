import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import 'dotenv/config';
import axios from 'axios';

const app = new Hono();

// ==========================================
// 1. ⚙️ 실전 투자 환경 설정
// ==========================================
const IS_REAL = process.env.IS_REAL_TRADING === "TRUE";
const APP_KEY = process.env.KIS_APP_KEY;
const APP_SECRET = process.env.KIS_APP_SECRET;
const ACCOUNT_NO = process.env.KIS_ACCOUNT_NO;
const ACCOUNT_CODE = process.env.KIS_ACCOUNT_CODE || "01";

// 실전 투자용 주소
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

let accessToken = null; 

console.log("========================================");
console.log(`🚀 [실전 투자 서버] 가동 시작`);
console.log(`🔧 [Fix] 차트 데이터 필드명 수정 완료 (stck_bsop_date)`);
console.log("========================================");

// ==========================================
// 2. 🤖 봇 상태 관리
// ==========================================
const botState = {
    isRunning: false,
    symbol: "005930",
    buyPrice: 50000,
    sellPrice: 80000,
    isBought: false
};

// ==========================================
// 3. 인증 및 유틸리티
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

// ==========================================
// 4. 💰 주문 함수
// ==========================================
async function sendOrder(type, symbol) {
    const trId = type === 'BUY' ? "TTTC0802U" : "TTTC0801U"; 
    try {
        const response = await axios.post(`${KIS_BASE_URL}/uapi/domestic-stock/v1/trading/order-cash`, {
            "CANO": ACCOUNT_NO,
            "ACNT_PRDT_CD": ACCOUNT_CODE,
            "PDNO": symbol,
            "ORD_DVSN": "01", 
            "ORD_QTY": "1",
            "ORD_UNPR": "0",
        }, { headers: getKisHeaders(trId) });

        if(response.data.rt_cd === '0') {
            console.log(`✅ [체결] ${type} 성공!`);
            return true;
        } else {
            console.error(`❌ 주문 실패: ${response.data.msg1}`);
            return false;
        }
    } catch (e) { return false; }
}

// ==========================================
// 5. 🔄 자동매매 루프
// ==========================================
async function runTradingBot() {
    if (!botState.isRunning) return;

    try {
        if(!accessToken) await getAccessToken();

        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            headers: getKisHeaders("FHKST01010100"),
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: botState.symbol }
        });

        const currentPrice = parseInt(response.data.output.stck_prpr);
        console.log(`🤖 [감시중] ${botState.symbol}: ${currentPrice.toLocaleString()}원`);

        if (!botState.isBought && currentPrice <= botState.buyPrice) {
            const success = await sendOrder("BUY", botState.symbol);
            if (success) botState.isBought = true;
        } 
        else if (botState.isBought && currentPrice >= botState.sellPrice) {
            const success = await sendOrder("SELL", botState.symbol);
            if (success) botState.isBought = false;
        }
    } catch (e) {}
}

// ==========================================
// 6. API 라우트
// ==========================================
app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

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

// 🚨 [수정됨] 캔들 차트 API (필드명 불일치 해결!)
app.get("/api/stock/candles", async (c) => {
    const symbol = c.req.query("symbol");
    
    try {
        const token = await getAccessToken();
        if (!token) return c.json({ success: false, message: "Token Error" });

        const today = new Date();
        const past = new Date(); past.setFullYear(today.getFullYear() - 1);
        const fmt = (d) => `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;

        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice`, {
            headers: getKisHeaders("FHKST01010100"),
            params: { 
                FID_COND_MRKT_DIV_CODE: "J", 
                FID_INPUT_ISCD: symbol, 
                FID_INPUT_DATE_1: fmt(past), 
                FID_INPUT_DATE_2: fmt(today), 
                FID_PERIOD_DIV_CODE: "D", 
                FID_ORG_ADJ_PRC: "1" 
            }
        });

        const rawData = response.data.output2;

        if (!rawData || rawData.length === 0) {
            console.warn(`⚠️ 데이터 0건 수신 (휴장일 가능성)`);
            return c.json({ success: true, data: [] }); 
        }

        console.log(`✅ 데이터 수신 성공: ${rawData.length}개`);

        // 🛠️ [핵심 수정] stck_bsop_date를 stck_bsdy로 변환하여 매핑
        const sanitized = rawData
            .filter(item => item.stck_bsop_date && item.stck_clpr) // 필터 조건 수정 (stck_bsop_date 확인)
            .map(item => ({
                ...item,
                stck_bsdy: item.stck_bsop_date // 프론트엔드가 알 수 있게 이름 복사
            }))
            .reverse();

        console.log(`📤 변환 후 전송 개수: ${sanitized.length}개 (성공!)`);

        return c.json({ success: true, data: sanitized });

    } catch (e) { 
        console.error("🧨 에러:", e.message);
        return c.json({ success: false, message: e.message }); 
    }
});

app.get("/api/stock/current-price", async (c) => {
    const symbol = c.req.query("symbol");
    try {
        await getAccessToken();
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            headers: getKisHeaders("FHKST01010100"),
            params: { FID_COND_MRKT_DIV_CODE: 'J', FID_INPUT_ISCD: symbol }
        });
        return c.json({ success: true, data: response.data.output });
    } catch (e) { return c.json({ success: false }); }
});

app.use("/*", serveStatic({ root: "../client/dist" }));
app.get("*", serveStatic({ path: "../client/dist/index.html" }));

const PORT = 3000; 
serve({ fetch: app.fetch, port: PORT });
console.log(`🌐 서버 접속: http://localhost:${PORT}`);

setInterval(runTradingBot, 3000);