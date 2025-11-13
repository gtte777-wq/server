const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Mock 데이터 정의 (DB 연결 전 사용)
const MOCK_POSTS = [
    { id: 3, title: "Mock 데이터로 표시되는 세 번째 게시글입니다.", content: "서버가 정상 연결되면 이 데이터는 사라집니다.", date: new Date().toLocaleString() },
    { id: 2, title: "React Front-end에서 필터링 기능을 구현했어요.", content: "뉴스 페이지에서 필터링을 확인해 보세요.", date: new Date(Date.now() - 86400000).toLocaleString() },
    { id: 1, title: "Node.js 서버와의 연결은 집에서 확인합니다. 🔥", content: "현재는 DB 연결 부분을 임시로 우회했습니다.", date: new Date(Date.now() - 172800000).toLocaleString() },
];

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // ------------------------------------
    // 1. API 라우팅
    // ------------------------------------
    if (pathname === '/api/board/list' && method === 'GET') {
        console.log(`[API] ${pathname} 요청 수신 - Mock 데이터 반환`);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, posts: MOCK_POSTS, message: "Mock 데이터 반환됨" }));
        return;
    }
    
    // ------------------------------------
    // 2. React Router 및 정적 파일 처리
    // ------------------------------------
    
    const CLIENT_DIR = path.join(__dirname, '..', 'client'); 
    let filePath;
    let finalPathname = pathname === '/' ? '/index.html' : pathname;

    if (finalPathname.startsWith('/api')) { 
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'API Not Found' }));
        return;
    } else if (finalPathname.endsWith('.html') || finalPathname === '/index.html' || finalPathname.includes('.')) {
        // HTML, CSS, JS, 이미지, 파비콘 등 파일을 찾습니다.
        filePath = path.join(CLIENT_DIR, finalPathname);
    } else {
        // React Router 경로 (파일이 아닌 경로) -> 무조건 index.html 제공
        filePath = path.join(CLIENT_DIR, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // 파일을 찾지 못했을 경우 다시 index.html 시도하여 React Router가 처리하도록 유도
            if (!finalPathname.endsWith('.html')) {
                 filePath = path.join(CLIENT_DIR, 'index.html');
                 fs.readFile(filePath, (err2, data2) => {
                     if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('File Not Found (And index.html failed)');
                        return;
                     }
                     res.writeHead(200, { 'Content-Type': 'text/html' });
                     res.end(data2);
                 });
                 return;
            }
            
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File Not Found');
            return;
        }

        let contentType = 'text/html';
        if (filePath.endsWith('.css')) contentType = 'text/css';
        else if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) contentType = 'application/javascript';
        else if (filePath.endsWith('.png')) contentType = 'image/png';
        else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (filePath.endsWith('.ico')) contentType = 'image/x-icon';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`🚀 Node.js 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
    console.log(`📢 React 앱은 http://localhost:5173 에서 접속해야 합니다.`);
});