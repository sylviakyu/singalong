# 韓文跟唱練習室 MVP v1

依 [korean-singalong-spec.md](korean-singalong-spec.md) 實作的個人本機網站。React／TypeScript／Vite／React Router 搭配 FastAPI／Pydantic／SQLAlchemy／Alembic／SQLite。介面使用繁體中文，不需要登入，也不需要 YouTube API key。

包含歌曲分頁、歌曲及歌詞管理、YouTube 跟唱、逐句播放、記錄播放器時間、未儲存離開提醒。資料庫預設為空；影片與韓文、中文、羅馬拼音由使用者自行提供。

## Docker Compose 啟動（建議）

安裝並啟動 Docker Desktop，於專案根目錄執行：

```sh
docker compose up --build -d
```

開啟 **http://localhost:5173**，由「管理歌曲」新增第一首歌曲。API 文件在 http://localhost:8000/docs。

容器啟動時自動執行 `alembic upgrade head`，後端通過健康檢查後啟動前端。前端映像建置時執行測試與 TypeScript 檢查，並以 Nginx 提供正式 build，轉送 `/api` 至後端，並支援重新整理任何 React Router 路徑。主機連接埠只綁定 `127.0.0.1`；容器內部監聽 `0.0.0.0`。

```sh
docker compose logs -f
docker compose down
```

SQLite 以 bind mount 保存在主機的 `backend/data/app.db`，停止或重建容器不會清除歌曲。修改程式後重新執行 `docker compose up --build -d`。調整連接埠時修改 `compose.yaml` 的主機端數字；例如 `127.0.0.1:5174:80`。維持 `127.0.0.1` 以符合個人本機使用範圍。

## 本機開發

使用 Python 3.13、Node.js 22.12 以上與 npm（Compose 已提供這些環境）。

後端，在專案根目錄：

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
.venv/bin/alembic upgrade head
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

另一個終端機，在專案根目錄：

```sh
cd frontend
npm ci
npm run dev
```

開啟 http://localhost:5173。Vite 的 `/api` proxy 預設連至 `http://127.0.0.1:8000`。修改後端連接埠時，可用 `API_TARGET=http://127.0.0.1:8001 npm run dev`；修改前端連接埠可用 `npm run dev -- --port 5174`。後端可透過 `DATABASE_URL=sqlite:////absolute/path/app.db` 指定資料庫（先建立父目錄），migration 與服務必須使用同一設定。不使用 `file://` 開啟網頁。

`frontend/package-lock.json` 與 `backend/requirements.txt` 鎖定實際安裝版本；`backend/requirements.in` 記錄直接依賴範圍。

## 使用方式

1. 管理頁新增歌名、歌手、YouTube 網址或 11 字元 ID，按「載入影片」。支援 watch、youtu.be、embed、shorts。
2. 新增歌詞列，輸入非負開始秒數與較大的結束秒數，或透過播放器「記錄目前時間」。時間保留到小數點後兩位。
3. 輸入韓文；中文與羅馬拼音可留白。使用上移／下移調整列順序；開始秒數需按列順序遞增或相同，允許重疊。
4. 「試播這句」使用未儲存內容；一次儲存歌曲與全部歌詞，空歌詞陣列可儲存。
5. 跟唱頁按「播放這句」從該句開始，至結束時間暫停；「整首播放」從 0 秒開始。每句的暫停按鈕皆操作同一播放器。

取得片長後，超出片長的時間無法儲存或試播。YouTube 有時需先播放才會回報片長；未知片長時僅驗證起訖時間，不呼叫外部 YouTube Data API。改用另一支影片後，必須載入該影片才能使用記錄時間／試播。

## 測試與建置

```sh
cd backend
.venv/bin/python -m pytest -q
```

```sh
cd frontend
npm test
npm run build
```

後端測試使用隔離的記憶體資料庫，不會修改個人歌曲，涵蓋分頁、欄位驗證、歌詞完整取代、允許重疊、交易失敗回滾與資料庫級聯刪除。前端測試涵蓋網址解析、播放器 seek 與狀態、快速切句、整首播放、暫停、外部 seek、清理，以及管理頁輸入、儲存、離開提醒與頁碼修正。`npm run build` 先執行 TypeScript 檢查再產生正式檔案。

## 資料備份

停止後端後複製 SQLite 檔，避免複製寫入中的資料庫：

```sh
docker compose stop backend
cp backend/data/app.db /tmp/korean-singalong-backup.db
docker compose start backend
```

將備份移至自己的保存位置。本機開發則先停止 Uvicorn 再複製。還原時同樣先停止後端，以備份取代 `backend/data/app.db` 再啟動。不要把 `.db`、環境或依賴目錄加入 git。

## 播放器限制與人工驗收

依 [YouTube IFrame Player API 官方文件](https://developers.google.com/youtube/iframe_api_reference) 整合，使用頁面 origin、保留 HTTP Referer、原生控制與品牌。API script 只載入一次；每個頁面只使用一個播放器；卸載時清除監測器並 destroy。

單句播放以每 100 ms 讀取影片時間，等待 seek 後進入播放狀態才判斷終點；手動暫停、影片結束、切換、卸載與錯誤清除工作。原生控制造成時間跳躍時取消單句模式。未點擊不自動播放；若瀏覽器阻擋播放，會提示直接點播放器。

真實 YouTube 嵌入與播放精度尚需人工驗收。請使用自己提供、允許嵌入的影片，檢查單句起點與約 0.5 秒內結束、快速切句、整首播放、緩衝、原生暫停與拖曳、時間記錄以及離開頁面。Mock 測試不能證明影片實際可播。

YouTube 需要網路；影片可能下架、私人化、禁止嵌入或需要額外驗證。錯誤時提供代碼與 YouTube 開啟連結（包含 153 播放器識別／Referer 問題），不繞過限制。網路緩衝、seek、廣告、背景分頁節流可能影響單句精度，不保證毫秒或逐音節同步。播放器載入失敗時重新整理可重試。

## 本次驗證結果

- 後端 16 項測試通過；初始 migration 已實際執行。
- 前端 14 項測試通過；TypeScript 與正式 build 通過。
- Docker Compose 已實際建置並啟動，後端健康檢查、Nginx API 代理及深層頁面回應正常；安裝時 npm audit 回報 0 個已知漏洞。
- 真實 YouTube 播放、瀏覽器重新整理／關閉提醒與前景單句播放精度仍需人工確認。
