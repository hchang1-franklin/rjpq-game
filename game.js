/**
 * 多人樓層數字選擇遊戲 - game.js
 *
 * Firebase Realtime Database 結構：
 * rooms/{roomId}/
 *   players/{playerId}/
 *     nickname: string
 *     color: string
 *     selections/{floor}: number (1-4) | null
 *   lastReset: number (timestamp)
 */

/* =====================================================
   Firebase 設定
   請將下方 firebaseConfig 替換為您自己的 Firebase 專案設定
   ===================================================== */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/* =====================================================
   常數
   ===================================================== */
const MAX_PLAYERS = 4;
const FLOORS = 10;
const COLORS = ["#FF7575", "#FF79BC", "#97CBFF", "#FFC78E"];

/* =====================================================
   應用程式狀態
   ===================================================== */
let db = null;           // Firebase Database 實例
let roomRef = null;      // 當前房間的 Firebase 參考
let playersRef = null;   // players 節點的 Firebase 參考
let currentPlayerId = null;
let currentRoomId = null;
let myColor = COLORS[0]; // 預設顏色
let myNickname = "";

// 本地快取的玩家資料 { playerId: { nickname, color, selections: {1:n, 2:n, ...} } }
let playersCache = {};

// 對話框的 resolve 函數（Promise-based 對話框）
let dialogResolve = null;

/* =====================================================
   Firebase 初始化
   ===================================================== */

/** 偵測 firebaseConfig 是否仍為預設佔位值 */
function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey !== "YOUR_API_KEY" &&
    firebaseConfig.databaseURL !== "YOUR_DATABASE_URL" &&
    !!firebaseConfig.databaseURL
  );
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase 尚未設定，請參閱 README.md。");
    return false;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    return true;
  } catch (e) {
    console.error("Firebase 初始化失敗：", e);
    return false;
  }
}

/* =====================================================
   工具函數
   ===================================================== */

/** 產生 7 位數字的房間號碼 */
function generateRoomId() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

/** 產生唯一 playerId（瀏覽器 session 內唯一） */
function generatePlayerId() {
  return "p_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

/** 顯示錯誤訊息（登入畫面） */
function showError(msg) {
  const el = document.getElementById("login-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

/** 隱藏錯誤訊息 */
function hideError() {
  document.getElementById("login-error").classList.add("hidden");
}

/** Promise-based 確認對話框 */
function showDialog(msg) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    document.getElementById("dialog-msg").textContent = msg;
    document.getElementById("overlay").classList.remove("hidden");
  });
}

function closeDialog(result) {
  document.getElementById("overlay").classList.add("hidden");
  if (dialogResolve) {
    dialogResolve(result);
    dialogResolve = null;
  }
}

/* =====================================================
   登入 / 房間系統
   ===================================================== */

/** 建立房間：產生 7 位房間號碼並填入輸入框 */
function handleCreateRoom() {
  const id = generateRoomId();
  document.getElementById("room-id").value = id;
}

/** 進入遊戲 */
async function handleEnterGame() {
  const nickname = document.getElementById("nickname").value.trim();
  const roomId = document.getElementById("room-id").value.trim();

  hideError();

  // 驗證必填欄位
  if (!nickname) {
    showError("請輸入玩家暱稱！");
    return;
  }
  if (!roomId) {
    showError("請輸入或建立房間號碼！");
    return;
  }
  if (!/^\d{7}$/.test(roomId)) {
    showError("房間號碼必須為 7 位數字！");
    return;
  }

  // 檢查 Firebase 是否已設定
  if (!db) {
    showError("Firebase 尚未設定，請參閱 README.md 進行設定。");
    return;
  }

  // 讀取房間目前的玩家數
  const snapshot = await db.ref(`rooms/${roomId}/players`).get();
  const existingPlayers = snapshot.exists() ? Object.keys(snapshot.val()) : [];

  if (existingPlayers.length >= MAX_PLAYERS) {
    showError("超出人數限制");
    return;
  }

  // 設定目前玩家
  myNickname = nickname;
  currentRoomId = roomId;
  currentPlayerId = generatePlayerId();

  // 寫入玩家資料
  const playerRef = db.ref(`rooms/${roomId}/players/${currentPlayerId}`);
  await playerRef.set({
    nickname: myNickname,
    color: myColor,
    selections: {}
  });

  // 離開頁面時移除玩家
  window.addEventListener("beforeunload", handleLeaveRoom);

  // 進入遊戲畫面
  enterGameScreen();
}

/** 離開房間：移除自己的資料 */
function handleLeaveRoom() {
  if (roomRef && currentPlayerId) {
    db.ref(`rooms/${currentRoomId}/players/${currentPlayerId}`).remove();
  }
}

/* =====================================================
   進入遊戲畫面
   ===================================================== */
function enterGameScreen() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");
  document.getElementById("display-room-id").textContent = currentRoomId;

  // 設定 Firebase 參考
  roomRef = db.ref(`rooms/${currentRoomId}`);
  playersRef = db.ref(`rooms/${currentRoomId}/players`);

  // 渲染樓層格
  renderFloorGrid();

  // 設定顏色選擇的初始高亮
  document.querySelectorAll(".swatch").forEach(s => {
    s.classList.toggle("active", s.dataset.color === myColor);
  });

  // 監聽所有玩家變化（即時同步）
  playersRef.on("value", snapshot => {
    playersCache = snapshot.exists() ? snapshot.val() : {};
    renderPlayerList();
    renderFloorGrid(); // 更新方框顏色
  });

  // 監聽重設事件
  db.ref(`rooms/${currentRoomId}/lastReset`).on("value", snapshot => {
    if (snapshot.exists()) {
      renderPlayerList();
      renderFloorGrid();
    }
  });
}

/* =====================================================
   渲染玩家列表
   ===================================================== */
function renderPlayerList() {
  const container = document.getElementById("player-list");
  container.innerHTML = "";

  Object.entries(playersCache).forEach(([pid, player]) => {
    const isMe = pid === currentPlayerId;
    const color = player.color || "#ddd";
    const selections = player.selections || {};

    const row = document.createElement("div");
    row.className = "player-row";
    if (isMe) row.style.fontStyle = "italic";

    // 暱稱
    const nameEl = document.createElement("div");
    nameEl.className = "player-name";
    nameEl.title = player.nickname;
    nameEl.textContent = player.nickname + (isMe ? " (我)" : "");

    // 顏色圓點
    const dotWrap = document.createElement("div");
    dotWrap.className = "player-color-dot";
    const dot = document.createElement("div");
    dot.className = "color-dot";
    dot.style.background = color;
    dot.style.borderColor = color;
    dotWrap.appendChild(dot);

    // 樓層數字：10F → 6F, 空白, 5F → 1F（由上到下）
    const floorValues = document.createElement("div");
    floorValues.className = "player-floor-values";
    floorValues.style.setProperty("--player-color", color);

    for (let f = FLOORS; f >= 1; f--) {
      // 在第 5F 到 6F 之間插入間隔
      if (f === 5) {
        const gap = document.createElement("div");
        gap.className = "player-floor-gap";
        floorValues.appendChild(gap);
      }

      const cell = document.createElement("div");
      cell.className = "player-floor-cell";
      const val = selections[f];
      if (val !== undefined && val !== null) {
        cell.textContent = val;
        cell.classList.add("has-value");
        cell.style.background = color;
      }
      floorValues.appendChild(cell);
    }

    row.appendChild(nameEl);
    row.appendChild(dotWrap);
    row.appendChild(floorValues);
    container.appendChild(row);
  });
}

/* =====================================================
   渲染樓層格（從 10F 到 1F，由上到下）
   ===================================================== */
function renderFloorGrid() {
  const grid = document.getElementById("floor-grid");
  grid.innerHTML = "";

  for (let f = FLOORS; f >= 1; f--) {
    // 在第 5F 到 6F 之間插入空白行
    if (f === 5) {
      const gapRow = document.createElement("div");
      gapRow.className = "floor-gap-row";
      grid.appendChild(gapRow);
    }

    const row = document.createElement("div");
    row.className = "floor-row";

    // 樓層標籤
    const label = document.createElement("div");
    label.className = "floor-label";
    label.textContent = `${f}F`;
    row.appendChild(label);

    // 4 個數字方框
    const cells = document.createElement("div");
    cells.className = "floor-cells";

    for (let num = 1; num <= 4; num++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = num;
      cell.dataset.floor = f;
      cell.dataset.num = num;

      // 查找目前選擇此方框的玩家
      const ownerEntry = findCellOwner(f, num);
      if (ownerEntry) {
        cell.classList.add("selected");
        cell.style.background = ownerEntry.color;
        cell.style.borderColor = ownerEntry.color;
        cell.title = `${ownerEntry.nickname} 選擇`;
      } else {
        cell.style.background = "";
        cell.style.borderColor = "";
        cell.title = "";
      }

      cell.addEventListener("click", () => handleCellClick(f, num));
      cells.appendChild(cell);
    }

    row.appendChild(cells);
    grid.appendChild(row);
  }
}

/** 找到選擇特定方框的玩家 */
function findCellOwner(floor, num) {
  for (const [pid, player] of Object.entries(playersCache)) {
    const selections = player.selections || {};
    if (selections[floor] === num) {
      return { pid, nickname: player.nickname, color: player.color };
    }
  }
  return null;
}

/* =====================================================
   方框點擊邏輯
   ===================================================== */
async function handleCellClick(floor, num) {
  if (!currentPlayerId) return;

  const owner = findCellOwner(floor, num);

  if (owner) {
    if (owner.pid === currentPlayerId) {
      // 點擊自己已選的，取消選擇
      await db.ref(`rooms/${currentRoomId}/players/${currentPlayerId}/selections/${floor}`).remove();
      return;
    }
    // 已被其他人選擇 → 詢問覆蓋
    const confirm = await showDialog("是否確定要覆蓋？");
    if (!confirm) return;
  }

  // 寫入選擇（同一層只能選一個：先清除同層的其他選擇再寫入新的）
  const mySelRef = db.ref(`rooms/${currentRoomId}/players/${currentPlayerId}/selections/${floor}`);
  await mySelRef.set(num);
}

/* =====================================================
   顏色選擇
   ===================================================== */
async function handleColorSelect(color) {
  myColor = color;

  // 更新 Firebase
  if (currentPlayerId) {
    await db.ref(`rooms/${currentRoomId}/players/${currentPlayerId}/color`).set(color);
  }

  // 更新高亮
  document.querySelectorAll(".swatch").forEach(s => {
    s.classList.toggle("active", s.dataset.color === color);
  });
}

/* =====================================================
   重設按鈕
   ===================================================== */
async function handleReset() {
  const confirm = await showDialog("是否要清除所有選擇？");
  if (!confirm) return;

  // 清除所有玩家的 selections
  const updates = {};
  Object.keys(playersCache).forEach(pid => {
    updates[`rooms/${currentRoomId}/players/${pid}/selections`] = {};
  });
  updates[`rooms/${currentRoomId}/lastReset`] = Date.now();
  await db.ref().update(updates);
}

/* =====================================================
   DOM 初始化
   ===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Firebase 初始化；若尚未設定則顯示提示
  if (!initFirebase()) {
    showError("⚠️ Firebase 尚未設定，請先完成 README.md 中的設定步驟後再使用。");
  }

  // 登入頁按鈕
  document.getElementById("btn-create-room").addEventListener("click", handleCreateRoom);
  document.getElementById("btn-enter").addEventListener("click", handleEnterGame);

  // 房間號碼輸入限制（只允許數字）
  document.getElementById("room-id").addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 7);
  });

  // 顏色色塊
  document.querySelectorAll(".swatch").forEach(swatch => {
    swatch.addEventListener("click", () => handleColorSelect(swatch.dataset.color));
  });

  // 重設按鈕
  document.getElementById("btn-reset").addEventListener("click", handleReset);

  // 對話框按鈕
  document.getElementById("dialog-yes").addEventListener("click", () => closeDialog(true));
  document.getElementById("dialog-no").addEventListener("click", () => closeDialog(false));
});
