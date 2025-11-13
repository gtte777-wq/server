import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// --- React 정적 파일 서빙 (프로덕션용) ---
// 모든 요청에 대해 'client/dist' 폴더의 파일을 먼저 찾습니다.
app.use('/*', serveStatic({ root: '../client/dist' }));
// 위에서 파일을 찾지 못하고 GET 요청일 경우, React Router가 처리하도록 index.html을 반환합니다.
app.get('*', serveStatic({ path: '../client/dist/index.html' }));

// --- 서버 실행 ---
const PORT = 8080;
console.log(`🚀 프로덕션 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
console.log('이제 브라우저에서 위 주소로 접속하여 React 앱을 확인하세요.');
serve({
    fetch: app.fetch,
    port: PORT
});