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
// ⚠️ 주의: 모의투자용 Key를 사용 중이라면 주소를 "https://openapivts.koreainvestment.com:29443" 로 변경해야 합니다.
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"; 
const APP_KEY = process.env.KIS_APP_KEY;
const APP_SECRET = process.env.KIS_APP_SECRET;

// 토큰 저장용 변수
let accessToken = null; 

// ==========================================
// 🛠️ 뉴스 제목 기반 감성(Sentiment) 분석 함수
// ==========================================
function determineSentiment(title, content = "") {
    // 제목과 내용(요약)을 합쳐서 키워드 분석
    const text = (title + " " + content).toLowerCase();

    const positiveKeywords = ['상승', '호재', '급등', '최대', '역대급', '흑자', '성장', '돌파', '강세', '확대', '수주', '개발', '승인', '개선', '신규', '매수', '기대'];
    const negativeKeywords = ['하락', '악재', '급락', '최소', '적자', '손실', '감소', '부정', '약세', '축소', '철회', '경고', '우려', '이탈', '매도', '공포'];

    for (const keyword of positiveKeywords) {
        if (text.includes(keyword)) return "positive";
    }

    for (const keyword of negativeKeywords) {
        if (text.includes(keyword)) return "negative";
    }

    return "general";
}

// ==========================================
// 🔑 KIS API 인증 및 토큰 발급 함수
// ==========================================
async function getAccessToken() {
    // 토큰이 이미 있고 유효하다면 재발급 하지 않음 (단순 구현)
    if (accessToken) return accessToken;

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
        "custtype": "P",
    };
}

// ==========================================
// 2. CORS 설정
// ==========================================
app.use("/api/*", cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
}));


// ==========================================
// 🌤️ [API] 실시간 날씨 정보
// ==========================================
app.get("/api/weather", async (c) => {
    try {
        const url = "https://api.open-meteo.com/v1/forecast?latitude=35.16&longitude=126.85&current_weather=true&timezone=auto";
        const response = await fetch(url);
        const data = await response.json();
        const weather = data.current_weather;

        let condition = "맑음";
        let icon = "☀️";
        const code = weather.weathercode;

        if (code >= 1 && code <= 3) { condition = "구름 조금"; icon = "🌤️"; }
        else if (code >= 45 && code <= 48) { condition = "안개"; icon = "🌫️"; }
        else if (code >= 51 && code <= 67) { condition = "비"; icon = "🌧️"; }
        else if (code >= 71 && code <= 77) { condition = "눈"; icon = "❄️"; }
        else if (code >= 80 && code <= 82) { condition = "소나기"; icon = "☔"; }
        else if (code >= 95) { condition = "뇌우"; icon = "⚡"; }

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
    
    if (!symbol) return c.json({ success: false, message: "종목 코드 필요" }, 400);

    try {
        if (!accessToken) await getAccessToken();

        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`, {
            headers: getKisHeaders("FHKST01010100"),
            params: {
                FID_COND_MRKT_DIV_CODE: 'J',
                FID_INPUT_ISCD: symbol
            }
        });

        if (response.data.rt_cd !== '0') {
            throw new Error(response.data.msg1 || "KIS API Error");
        }

        return c.json({
            success: true,
            data: {
                stck_shrn_iscd: symbol,
                stck_prpr: response.data.output.stck_prpr,
                prdy_clpr: response.data.output.prdy_clpr,
                prdy_vrss: response.data.output.prdy_vrss,
                prdy_ctrt: response.data.output.prdy_ctrt,
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

    if (!symbol) return c.json({ success: false, message: "종목 코드 필요" }, 400);

    try {
        if (!accessToken) await getAccessToken();

        // TR_ID: FHKST01010400 (기간별 시세 - 일봉)
        const response = await axios.get(`${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-price`, {
            headers: getKisHeaders("FHKST01010400"),
            params: {
                FID_COND_MRKT_DIV_CODE: "J",
                FID_INPUT_ISCD: symbol,
                FID_PERIOD_DIV_CODE: "D", // D: 일봉
                FID_ORG_ADJ_PRC: "1",     // 1: 수정주가 반영
            }
        });

        if (response.data.rt_cd !== '0') {
            console.error(`KIS API Error (${symbol}):`, response.data.msg1);
            // 에러가 나도 빈 배열을 줘서 프론트엔드가 터지지 않게 함
            return c.json({ success: true, data: [] });
        }

        const rawCandles = response.data.output;

        // 🔍 [디버깅용 로그] 실제 받아온 데이터 개수 확인
        if (!rawCandles || rawCandles.length === 0) {
            console.log(`⚠️ [${symbol}] KIS에서 받은 캔들 데이터가 0개입니다.`);
            // 데이터가 0개라면 보통 장 휴일이거나 API 설정(모의/실전) 불일치일 수 있음
            return c.json({ success: true, data: [] });
        } else {
            console.log(`✅ [${symbol}] KIS 캔들 데이터 ${rawCandles.length}개 수신 성공`);
        }

        // 1. 데이터 정제 (필터링 조건 완화)
        // stck_bsdy(날짜)와 stck_clpr(종가)만 있어도 일단 보냅니다.
        const sanitizedCandles = rawCandles.filter(item => 
            item.stck_bsdy && item.stck_clpr
        );

        // 2. 최신순 -> 과거순 데이터를 라이브러리용(과거->최신)으로 뒤집기
        return c.json({
            success: true,
            data: sanitizedCandles.reverse()
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
                    source: feedInfo.source,
                    // 🚨 [뉴스 내용 문제 해결] 
                    // contentSnippet(짧은 요약)이 있으면 쓰고, 없으면 content 사용, 둘 다 없으면 빈 문자열
                    content: item.contentSnippet || item.content || "" 
                }));
            } catch (e) { 
                console.error(`RSS Error (${feedInfo.source}):`, e.message);
                return []; 
            }
        });

        const results = await Promise.all(promises);
        const allNews = results
            .flat()
            .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        
        // id와 감성 분석 결과 추가
        const finalNews = allNews.map((item, index) => ({ 
            ...item, 
            id: index,
            sentiment: determineSentiment(item.title, item.content) 
        }));

        return c.json({ success: true, data: finalNews });
    } catch (error) {
        console.error("뉴스 서버 에러:", error);
        return c.json({ success: false, message: "서버 에러" }, 500);
    }
});


// ==========================================
// 🤖 [API] AI 분석 요청 중계
// ==========================================
app.post("/api/ai-predict", async (c) => {
    // (기존 코드 유지)
    try {
        const body = await c.req.parseBody();
        const file = body["file"];
        const modelType = body["modelType"];

        if (!file) return c.json({ success: false, message: "파일 없음" }, 400);

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
        
        if (!pythonResponse.ok) throw new Error("Python Server Error");

        const aiResult = await pythonResponse.json();
        return c.json(aiResult);
    } catch (error) {
        return c.json({ success: false, message: "AI 서버 에러" }, 500);
    }
});

// ==========================================
// 🖥️ React 정적 파일 서빙 & 서버 실행
// ==========================================
app.use("/*", serveStatic({ root: "../client/dist" }));
app.get("*", serveStatic({ path: "../client/dist/index.html" }));

const PORT = 3000; 

getAccessToken().then(() => {
    console.log(`🚀 통합 서버 가동! http://localhost:${PORT}`);
    serve({
        fetch: app.fetch,
        port: PORT,
    });
}).catch(err => {
    console.error("❌ 초기 인증 실패:", err.message);
});