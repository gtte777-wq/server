import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import Parser from "rss-parser";

// 1. 기본 설정
const app = new Hono();
const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    Accept: "application/rss+xml, application/xml, text/xml; q=0.1",
  },
});

// 2. CORS 허용
app.use("/api/*", cors());

// ==========================================
// 📰 [API] 글로벌 뉴스 데이터 제공
// ==========================================
app.get("/api/news", async (c) => {
  console.log("📡 글로벌 뉴스 데이터 요청 시작...");
  try {
    const RSS_FEEDS = [
      {
        url: encodeURI(
          "https://news.google.com/rss/search?q=주식+경제+삼성전자&hl=ko&gl=KR&ceid=KR:ko"
        ),
        source: "Google News(KR)",
        type: "domestic",
      },
      {
        url: "https://www.mk.co.kr/rss/30000001/",
        source: "매일경제",
        type: "domestic",
      },
      {
        url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
        source: "CNBC(US)",
        type: "global",
      },
      {
        url: "https://www.wired.com/feed/category/business/latest/rss",
        source: "Wired(Tech)",
        type: "global",
      },
    ];

    const promises = RSS_FEEDS.map(async (feedInfo) => {
      try {
        const feed = await parser.parseURL(feedInfo.url);
        return feed.items.map((item) => {
          let sentiment = "neutral";
          const titleLower = item.title.toLowerCase();
          if (
            titleLower.includes("급등") ||
            titleLower.includes("상승") ||
            titleLower.includes("soar") ||
            titleLower.includes("surge")
          ) {
            sentiment = "positive";
          } else if (
            titleLower.includes("급락") ||
            titleLower.includes("하락") ||
            titleLower.includes("plunge") ||
            titleLower.includes("drop")
          ) {
            sentiment = "negative";
          }
          return {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            source: feedInfo.source,
            isGlobal: feedInfo.type === "global",
            content: item.contentSnippet || "",
            sentiment: sentiment,
          };
        });
      } catch (e) {
        console.error(`❌ ${feedInfo.source} 로드 실패:`, e.message);
        return [];
      }
    });

    const results = await Promise.all(promises);
    const allNews = results.flat();
    allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const finalNews = allNews.map((item, index) => ({ ...item, id: index }));

    return c.json({ success: true, data: finalNews });
  } catch (error) {
    console.error("❌ 서버 내부 에러:", error);
    return c.json(
      { success: false, message: "서버 에러: " + error.message },
      500
    );
  }
});

// ==========================================
// 🤖 [API] AI 분석 요청 중계 (React -> Node -> Python)
// ==========================================
app.post("/api/ai-predict", async (c) => {
  console.log("🤖 AI 분석 요청 도착!");
  try {
    const body = await c.req.parseBody();
    const file = body["file"];
    const modelType = body["modelType"];

    if (!file)
      return c.json({ success: false, message: "파일이 없습니다." }, 400);

    // 🚨 모델 타입에 따라 Python 주소 결정 (여기가 수정된 부분입니다!)
    let pythonUrl = "";
    if (modelType === "muffin") {
      pythonUrl = "http://localhost:8000/predict/muffin";
    } else if (modelType === "rice") {
      pythonUrl = "http://localhost:8000/predict/rice";
    } else if (modelType === "plant") {
      pythonUrl = "http://localhost:8000/predict/plant";
    } else if (modelType === "face") {
      // 👈 [NEW] 여기 추가!
      pythonUrl = "http://localhost:8000/predict/face";
    } else {
      return c.json(
        { success: false, message: "알 수 없는 모델 타입입니다." },
        400
      );
    }

    // Python 서버로 파일 전송
    const formData = new FormData();
    formData.append("file", file);

    const pythonResponse = await fetch(pythonUrl, {
      method: "POST",
      body: formData,
    });

    if (!pythonResponse.ok) {
      throw new Error(`Python 서버 오류: ${pythonResponse.statusText}`);
    }

    const aiResult = await pythonResponse.json();
    return c.json(aiResult);
  } catch (error) {
    console.error("❌ AI 서버 연결 실패:", error);
    return c.json(
      { success: false, message: "AI 서버 연결 실패: " + error.message },
      500
    );
  }
});

// ==========================================
// 🖥️ React 정적 파일 서빙
// ==========================================
app.use("/*", serveStatic({ root: "../client/dist" }));
app.get("*", serveStatic({ path: "../client/dist/index.html" }));

// ==========================================
// 🚀 서버 실행
// ==========================================
const PORT = 8080;
console.log(`🚀 통합 서버 가동! http://localhost:${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
});
