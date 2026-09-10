var wsCanvas = document.getElementById("wordscapesCanvas");
var wsCtx = wsCanvas.getContext("2d");
var WS_W = 560;
var WS_H = 660;
wsCanvas.width = WS_W;
wsCanvas.height = WS_H;

var WS_LEVEL_KEY = "wordscapesLevel";
var WS_SCORE_KEY = "wordscapesScore";
var WS_HIGH_KEY = "wordscapesHighScore";
var WS_COIN_KEY = "wordscapesCoins";
var WS_START_COIN_FLAG = "wordscapesStartCoins";
var WS_STARTING_COINS = 100;
var WS_PROGRESS_KEY = "wordscapesProgress";
var WS_BOARD_PTS = 5;
var WS_BONUS_PTS = 2;
var WS_HINT_COST = 25;
var WS_WORD_COST = 500;
var wsScreen = "play";
var wsLevelIndex = 0;
var wsLevel = null;
var wsFound = {};
var wsBonus = {};
var wsBonusList = [];
var wsScore = 0;
var wsLevelScore = 0;
var wsHighScore = 0;
var wsCoins = WS_STARTING_COINS;
var wsCoinsCollected = {};
var wsCoinWord = "";
var wsTiles = [];
var wsPath = [];
var wsDragging = false;
var wsMessage = "";
var wsMessageUntil = 0;
var wsHinted = {};
var wsHoverBtn = "";
var wsValidSet = null;
var wsDictCache = null;

function wsLevels() {
  return (typeof WORDSCAPES_LEVELS !== "undefined" && WORDSCAPES_LEVELS.length) ? WORDSCAPES_LEVELS : [{
    tiles: ["g", "a", "m", "e", "s"],
    words: [
      { word: "games", x: 0, y: 1, dir: "H" },
      { word: "game", x: 0, y: 1, dir: "V" },
      { word: "same", x: 3, y: 0, dir: "V" },
      { word: "age", x: 1, y: 1, dir: "V" }
    ]
  }];
}

function wsBuildDict() {
  if (wsDictCache) return wsDictCache;
  var set = {};
  function addList(list) {
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      var w = list[i];
      if (w && w.length >= 3 && w.length <= 7) set[w] = true;
    }
  }
  if (typeof TYPE_WORD_LISTS !== "undefined") {
    addList(TYPE_WORD_LISTS.easy);
    addList(TYPE_WORD_LISTS.medium);
    addList(TYPE_WORD_LISTS.hard);
    addList(TYPE_WORD_LISTS.long);
  }
  if (typeof WORDLE_ANSWERS !== "undefined") {
    for (var n = 3; n <= 7; n++) {
      addList(WORDLE_ANSWERS[String(n)]);
      addList(WORDLE_ANSWERS[n]);
    }
  }
  var levels = wsLevels();
  for (var L = 0; L < levels.length; L++) {
    var words = levels[L].words || [];
    for (var j = 0; j < words.length; j++) set[words[j].word] = true;
  }
  wsDictCache = set;
  return set;
}

function wsCanSpell(word, tiles) {
  var bag = tiles.slice();
  for (var i = 0; i < word.length; i++) {
    var idx = bag.indexOf(word[i]);
    if (idx < 0) return false;
    bag.splice(idx, 1);
  }
  return true;
}

function loadWsLevelIndex() {
  try {
    var n = parseInt(localStorage.getItem(WS_LEVEL_KEY), 10);
    if (!isNaN(n) && n >= 0) wsLevelIndex = n % wsLevels().length;
  } catch (e) {}
}

function saveWsLevelIndex() {
  try {
    localStorage.setItem(WS_LEVEL_KEY, String(wsLevelIndex));
  } catch (e) {}
}

function loadWsScores() {
  try {
    var s = parseInt(localStorage.getItem(WS_SCORE_KEY), 10);
    var h = parseInt(localStorage.getItem(WS_HIGH_KEY), 10);
    if (!isNaN(s) && s > 0) wsScore = s;
    if (!isNaN(h) && h > 0) wsHighScore = h;
  } catch (e) {}
}

function saveWsScores() {
  if (wsScore > wsHighScore) wsHighScore = wsScore;
  try {
    localStorage.setItem(WS_SCORE_KEY, String(wsScore));
    localStorage.setItem(WS_HIGH_KEY, String(wsHighScore));
    localStorage.setItem(WS_COIN_KEY, String(wsCoins));
  } catch (e) {}
}

function loadWsCoins() {
  try {
    var n = parseInt(localStorage.getItem(WS_COIN_KEY), 10);
    if (!isNaN(n) && n >= 0) wsCoins = n;
    if (!localStorage.getItem(WS_START_COIN_FLAG)) {
      if (wsCoins < WS_STARTING_COINS) wsCoins = WS_STARTING_COINS;
      localStorage.setItem(WS_START_COIN_FLAG, "1");
      localStorage.setItem(WS_COIN_KEY, String(wsCoins));
    }
  } catch (e) {
    wsCoins = WS_STARTING_COINS;
  }
}

function addWsCoins(amount) {
  wsCoins += amount;
  saveWsScores();
}

function spendWsCoins(amount) {
  if (wsCoins < amount) return false;
  wsCoins -= amount;
  saveWsScores();
  return true;
}

function addWsPoints(amount) {
  wsScore += amount;
  wsLevelScore += amount;
  saveWsScores();
  saveWsProgress();
}

function saveWsProgress() {
  try {
    localStorage.setItem(WS_PROGRESS_KEY, JSON.stringify({
      level: wsLevelIndex,
      found: Object.keys(wsFound),
      bonus: wsBonusList.slice(),
      levelScore: wsLevelScore,
      collectedCoins: Object.keys(wsCoinsCollected),
      hinted: Object.keys(wsHinted),
      screen: wsScreen,
      tiles: wsTiles.slice()
    }));
  } catch (e) {}
  saveWsLevelIndex();
}

function loadWsProgress() {
  try {
    var raw = localStorage.getItem(WS_PROGRESS_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (e) {
    return null;
  }
}

function applyWsProgress(data) {
  if (!data || data.level !== wsLevelIndex) return false;
  wsFound = {};
  var found = data.found || [];
  for (var i = 0; i < found.length; i++) wsFound[found[i]] = true;
  wsBonusList = data.bonus ? data.bonus.slice() : [];
  wsBonus = {};
  for (var b = 0; b < wsBonusList.length; b++) wsBonus[wsBonusList[b]] = true;
  wsLevelScore = parseInt(data.levelScore, 10) || 0;
  wsCoinsCollected = {};
  var collected = data.collectedCoins || [];
  for (var c = 0; c < collected.length; c++) wsCoinsCollected[collected[c]] = true;
  if (data.coinAwarded && !collected.length) {
    var oldKeys = wsCoinCellKeys();
    for (var oldKey in oldKeys) {
      if (oldKeys.hasOwnProperty(oldKey)) wsCoinsCollected[oldKey] = true;
    }
  }
  wsHinted = {};
  var hinted = data.hinted || [];
  for (var h = 0; h < hinted.length; h++) wsHinted[hinted[h]] = true;
  collectWsCoinCells();
  if (data.tiles && data.tiles.length === (wsLevel.tiles || []).length) {
    wsTiles = data.tiles.slice();
  }
  var board = wsBoardWords();
  if (board.length && board.every(function (w) { return wsFound[w]; })) {
    wsScreen = "clear";
  } else {
    wsScreen = data.screen === "clear" ? "clear" : "play";
  }
  return true;
}

function wsBoardWords() {
  return (wsLevel && wsLevel.words) ? wsLevel.words.map(function (item) { return item.word; }) : [];
}

function wsHardestWord() {
  var words = wsBoardWords();
  var best = "";
  for (var i = 0; i < words.length; i++) {
    if (words[i].length > best.length) best = words[i];
  }
  return best;
}

function wsCoinCellKeys() {
  var keys = {};
  if (!wsLevel || !wsCoinWord) return keys;
  var words = wsLevel.words;
  for (var i = 0; i < words.length; i++) {
    if (words[i].word !== wsCoinWord) continue;
    var dx = words[i].dir === "H" ? 1 : 0;
    var dy = words[i].dir === "V" ? 1 : 0;
    for (var k = 0; k < words[i].word.length; k++) {
      keys[(words[i].x + k * dx) + "," + (words[i].y + k * dy)] = true;
    }
  }
  return keys;
}

function wsGridBounds() {
  var maxX = 0;
  var maxY = 0;
  var words = wsLevel.words;
  for (var i = 0; i < words.length; i++) {
    var item = words[i];
    var lastX = item.x + (item.dir === "H" ? item.word.length - 1 : 0);
    var lastY = item.y + (item.dir === "V" ? item.word.length - 1 : 0);
    if (lastX > maxX) maxX = lastX;
    if (lastY > maxY) maxY = lastY;
  }
  return { cols: maxX + 1, rows: maxY + 1 };
}

function wsBonusBox() {
  return { x: WS_W - 148, y: 78, w: 132, h: 228 };
}

function wsGridMetrics() {
  var b = wsGridBounds();
  var top = 72;
  var bottom = 318;
  var pad = 12;
  var bonus = wsBonusBox();
  var gap = 3;
  var areaW = bonus.x - pad - 10;
  var tile = Math.min(
    40,
    Math.floor((areaW - gap * (b.cols - 1)) / b.cols),
    Math.floor((bottom - top - gap * (b.rows - 1)) / b.rows)
  );
  var gridW = b.cols * tile + (b.cols - 1) * gap;
  var gridH = b.rows * tile + (b.rows - 1) * gap;
  return {
    tile: tile,
    gap: gap,
    left: pad + Math.floor((areaW - gridW) / 2),
    top: top + Math.floor((bottom - top - gridH) / 2),
    cols: b.cols,
    rows: b.rows
  };
}

function wsCellMap() {
  var map = {};
  var words = wsLevel.words;
  for (var i = 0; i < words.length; i++) {
    var item = words[i];
    var dx = item.dir === "H" ? 1 : 0;
    var dy = item.dir === "V" ? 1 : 0;
    for (var k = 0; k < item.word.length; k++) {
      var key = (item.x + k * dx) + "," + (item.y + k * dy);
      if (!map[key]) map[key] = { letter: item.word[k], words: [] };
      map[key].words.push(item.word);
    }
  }
  return map;
}

function wsWheelLayout() {
  var n = wsTiles.length;
  var cx = WS_W / 2;
  var cy = 500;
  var radius = n >= 7 ? 88 : 82;
  var tileR = n >= 7 ? 24 : 27;
  var out = [];
  for (var i = 0; i < n; i++) {
    var ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    out.push({
      x: cx + Math.cos(ang) * radius,
      y: cy + Math.sin(ang) * radius,
      r: tileR
    });
  }
  return out;
}

function wsButtons() {
  return [
    { id: "shuffle", label: "SHUFFLE", sub: "free", x: 16, y: 604, w: 168, h: 44 },
    { id: "hint", label: "HINT", sub: WS_HINT_COST + " coins", x: 196, y: 604, w: 168, h: 44 },
    { id: "word", label: "WORD", sub: WS_WORD_COST + " coins", x: 376, y: 604, w: 168, h: 44 }
  ];
}

function resetWordscapesGame() {
  loadWsLevelIndex();
  loadWsScores();
  loadWsCoins();
  startWordscapesLevel(wsLevelIndex, true);
}

function startWordscapesLevel(index, keepProgress) {
  var levels = wsLevels();
  wsLevelIndex = ((index % levels.length) + levels.length) % levels.length;
  wsLevel = levels[wsLevelIndex];
  wsFound = {};
  wsBonus = {};
  wsBonusList = [];
  wsLevelScore = 0;
  wsCoinsCollected = {};
  wsCoinWord = wsHardestWord();
  wsTiles = wsLevel.tiles.slice();
  wsPath = [];
  wsDragging = false;
  wsMessage = "";
  wsHinted = {};
  wsScreen = "play";
  wsValidSet = null;
  if (keepProgress && applyWsProgress(loadWsProgress())) {
    saveWsProgress();
    return;
  }
  saveWsProgress();
}

function wsValidWords() {
  if (wsValidSet) return wsValidSet;
  var dict = wsBuildDict();
  var set = {};
  for (var word in dict) {
    if (dict.hasOwnProperty(word) && wsCanSpell(word, wsLevel.tiles)) set[word] = true;
  }
  var board = wsBoardWords();
  for (var i = 0; i < board.length; i++) set[board[i]] = true;
  wsValidSet = set;
  return set;
}

function wsCurrentWord() {
  var word = "";
  for (var i = 0; i < wsPath.length; i++) word += wsTiles[wsPath[i]];
  return word;
}

function showWsMessage(text) {
  wsMessage = text;
  wsMessageUntil = performance.now() + 1300;
}

function wsCellIsShown(key, map) {
  if (wsHinted[key]) return true;
  var cell = (map || wsCellMap())[key];
  if (!cell) return false;
  return cell.words.some(function (w) { return wsFound[w]; });
}

function collectWsCoinCells() {
  var map = wsCellMap();
  var coinKeys = wsCoinCellKeys();
  var gained = 0;
  for (var key in coinKeys) {
    if (!coinKeys.hasOwnProperty(key) || wsCoinsCollected[key]) continue;
    if (!wsCellIsShown(key, map)) continue;
    wsCoinsCollected[key] = true;
    gained += 1;
  }
  if (gained) addWsCoins(gained);
  return gained;
}

function submitWsWord(word) {
  if (!word || word.length < 3) {
    if (word.length > 0 && word.length < 3) showWsMessage("Too short");
    return;
  }
  var board = wsBoardWords();
  if (wsFound[word]) {
    showWsMessage("Already found");
    return;
  }
  if (wsBonus[word]) {
    showWsMessage("Already found");
    return;
  }
  if (board.indexOf(word) !== -1) {
    wsFound[word] = true;
    var boardPts = word.length * WS_BOARD_PTS;
    addWsPoints(boardPts);
    var coins = collectWsCoinCells();
    showWsMessage(word.toUpperCase() + "  +" + boardPts + (coins ? ("   +" + coins + " coin" + (coins === 1 ? "" : "s")) : ""));
    if (board.every(function (w) { return wsFound[w]; })) {
      wsScreen = "clear";
    }
    saveWsProgress();
    return;
  }
  if (wsValidWords()[word]) {
    wsBonus[word] = true;
    wsBonusList.push(word);
    var bonusPts = word.length * WS_BONUS_PTS;
    addWsPoints(bonusPts);
    showWsMessage("BONUS  " + word.toUpperCase() + "  +" + bonusPts);
    saveWsProgress();
    return;
  }
  showWsMessage("Not a word");
}

function shuffleWsTiles() {
  for (var i = wsTiles.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = wsTiles[i];
    wsTiles[i] = wsTiles[j];
    wsTiles[j] = t;
  }
  saveWsProgress();
}

function hintWsCell() {
  var map = wsCellMap();
  var hidden = [];
  for (var key in map) {
    if (!map.hasOwnProperty(key)) continue;
    if (wsHinted[key]) continue;
    var shown = map[key].words.some(function (w) { return wsFound[w]; });
    if (!shown) hidden.push(key);
  }
  if (!hidden.length) {
    showWsMessage("Nothing to hint");
    return false;
  }
  if (!spendWsCoins(WS_HINT_COST)) {
    showWsMessage("Need " + WS_HINT_COST + " coins for a hint");
    return false;
  }
  wsHinted[hidden[Math.floor(Math.random() * hidden.length)]] = true;
  var coins = collectWsCoinCells();
  showWsMessage("Hint  -" + WS_HINT_COST + " coins" + (coins ? ("   +" + coins + " coin" + (coins === 1 ? "" : "s")) : ""));
  saveWsProgress();
  return true;
}

function revealWsWord() {
  var board = wsBoardWords();
  var hidden = board.filter(function (w) { return !wsFound[w]; });
  if (!hidden.length) {
    showWsMessage("All words are found");
    return false;
  }
  if (!spendWsCoins(WS_WORD_COST)) {
    showWsMessage("Need " + WS_WORD_COST + " coins for a word");
    return false;
  }
  var word = hidden[Math.floor(Math.random() * hidden.length)];
  wsFound[word] = true;
  var boardPts = word.length * WS_BOARD_PTS;
  addWsPoints(boardPts);
  var coins = collectWsCoinCells();
  showWsMessage(word.toUpperCase() + " revealed  -" + WS_WORD_COST + " coins" + (coins ? ("   +" + coins + " coin" + (coins === 1 ? "" : "s")) : ""));
  if (board.every(function (w) { return wsFound[w]; })) {
    wsScreen = "clear";
  }
  saveWsProgress();
  return true;
}

function wsCanvasPos(event) {
  var rect = wsCanvas.getBoundingClientRect();
  var src = event;
  if (event.touches && event.touches[0]) src = event.touches[0];
  else if (event.changedTouches && event.changedTouches[0]) src = event.changedTouches[0];
  return {
    x: (src.clientX - rect.left) * (WS_W / rect.width),
    y: (src.clientY - rect.top) * (WS_H / rect.height)
  };
}

function wsTileAt(pos, allowUsed) {
  var layout = wsWheelLayout();
  var best = -1;
  var bestD = 1e9;
  for (var i = 0; i < layout.length; i++) {
    if (!allowUsed && wsPath.indexOf(i) !== -1) continue;
    var dx = pos.x - layout[i].x;
    var dy = pos.y - layout[i].y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d <= layout[i].r + 6 && d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

function wsBtnAt(pos) {
  var buttons = wsButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) return b.id;
  }
  return "";
}

function handleWsKey(key) {
  if (wsScreen === "clear") {
    if (key === "enter" || key === " " || key === "space") {
      startWordscapesLevel(wsLevelIndex + 1);
    }
    return;
  }
  if (key === "enter") {
    submitWsWord(wsCurrentWord());
    wsPath = [];
    return;
  }
  if (key === "backspace") {
    wsPath.pop();
    return;
  }
  if (key === "s") {
    shuffleWsTiles();
    return;
  }
  if (key === "h") {
    hintWsCell();
    return;
  }
  if (key === "w") {
    revealWsWord();
    return;
  }
  if (key.length === 1 && key >= "a" && key <= "z") {
    for (var i = 0; i < wsTiles.length; i++) {
      if (wsTiles[i] === key && wsPath.indexOf(i) === -1) {
        wsPath.push(i);
        return;
      }
    }
  }
}

function drawWsCell(ctx, x, y, size, letter, revealed, hinted, coinDot) {
  ctx.fillStyle = revealed ? "#ffffff" : (hinted ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)");
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = revealed ? "#ffffff" : "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  if (letter && (revealed || hinted)) {
    ctx.fillStyle = revealed ? "#111111" : "rgba(255,255,255,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold " + Math.floor(size * 0.55) + "px sans-serif";
    ctx.fillText(letter.toUpperCase(), x + size / 2, y + size / 2 + 1);
  }
  if (coinDot) {
    ctx.beginPath();
    ctx.arc(x + size / 2, revealed || hinted ? y + size - 7 : y + size / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe81f";
    ctx.fill();
  }
}

function drawWsGrid(ctx) {
  var g = wsGridMetrics();
  var map = wsCellMap();
  var coinKeys = wsCoinCellKeys();
  for (var key in map) {
    if (!map.hasOwnProperty(key)) continue;
    var parts = key.split(",");
    var cx = parseInt(parts[0], 10);
    var cy = parseInt(parts[1], 10);
    var revealed = map[key].words.some(function (w) { return wsFound[w]; });
    drawWsCell(
      ctx,
      g.left + cx * (g.tile + g.gap),
      g.top + cy * (g.tile + g.gap),
      g.tile,
      map[key].letter,
      revealed,
      !!wsHinted[key],
      !!coinKeys[key] && !wsCoinsCollected[key]
    );
  }
}

function drawWsWheel(ctx) {
  var layout = wsWheelLayout();
  var i;
  if (wsPath.length > 1) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(layout[wsPath[0]].x, layout[wsPath[0]].y);
    for (i = 1; i < wsPath.length; i++) {
      ctx.lineTo(layout[wsPath[i]].x, layout[wsPath[i]].y);
    }
    ctx.stroke();
  }
  for (i = 0; i < layout.length; i++) {
    var p = layout[i];
    var on = wsPath.indexOf(i) !== -1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#ffffff" : "#1c1c1c";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = on ? "#111111" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText(wsTiles[i].toUpperCase(), p.x, p.y + 1);
  }
}

function drawWsButtons(ctx) {
  var buttons = wsButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var hover = wsHoverBtn === b.id;
    var locked = (b.id === "hint" && wsCoins < WS_HINT_COST) || (b.id === "word" && wsCoins < WS_WORD_COST);
    ctx.fillStyle = locked ? "rgba(40,40,40,0.7)" : (hover ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.4)");
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = hover && !locked ? 3 : 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = locked ? "#888888" : "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 - 8);
    ctx.font = "11px sans-serif";
    ctx.fillText(b.sub, b.x + b.w / 2, b.y + b.h / 2 + 10);
  }
}

function drawWsBonusSpot(ctx) {
  var box = wsBonusBox();
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("BONUS", box.x + box.w / 2, box.y + 16);
  ctx.fillStyle = "#9a9a9a";
  ctx.font = "11px sans-serif";
  ctx.fillText(WS_BONUS_PTS + " pts per letter", box.x + box.w / 2, box.y + 32);

  var words = wsBonusList.slice().reverse();
  var y = box.y + 50;
  var max = Math.floor((box.h - 58) / 16);
  ctx.textAlign = "center";
  ctx.font = "bold 12px sans-serif";
  if (!words.length) {
    ctx.fillStyle = "#6a6a6a";
    ctx.fillText("empty", box.x + box.w / 2, y + 8);
    return;
  }
  for (var i = 0; i < words.length && i < max; i++) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(words[i].toUpperCase() + "  +" + (words[i].length * WS_BONUS_PTS), box.x + box.w / 2, y);
    y += 16;
  }
  if (words.length > max) {
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText("+" + (words.length - max) + " more", box.x + box.w / 2, box.y + box.h - 14);
  }
}

function drawWsPlay(ctx) {
  var board = wsBoardWords();
  var foundN = board.filter(function (w) { return wsFound[w]; }).length;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("LEVEL " + (wsLevelIndex + 1), 16, 22);
  ctx.textAlign = "center";
  ctx.fillText("COINS " + wsCoins, WS_W / 2, 22);
  ctx.textAlign = "right";
  ctx.fillText("SCORE " + wsScore, WS_W - 16, 22);
  ctx.textAlign = "center";
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText(
    foundN + " / " + board.length + " words    yellow dots: 1 coin each    high " + wsHighScore,
    WS_W / 2,
    46
  );

  drawWsGrid(ctx);
  drawWsBonusSpot(ctx);

  var word = wsCurrentWord();
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = word ? "#ffffff" : "#9a9a9a";
  ctx.fillText(word ? word.toUpperCase() : "Drag letters", WS_W / 2, 338);

  if (wsMessage && performance.now() < wsMessageUntil) {
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(wsMessage, WS_W / 2, 368);
  } else {
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText("Hint " + WS_HINT_COST + " coins    Full word " + WS_WORD_COST + " coins", WS_W / 2, 368);
  }

  drawWsWheel(ctx);
  drawWsButtons(ctx);
}

function drawWsClear(ctx) {
  drawWsPlay(ctx);
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, WS_W, WS_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Impact, sans-serif";
  ctx.fillText("LEVEL CLEAR", WS_W / 2, WS_H / 2 - 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px sans-serif";
  ctx.fillText("Level score  +" + wsLevelScore, WS_W / 2, WS_H / 2 + 4);
  ctx.font = "16px sans-serif";
  var extra = wsBonusList.length;
  ctx.fillText(extra ? ("Bonus words: " + extra) : "No bonus words", WS_W / 2, WS_H / 2 + 30);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("Coins  " + wsCoins + "     Total  " + wsScore + (wsScore >= wsHighScore ? "  HIGH" : ""), WS_W / 2, WS_H / 2 + 56);
  ctx.fillStyle = "#c8c8c8";
  ctx.font = "15px sans-serif";
  ctx.fillText("Enter or click for the next level", WS_W / 2, WS_H / 2 + 88);
}

function drawWordscapes() {
  if (!wsCtx) return;
  if (!wsLevel) resetWordscapesGame();
  wsCtx.clearRect(0, 0, WS_W, WS_H);
  wsCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  wsCtx.fillRect(0, 0, WS_W, WS_H);
  wsCtx.strokeStyle = "rgba(255,255,255,0.35)";
  wsCtx.strokeRect(1.5, 1.5, WS_W - 3, WS_H - 3);
  if (wsScreen === "clear") drawWsClear(wsCtx);
  else drawWsPlay(wsCtx);
  requestAnimationFrame(drawWordscapes);
}

function wsPointerDown(event) {
  if (typeof activeGame === "undefined" || activeGame !== "wordscapes") return;
  event.preventDefault();
  var pos = wsCanvasPos(event);
  if (wsScreen === "clear") {
    startWordscapesLevel(wsLevelIndex + 1);
    return;
  }
  var btn = wsBtnAt(pos);
  if (btn === "shuffle") {
    shuffleWsTiles();
    return;
  }
  if (btn === "hint") {
    hintWsCell();
    return;
  }
  if (btn === "word") {
    revealWsWord();
    return;
  }
  var tile = wsTileAt(pos, false);
  if (tile !== -1) {
    wsDragging = true;
    wsPath = [tile];
  }
}

function wsPointerMove(event) {
  if (typeof activeGame === "undefined" || activeGame !== "wordscapes") return;
  var pos = wsCanvasPos(event);
  if (!wsDragging) {
    wsHoverBtn = wsScreen === "play" ? wsBtnAt(pos) : "";
    wsCanvas.style.cursor = wsHoverBtn ? "pointer" : "default";
    return;
  }
  event.preventDefault();
  var tile = wsTileAt(pos, true);
  if (tile === -1) return;
  if (wsPath[wsPath.length - 1] === tile) return;
  if (wsPath.length > 1 && wsPath[wsPath.length - 2] === tile) {
    wsPath.pop();
    return;
  }
  if (wsPath.indexOf(tile) === -1) wsPath.push(tile);
}

function wsPointerUp(event) {
  if (!wsDragging) return;
  if (event) event.preventDefault();
  wsDragging = false;
  submitWsWord(wsCurrentWord());
  wsPath = [];
}

window.addEventListener("keydown", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "wordscapes") return;
  var key = event.key.toLowerCase();
  if (key === " " || key === "enter" || key === "backspace") event.preventDefault();
  handleWsKey(key === " " ? "space" : key);
});

wsCanvas.addEventListener("pointerdown", wsPointerDown);
wsCanvas.addEventListener("pointermove", wsPointerMove);
wsCanvas.addEventListener("pointerup", wsPointerUp);
wsCanvas.addEventListener("pointerleave", function () {
  wsHoverBtn = "";
  if (wsDragging) wsPointerUp();
});
wsCanvas.addEventListener("pointercancel", wsPointerUp);

requestAnimationFrame(drawWordscapes);
