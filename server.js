import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import Parser from "rss-parser";
import 'dotenv/config';
import axios from 'axios';

// ==========================================
// 1. 기본 설정 및 KIS API 환경 변수
// ==========================================
const app = new Hono();
const parser = new Parser();

// KIS API 설정 (실전 투자 기준 URL)
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"; 
const APP_KEY = process.env.KIS_APP_KEY;
const APP_SECRET = process.env.KIS_APP_SECRET;

// 토큰 저장용 변수
let accessToken = null; 

// ==========================================
// 🔑 KIS API 인증 및 토큰 발급 함수
// ==========================================
async function getAccessToken() {
    console.log("🔑 Access Token 발급 시도...");
    if (!APP_KEY || !APP_SECRET) {
        throw new Error(".env 파일에 KIS_APP_KEY 또는 KIS_APP_SECRET이 없습니다.");
    }

    try {
        const response = await axios.post(`${KIS_BASE_URL}/oauth2/tokenP`, {
            "grant_type": "client_credentials",
            "appkey": APP_KEY,
            "appsecret": APP_SECRET
        }, {
            headers: { "Content-Type": "application/json" }
        });

        accessToken = response.data.access_token; 
        console.log("✅ Access Token 발급 성공!");
        return accessToken;
    } catch (error) {
        console.error("❌ Token 발급 실패:", error.response?.data || error.message);
        throw error;
    }
}

// ==========================================
// 🛠️ KIS API 공통 헤더 생성기
// ==========================================
function getKisHeaders(trId) {
    return {
        "Content-Type": "application/json; charset=utf-8",
        "authorization": `Bearer ${accessToken}`,
        "appkey": APP_KEY,
        "appsecret": APP_SECRET,
        "tr_id": trId,
        "custtype": "P", // 개인(P) / 법인(B)
    };
}

// ==========================================
// 2. CORS 설정
// ==========================================
// 프론트엔드(localhost:5173 등)에서 오는 요청 허용
app.use("/api/*", cors({
    origin: "*", // 개발 편의상 전체 허용 (실무에선 특정 도메인만)
    allowMethods: ["GET", "POST", "OPTIONS"],
}));


// ==========================================
// 🌤️ [API] 실시간 날씨 정보 (Open-Meteo)
// ==========================================
app.get("/api/weather", async (c) => {
    try {
        // 광주광역시 좌표
        const url =
            "https://api.open-meteo.com/v1/forecast?latitude=35.16&longitude=126.85&current_weather=true&timezone=auto";
        const response = await fetch(url);
        const data = await response.json();
        const weather = data.current_weather;

        // 날씨 코드 변환
        let condition = "맑음";
        let icon = "☀️";
        const code = weather.weathercode;

        if (code >= 1 && code <= 3) {
            condition = "구름 조금";
            icon = "🌤️";
        } else if (code >= 45 && code <= 48) {
            condition = "안개";
            icon = "🌫️";
        } else if (code >= 51 && code <= 67) {
            condition = "비";
            icon = "🌧️";
        } else if (code >= 71 && code <= 77) {
            condition = "눈";
            icon = "❄️";
        } else if (code >= 80 && code <= 82) {
            condition = "소나기";
            icon = "☔";
        } else if (code >= 95) {
            condition = "뇌우";
            icon = "⚡";
        }

        return c.json({
            success: true,
            data: {
                temp: weather.temperature,
                wind: weather.windspeed,
                condition: condition,
                icon: icon,
                location: "광주광역시",
            },
        });
    } catch (error) {
        console.error("날씨 가져오기 실패:", error);
        return c.json({ success: false, message: "날씨 정보 로딩 실패" }, 500);
    }
});


// ==========================================
// 📈 [API] 단일 종목 현재가 조회 (KIS API)
// ==========================================
app.get("/api/stock/current-price", async (c) => {
    const symbol = c.req.query("symbol");
    
    if (!symbol) {
        return c.json({ success: false, message: "종목 코드(symbol)가 필요합니다." }, 400);
    }

    try {
        // 토큰 없으면 재발급 시도
        if (!accessToken) await getAccessToken();

        // KIS API 호출 (주식 현재가 시세)
        // TR_ID: FHKST01010100 (현재가 조회)
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            headers: getKisHeaders("FHKST01010100"),
            params: {
                FID_COND_MRKT_DIV_CODE: 'J', // 시장 분류 (J: 주식)
                FID_INPUT_ISCD: symbol       // 종목 코드
            }
        });

        if (response.data.rt_cd !== '0') {
            throw new Error(response.data.msg1 || "KIS API Error");
        }

        // 프론트엔드 포맷에 맞춰 데이터 반환
        return c.json({
            success: true,
            data: {
                stck_shrn_iscd: symbol,
                stck_prpr: response.data.output.stck_prpr, // 현재가
                prdy_clpr: response.data.output.prdy_clpr, // 전일 종가
                prdy_vrss: response.data.output.prdy_vrss, // 전일 대비
                prdy_ctrt: response.data.output.prdy_ctrt, // 등락률
            }
        });

    } catch (error) {
        console.error(`❌ [${symbol}] 현재가 조회 실패:`, error.message);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// ==========================================
// 🕯️ [API] 주식 캔들(일봉) 데이터 조회 (KIS API)
// ==========================================
app.get("/api/stock/candles", async (c) => {
    const symbol = c.req.query("symbol");
    // const unit = c.req.query("unit"); // 현재는 일봉(D) 고정으로 구현

    if (!symbol) {
        return c.json({ success: false, message: "종목 코드가 필요합니다." }, 400);
    }

    try {
        if (!accessToken) await getAccessToken();

        // KIS API 호출 (국내주식 기간별 시세 - 일봉)
        // TR_ID: FHKST01010400 (기간별 시세)
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-price`, {
            headers: getKisHeaders("FHKST01010400"),
            params: {
                FID_COND_MRKT_DIV_CODE: "J",
                FID_INPUT_ISCD: symbol,
                FID_PERIOD_DIV_CODE: "D", // D: 일봉, W: 주봉, M: 월봉
                FID_ORG_ADJ_PRC: "1",     // 1: 수정주가 반영
            }
        });

        if (response.data.rt_cd !== '0') {
            console.error("KIS API Error Message:", response.data.msg1);
            throw new Error(response.data.msg1);
        }

        // KIS API의 output 배열을 그대로 줍니다. 
        return c.json({
            success: true,
            data: response.data.output // [{stck_bsdy, stck_oprc, ...}, ...]
        });

    } catch (error) {
        console.error(`❌ [${symbol}] 캔들 조회 실패:`, error.message);
        return c.json({ success: false, message: error.message }, 500);
    }
});

// ==========================================
// 📰 [API] 글로벌 뉴스 데이터 제공 (RSS Parser)
// ==========================================
app.get("/api/news", async (c) => {
    console.log("📡 뉴스 데이터 요청...");
    try {
        // 중복되는 RSS 목록을 통합하고, 원격에서 추가된 CNBC와 Wired도 포함했습니다.
        const RSS_FEEDS = [
            { url: encodeURI("https://news.google.com/rss/search?q=주식+경제+삼성전자&hl=ko&gl=KR&ceid=KR:ko"), source: "Google News(KR)", type: "domestic" },
            { url: "https://www.mk.co.kr/rss/30000001/", source: "매일경제", type: "domestic" },
            { url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664", source: "CNBC(US)", type: "global" },
            { url: "https://www.wired.com/feed/category/business/latest/rss", source: "Wired(Tech)", type: "global" },
        ];

        const promises = RSS_FEEDS.map(async (feedInfo) => {
            try {
                const feed = await parser.parseURL(feedInfo.url);
                return feed.items.map(item => ({
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    source: feedInfo.source
                }));
            } catch { return []; }
        });

        const results = await Promise.all(promises);
        const allNews = results
            .flat()
            .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // id를 추가하는 로직은 원격 버전을 따랐습니다.
        const finalNews = allNews.map((item, index) => ({ ...item, id: index }));

        return c.json({ success: true, data: finalNews });
    } catch (error) {
        return c.json({ success: false, message: "서버 에러" }, 500);
    }
});


// ==========================================
// 🤖 [API] AI 분석 요청 중계
// ==========================================
app.post("/api/ai-predict", async (c) => {
    console.log("🤖 AI 분석 요청");
    try {
        const body = await c.req.parseBody();
        const file = body["file"]; // FormData 파일 객체
        const modelType = body["modelType"];

        if (!file) return c.json({ success: false, message: "파일 없음" }, 400);

        // 로컬 버전의 URL 맵과 원격 버전의 조건문을 통합하여 정리했습니다.
        const pythonEndpoints = {
            "muffin": "http://127.0.0.1:8000/predict/muffin",
            "rice": "http://127.0.0.1:8000/predict/rice",
            "plant": "http://127.0.0.1:8000/predict/plant",
            "face": "http://127.0.0.1:8000/predict/face",
        };

        const pythonUrl = pythonEndpoints[modelType];
        if (!pythonUrl) return c.json({ success: false, message: "알 수 없는 모델" }, 400);

        const formData = new FormData();
        formData.append("file", file);

        const pythonResponse = await fetch(pythonUrl, { 
            method: "POST", 
            body: formData 
        });
        
        if (!pythonResponse.ok)
            throw new Error(`Python 서버 오류: ${pythonResponse.statusText}`);

        const aiResult = await pythonResponse.json();
        return c.json(aiResult);
    } catch (error) {
        console.error("AI 서버 연결 실패:", error);
        return c.json({ success: false, message: "AI 서버 에러" }, 500);
    }
});

// ==========================================
// 🖥️ React 정적 파일 서빙
// ==========================================
app.use("/*", serveStatic({ root: "../client/dist" }));
app.get("*", serveStatic({ path: "../client/dist/index.html" }));

// ==========================================
// 🚀 서버 실행 (포트 3000)
// ==========================================
const PORT = 3000; 

// KIS 토큰 발급 후 서버 시작
getAccessToken().then(() => {
    console.log(`🚀 통합 서버 가동! http://localhost:${PORT}`);
    serve({
        fetch: app.fetch,
        port: PORT,
    });
}).catch(err => {
    console.error("❌ 초기 인증 실패로 서버 시작 불가:", err.message);
    process.exit(1);
});