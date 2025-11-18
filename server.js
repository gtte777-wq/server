import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { cors } from "hono/cors";
import Parser from "rss-parser";

const app = new Hono();

// 1. RSS 파서 설정 (구글 봇 차단 방지용 헤더)
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
// 📰 [API] 글로벌 뉴스 데이터 제공 (멀티 소스)
// ==========================================
app.get("/api/news", async (c) => {
  console.log("📡 글로벌 뉴스 데이터 요청 시작...");

  try {
    // 1. 감시하고 싶은 뉴스 소스 목록 (한글 주소는 encodeURI 필수!)
    const RSS_FEEDS = [
      // (1) 구글 뉴스 (국내 속보)
      {
        url: encodeURI(
          "https://news.google.com/rss/search?q=주식+경제+삼성전자&hl=ko&gl=KR&ceid=KR:ko"
        ),
        source: "Google News(KR)",
        type: "domestic",
      },
      // (2) 매일경제 (국내 경제)
      {
        url: "https://www.mk.co.kr/rss/30000001/",
        source: "매일경제",
        type: "domestic",
      },
      // (3) CNBC (미국 금융)
      {
        url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
        source: "CNBC(US)",
        type: "global",
      },
      // (4) Wired (글로벌 테크)
      {
        url: "https://www.wired.com/feed/category/business/latest/rss",
        source: "Wired(Tech)",
        type: "global",
      },
    ];

    // 2. 모든 주소에서 동시에 데이터 긁어오기 (Promise.all)
    const promises = RSS_FEEDS.map(async (feedInfo) => {
      try {
        const feed = await parser.parseURL(feedInfo.url);

        return feed.items.map((item) => {
          // 감성 분석 (간단 키워드 매칭)
          let sentiment = "neutral";
          const titleLower = item.title.toLowerCase();

          if (
            titleLower.includes("급등") ||
            titleLower.includes("상승") ||
            titleLower.includes("soar") ||
            titleLower.includes("surge") ||
            titleLower.includes("jump")
          ) {
            sentiment = "positive";
          } else if (
            titleLower.includes("급락") ||
            titleLower.includes("하락") ||
            titleLower.includes("plunge") ||
            titleLower.includes("drop") ||
            titleLower.includes("crash")
          ) {
            sentiment = "negative";
          }

          return {
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            source: feedInfo.source, // 우리가 정한 소스 이름
            isGlobal: feedInfo.type === "global",
            content: item.contentSnippet || "",
            sentiment: sentiment,
          };
        });
      } catch (e) {
        console.error(`❌ ${feedInfo.source} 로드 실패:`, e.message);
        return []; // 에러 나면 빈 배열 반환 (전체 중단 방지)
      }
    });

    // 3. 데이터 합치기
    const results = await Promise.all(promises);
    const allNews = results.flat(); // 배열 평탄화

    // 4. 최신 날짜순 정렬 (Newest First)
    allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // 5. ID 재부여 (React Key 용도)
    const finalNews = allNews.map((item, index) => ({ ...item, id: index }));

    console.log(`✅ 총 ${finalNews.length}개 글로벌 뉴스 로드 완료!`);
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
// 🖥️ React 정적 파일 서빙
// ==========================================
app.use("/*", serveStatic({ root: "../client/dist" }));
app.get("*", serveStatic({ path: "../client/dist/index.html" }));

// ==========================================
// 🚀 서버 실행
// ==========================================
const PORT = 8080;
console.log(`🚀 서버 재가동! http://localhost:${PORT}`);

serve({
  fetch: app.fetch,
  port: PORT,
});
