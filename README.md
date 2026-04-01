# 多人樓層數字選擇遊戲

一個基於 Firebase Realtime Database 的多人即時互動遊戲，玩家通過房間號碼進入遊戲，最多 4 人同時遊玩，選擇十層樓的數字。

## 功能特色

- 🏠 **房間系統**：輸入或自動生成 7 位數字房間號碼
- 👥 **多人遊玩**：最多 4 位玩家同時進行
- 🎨 **顏色選擇**：每位玩家可選擇代表顏色
- 🏢 **樓層選擇**：10 層樓 × 4 個數字的互動方格
- ⚡ **即時同步**：所有操作即時同步給房間內所有玩家
- 🔄 **覆蓋確認**：點擊已選格時彈出確認對話框
- 🧹 **重設功能**：清除所有玩家的選擇

## 如何運行

### 1. 設定 Firebase

1. 前往 [Firebase Console](https://console.firebase.google.com/)
2. 建立新專案（或使用現有專案）
3. 前往 **Realtime Database** → 建立資料庫
   - 選擇地區（建議選擇離台灣最近的 `asia-southeast1`）
   - 規則設定先選「測試模式」（後續可依需求調整）
4. 前往 **專案設定** → **一般** → 滑到底部 **「您的應用程式」**
5. 點擊「網頁」圖示（`</>`），新增網頁應用程式
6. 複製 `firebaseConfig` 物件內容

### 2. 更新設定檔

開啟 `game.js`，將頂部的 `firebaseConfig` 替換為您自己的設定：

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",   // 必填，格式：https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. 設定 Realtime Database 規則（建議）

在 Firebase Console 的 Realtime Database → 規則，將規則改為：

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

### 4. 開啟遊戲

直接用瀏覽器開啟 `index.html` 即可（支援從本機 `file://` 開啟）。

或使用任意靜態伺服器：

```bash
# 使用 Python
python3 -m http.server 8080

# 使用 Node.js（需安裝 serve）
npx serve .
```

然後在瀏覽器開啟 `http://localhost:8080`

## 遊玩方式

1. 輸入**玩家暱稱**（必填）
2. 輸入 7 位**房間號碼**，或點擊「建立房間」自動生成
3. 點擊「**進入遊戲**」
4. 選擇自己的**代表顏色**
5. 在樓層方格中點擊數字進行選擇
   - 點擊已選的自己的格：**取消選擇**
   - 點擊被其他玩家選的格：**彈出覆蓋確認**
6. 點擊「**重設**」清除所有選擇

## 專案結構

```
rjpq-game/
├── index.html   # 主頁面（登入畫面 + 遊戲畫面）
├── style.css    # 樣式表
├── game.js      # 遊戲邏輯 + Firebase 整合
└── README.md    # 說明文件
```

## Firebase 資料結構

```
rooms/
  {roomId}/
    players/
      {playerId}/
        nickname: string
        color: string
        selections/
          {floor}: number (1-4)
    lastReset: number (timestamp)
```
