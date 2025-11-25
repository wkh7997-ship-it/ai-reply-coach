// server.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// 1) 현재 폴더 전체를 정적 파일로 제공
//    => index.html, manifest.json, icon-192/512.png 전부 여기서 서빙됨
app.use(express.static(__dirname));

// 2) 루트(/)로 들어오면 index.html 반환
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 3) 서버 시작
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
