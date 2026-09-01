var wsCanvas = document.getElementById("wordscapesCanvas");
var wsCtx = wsCanvas.getContext("2d");
var WS_W = 560;
var WS_H = 720;
wsCanvas.width = WS_W;
wsCanvas.height = WS_H;

var WS_LEVEL_KEY = "wordscapesLevelV3";
var WS_SCORE_KEY = "wordscapesScoreV3";
var WS_COIN_KEY = "wordscapesCoinsV3";
var WS_START_COIN_FLAG = "wordscapesStartCoinsV3";
var WS_STARTING_COINS = 100;
var WS_PROGRESS_KEY = "wordscapesProgressV3";
var WS_RESET_FLAG = "wordscapesResetV3";

function clearOldWsProgress() {
  try {
    if (localStorage.getItem(WS_RESET_FLAG)) return;
    var oldKeys = [
      "wordscapesLevel", "wordscapesScore", "wordscapesHighScore",
      "wordscapesCoins", "wordscapesStartCoins", "wordscapesProgress",
      "wordscapesLevelV2", "wordscapesScoreV2", "wordscapesHighScore",
      "wordscapesCoinsV2", "wordscapesStartCoinsV2", "wordscapesProgressV2",
      "wordscapesResetV2"
    ];
    for (var i = 0; i < oldKeys.length; i++) localStorage.removeItem(oldKeys[i]);
    localStorage.setItem(WS_RESET_FLAG, "1");
  } catch (e) {}
}
clearOldWsProgress();
var WS_BOARD_PTS = 7;
var WS_BONUS_PTS = 1;
var WS_LEVEL_TOTAL = 20000;
var WS_LEVELS_URL = "wordscapes-levels.json";
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
var wsShowBonus = false;
var wsAllLevels = (typeof WS_STARTER_LEVELS !== "undefined" && WS_STARTER_LEVELS.length) ? WS_STARTER_LEVELS.slice() : null;
var wsLoadWait = [];
var wsCoins = WS_STARTING_COINS;
var wsSec = 0;
var wsMin = 0;
var wsHour = 0;
var wsDay = 0;
var wsYear = 0;
var wsFakeWords = 0;
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

function wsFallbackLevel() {
  if (typeof WS_STARTER_LEVELS !== "undefined" && WS_STARTER_LEVELS[0]) {
    return WS_STARTER_LEVELS[0];
  }
  return {
    tiles: ["d", "a", "d"],
    words: [
      { word: "dad", x: 0, y: 1, dir: "H" },
      { word: "add", x: 1, y: 0, dir: "V" }
    ]
  };
}

function wsNormIndex(index) {
  return ((index % WS_LEVEL_TOTAL) + WS_LEVEL_TOTAL) % WS_LEVEL_TOTAL;
}

function wsGetLevel(index) {
  index = wsNormIndex(index);
  if (wsAllLevels && wsAllLevels[index]) return wsAllLevels[index];
  if (typeof WS_STARTER_LEVELS !== "undefined" && WS_STARTER_LEVELS[index]) {
    return WS_STARTER_LEVELS[index];
  }
  return null;
}

function wsFinishLevelLoad() {
  var waits = wsLoadWait.slice();
  wsLoadWait = [];
  for (var i = 0; i < waits.length; i++) waits[i](wsGetLevel(wsLevelIndex));
}

function loadWsLevels(cb) {
  if (wsAllLevels && wsAllLevels.length > 100) {
    if (cb) cb(wsGetLevel(wsLevelIndex));
    return;
  }
  if (cb) wsLoadWait.push(cb);
  if (loadWsLevels.started) return;
  loadWsLevels.started = true;
  var req = new XMLHttpRequest();
  req.open("GET", WS_LEVELS_URL, true);
  req.onload = function () {
    try {
      var data = JSON.parse(req.responseText);
      if (data && data.length) {
        wsAllLevels = data;
        WS_LEVEL_TOTAL = data.length;
      }
    } catch (e) {}
    wsFinishLevelLoad();
  };
  req.onerror = function () {
    wsFinishLevelLoad();
  };
  try {
    req.send();
  } catch (e) {
    wsFinishLevelLoad();
  }
}

function resetWsClock() {
  wsSec = 0;
  wsMin = 0;
  wsHour = 0;
  wsDay = 0;
  wsYear = 0;
}

function tickWsClock() {
  if (typeof activeGame === "undefined" || activeGame !== "wordscapes") return;
  if (wsScreen !== "play") return;
  wsSec += 1;
  if (wsSec >= 60) {
    wsMin += 1;
    wsSec = 0;
  }
  if (wsMin >= 60) {
    wsHour += 1;
    wsMin = 0;
  }
  if (wsHour >= 24) {
    wsDay += 1;
    wsHour = 0;
  }
  if (wsDay >= 365) {
    wsYear += 1;
    wsDay = 0;
  }
  saveWsProgress();
}

function wsLevels() {
  var level = wsGetLevel(wsLevelIndex);
  return level ? [level] : [wsFallbackLevel()];
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
    if (!isNaN(n) && n >= 0) wsLevelIndex = wsNormIndex(n);
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
    if (!isNaN(s) && s > 0) wsScore = s;
  } catch (e) {}
}

function saveWsScores() {
  try {
    localStorage.setItem(WS_SCORE_KEY, String(wsScore));
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
      tiles: wsTiles.slice(),
      sec: wsSec,
      min: wsMin,
      hour: wsHour,
      day: wsDay,
      year: wsYear,
      fake: wsFakeWords
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
  wsSec = parseInt(data.sec, 10) || 0;
  wsMin = parseInt(data.min, 10) || 0;
  wsHour = parseInt(data.hour, 10) || 0;
  wsDay = parseInt(data.day, 10) || 0;
  wsYear = parseInt(data.year, 10) || 0;
  wsFakeWords = parseInt(data.fake, 10) || 0;
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
  var words = (wsLevel && wsLevel.words) ? wsLevel.words : [];
  for (var i = 0; i < words.length; i++) {
    var item = words[i];
    var lastX = item.x + (item.dir === "H" ? item.word.length - 1 : 0);
    var lastY = item.y + (item.dir === "V" ? item.word.length - 1 : 0);
    if (lastX > maxX) maxX = lastX;
    if (lastY > maxY) maxY = lastY;
  }
  return { cols: maxX + 1, rows: maxY + 1 };
}

function wsBonusCircle() {
  return { x: WS_W - 28, y: 54, r: 16 };
}

function wsBonusBox() {
  return { x: 40, y: 70, w: WS_W - 80, h: 280 };
}

function wsGridMetrics() {
  var b = wsGridBounds();
  var top = 50;
  var bottom = 410;
  var pad = 10;
  var gap = 3;
  var areaW = WS_W - pad * 2;
  var tile = Math.min(
    52,
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
  var words = (wsLevel && wsLevel.words) ? wsLevel.words : [];
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
  var cy = 548;
  var radius = n >= 8 ? 78 : (n >= 7 ? 84 : 88);
  var tileR = n >= 8 ? 22 : (n >= 7 ? 24 : 27);
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
    { id: "shuffle", label: "SHUFFLE", sub: "free", x: 16, y: 664, w: 168, h: 44 },
    { id: "hint", label: "HINT", sub: WS_HINT_COST + " coins", x: 196, y: 664, w: 168, h: 44 },
    { id: "word", label: "WORD", sub: WS_WORD_COST + " coins", x: 376, y: 664, w: 168, h: 44 }
  ];
}

function resetWordscapesGame() {
  loadWsLevelIndex();
  loadWsScores();
  loadWsCoins();
  startWordscapesLevel(wsLevelIndex, true);
}

function startWordscapesLevel(index, keepProgress) {
  wsLevelIndex = wsNormIndex(index);
  var level = wsGetLevel(wsLevelIndex);
  if (!level) {
    if (!wsLevel) {
      wsLevel = wsFallbackLevel();
      wsFound = {};
      wsBonus = {};
      wsBonusList = [];
      wsTiles = wsLevel.tiles.slice();
      wsCoinWord = wsHardestWord();
      wsPath = [];
      wsScreen = "play";
      resetWsClock();
      wsFakeWords = 0;
      shuffleWsTiles();
    }
    loadWsLevels(function (got) {
      if (got) startWordscapesLevel(wsLevelIndex, keepProgress);
    });
    return;
  }
  wsLevel = level;
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
  wsShowBonus = false;
  wsScreen = "play";
  wsValidSet = null;
  resetWsClock();
  wsFakeWords = 0;
  if (keepProgress && applyWsProgress(loadWsProgress())) {
    shuffleWsTiles();
    saveWsProgress();
    return;
  }
  shuffleWsTiles();
  saveWsProgress();
}

function wsValidWords() {
  if (wsValidSet) return wsValidSet;
  var dict = wsBuildDict();
  var set = {};
  for (var word in dict) {
    if (dict.hasOwnProperty(word) && wsCanSpell(word, wsTiles)) set[word] = true;
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
  if (word.length >= 3) {
    wsFakeWords += 1;
    saveWsProgress();
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
  var circle = wsBonusCircle();
  var dx = pos.x - circle.x;
  var dy = pos.y - circle.y;
  if (dx * dx + dy * dy <= (circle.r + 6) * (circle.r + 6)) return "bonus";
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

function drawWsBonusButton(ctx) {
  var c = wsBonusCircle();
  ctx.beginPath();
  ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
  ctx.fillStyle = wsShowBonus ? "#ffffff" : "#1c1c1c";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = wsShowBonus ? "#111111" : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("B", c.x, c.y + 1);
}

function drawWsBonusSpot(ctx) {
  if (!wsShowBonus) return;
  var box = wsBonusBox();
  ctx.fillStyle = "rgba(0,0,0,0.86)";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("BONUS", box.x + box.w / 2, box.y + 22);

  var words = wsBonusList.slice().reverse();
  var y = box.y + 50;
  var max = Math.floor((box.h - 58) / 18);
  ctx.font = "bold 14px sans-serif";
  if (!words.length) {
    ctx.fillStyle = "#6a6a6a";
    ctx.fillText("empty", box.x + box.w / 2, y + 8);
    return;
  }
  for (var i = 0; i < words.length && i < max; i++) {
    ctx.fillStyle = "#ffffff";
    ctx.fillText(words[i].toUpperCase() + "  +" + (words[i].length * WS_BONUS_PTS), box.x + box.w / 2, y);
    y += 18;
  }
  if (words.length > max) {
    ctx.fillStyle = "#9a9a9a";
    ctx.fillText("+" + (words.length - max) + " more", box.x + box.w / 2, box.y + box.h - 16);
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
  ctx.fillText("SCORE " + wsScore, WS_W - 52, 22);
  ctx.textAlign = "center";
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText(foundN + " / " + board.length, WS_W / 2, 42);

  drawWsGrid(ctx);
  drawWsBonusButton(ctx);
  drawWsBonusSpot(ctx);
  drawWsWheel(ctx);
  drawWsButtons(ctx);

  var word = wsCurrentWord();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 26px sans-serif";
  ctx.fillStyle = word ? "#ffffff" : "#9a9a9a";
  ctx.fillText(word ? word.toUpperCase() : "", WS_W / 2, 396);

  if (wsMessage && performance.now() < wsMessageUntil) {
    ctx.font = "bold 16px sans-serif";
    ctx.fillStyle = "#ffe81f";
    ctx.fillText(wsMessage, WS_W / 2, 418);
  }

  var stats = [
    "Seconds: " + wsSec,
    "Minutes: " + wsMin,
    "Hours: " + wsHour,
    "Days: " + wsDay,
    "Years: " + wsYear,
    "Fake words: " + wsFakeWords
  ];
  var statsX = 10;
  var statsY = 48;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(statsX, statsY, 128, 118);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "14px serif";
  ctx.fillStyle = "#ffffff";
  for (var s = 0; s < stats.length; s++) {
    ctx.fillText(stats[s], statsX + 8, statsY + 6 + s * 18);
  }
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
  ctx.fillText("Coins  " + wsCoins + "     Total  " + wsScore, WS_W / 2, WS_H / 2 + 56);
}

function drawWordscapes() {
  if (!wsCtx) {
    if (window.scheduleGameFrame) window.scheduleGameFrame(drawWordscapes, "wordscapes");
    else requestAnimationFrame(drawWordscapes);
    return;
  }
  if (typeof activeGame !== "undefined" && activeGame !== "wordscapes") {
    if (window.scheduleGameFrame) window.scheduleGameFrame(drawWordscapes, "wordscapes");
    else requestAnimationFrame(drawWordscapes);
    return;
  }
  if (!wsLevel) resetWordscapesGame();
  wsCtx.clearRect(0, 0, WS_W, WS_H);
  wsCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  wsCtx.fillRect(0, 0, WS_W, WS_H);
  wsCtx.strokeStyle = "rgba(255,255,255,0.35)";
  wsCtx.strokeRect(1.5, 1.5, WS_W - 3, WS_H - 3);
  if (wsLevel) {
    if (wsScreen === "clear") drawWsClear(wsCtx);
    else drawWsPlay(wsCtx);
  }
  if (!wsGetLevel(wsLevelIndex)) {
    wsCtx.fillStyle = "#ffe81f";
    wsCtx.textAlign = "center";
    wsCtx.textBaseline = "middle";
    wsCtx.font = "bold 14px sans-serif";
    wsCtx.fillText("LOADING LEVEL...", WS_W / 2, 418);
  }
  if (window.scheduleGameFrame) window.scheduleGameFrame(drawWordscapes, "wordscapes");
  else requestAnimationFrame(drawWordscapes);
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
  if (btn === "bonus") {
    wsShowBonus = !wsShowBonus;
    return;
  }
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

loadWsLevelIndex();
loadWsLevels();
setInterval(tickWsClock, 1000);
requestAnimationFrame(drawWordscapes);
