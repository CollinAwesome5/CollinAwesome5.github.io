var wordleCanvas = document.getElementById("wordleCanvas");
var wordleCtx = wordleCanvas.getContext("2d");
var WORDLE_W = 560;
var WORDLE_H = 620;
wordleCanvas.width = WORDLE_W;
wordleCanvas.height = WORDLE_H;

var WORDLE_GUESSES = 6;
var wordleScreen = "menu";
var wordleLen = 5;
var wordleAnswer = "";
var wordleRows = [];
var wordleCurrent = "";
var wordleMessage = "";
var wordleMessageUntil = 0;
var wordleHover = -1;
var wordleWon = false;
var wordleGuessSet = null;
var wordleGuessCache = {};
var WORDLE_PROGRESS_KEY = "wordleProgress";

function saveWordleProgress() {
  try {
    localStorage.setItem(WORDLE_PROGRESS_KEY, JSON.stringify({
      screen: wordleScreen,
      len: wordleLen,
      answer: wordleAnswer,
      rows: wordleRows,
      current: wordleCurrent,
      won: wordleWon
    }));
  } catch (e) {}
}

function loadWordleProgress() {
  try {
    var raw = localStorage.getItem(WORDLE_PROGRESS_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (e) {
    return null;
  }
}

function restoreWordleGame() {
  if (wordleScreen === "play" || wordleScreen === "over") return;
  var data = loadWordleProgress();
  if (data && (data.screen === "play" || data.screen === "over") && data.answer) {
    wordleScreen = data.screen;
    wordleLen = data.len || String(data.answer).length;
    wordleAnswer = String(data.answer).toLowerCase();
    wordleRows = Array.isArray(data.rows) ? data.rows : [];
    wordleCurrent = data.current ? String(data.current).toLowerCase() : "";
    wordleWon = !!data.won;
    wordleMessage = "";
    wordleHover = -1;
    wordleGuessSet = buildWordleGuessSet(wordleLen);
    refreshWordleTouch();
    return;
  }
  resetWordleGame();
}

function wordleAnswersFor(len) {
  var lists = (typeof WORDLE_ANSWERS !== "undefined") ? WORDLE_ANSWERS : {};
  return lists[String(len)] || lists[len] || [];
}

function buildWordleGuessSet(len) {
  if (wordleGuessCache[len]) return wordleGuessCache[len];
  var set = {};
  var answers = wordleAnswersFor(len);
  for (var i = 0; i < answers.length; i++) set[answers[i]] = true;
  wordleGuessCache[len] = set;
  return set;
}

function pickWordleAnswer(len) {
  var words = wordleAnswersFor(len);
  if (!words.length) return "word".slice(0, len);
  return words[Math.floor(Math.random() * words.length)];
}

function scoreWordleGuess(guess, answer) {
  var n = answer.length;
  var marks = new Array(n);
  var used = new Array(n);
  var i;
  for (i = 0; i < n; i++) {
    marks[i] = 0;
    used[i] = false;
  }
  for (i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = 2;
      used[i] = true;
    }
  }
  for (i = 0; i < n; i++) {
    if (marks[i] === 2) continue;
    for (var j = 0; j < n; j++) {
      if (!used[j] && answer[j] === guess[i]) {
        marks[i] = 1;
        used[j] = true;
        break;
      }
    }
  }
  return marks;
}

function wordleKeyMarks() {
  var best = {};
  for (var r = 0; r < wordleRows.length; r++) {
    var row = wordleRows[r];
    for (var i = 0; i < row.guess.length; i++) {
      var ch = row.guess[i];
      var mark = row.marks[i];
      if (!best[ch] || mark > best[ch]) best[ch] = mark;
    }
  }
  return best;
}

function refreshWordleTouch() {
  if (typeof updateTouchControls === "function" && typeof activeGame !== "undefined" && activeGame === "wordle") {
    updateTouchControls("wordle");
  }
}

function resetWordleGame() {
  wordleScreen = "menu";
  wordleLen = 5;
  wordleAnswer = "";
  wordleRows = [];
  wordleCurrent = "";
  wordleMessage = "";
  wordleHover = -1;
  wordleWon = false;
  wordleGuessSet = null;
  refreshWordleTouch();
  saveWordleProgress();
}

function startWordleGame(len) {
  wordleLen = len;
  wordleAnswer = pickWordleAnswer(len);
  wordleGuessSet = buildWordleGuessSet(len);
  wordleRows = [];
  wordleCurrent = "";
  wordleMessage = "";
  wordleWon = false;
  wordleScreen = "play";
  refreshWordleTouch();
  saveWordleProgress();
}

function showWordleMessage(text) {
  wordleMessage = text;
  wordleMessageUntil = performance.now() + 1400;
}

function submitWordleGuess() {
  if (wordleCurrent.length !== wordleLen) {
    showWordleMessage("Need " + wordleLen + " letters");
    return;
  }
  if (!wordleGuessSet[wordleCurrent]) {
    showWordleMessage("Not a word");
    return;
  }
  var marks = scoreWordleGuess(wordleCurrent, wordleAnswer);
  wordleRows.push({ guess: wordleCurrent, marks: marks });
  var won = marks.every(function (m) { return m === 2; });
  wordleCurrent = "";
  if (won) {
    wordleWon = true;
    wordleScreen = "over";
    refreshWordleTouch();
  } else if (wordleRows.length >= WORDLE_GUESSES) {
    wordleWon = false;
    wordleScreen = "over";
    refreshWordleTouch();
  }
  saveWordleProgress();
}

function handleWordleKey(key) {
  if (wordleScreen === "menu") {
    if (key >= "4" && key <= "9") startWordleGame(parseInt(key, 10));
    else if (key === "0" || key === "1") startWordleGame(10);
    return;
  }
  if (wordleScreen === "over") {
    if (key === "enter" || key === " " || key === "space") startWordleGame(wordleLen);
    else if (key === "escape" || key === "backspace") resetWordleGame();
    return;
  }
  if (key === "escape") {
    resetWordleGame();
    return;
  }
  if (key === "backspace") {
    wordleCurrent = wordleCurrent.slice(0, -1);
    saveWordleProgress();
    return;
  }
  if (key === "enter") {
    submitWordleGuess();
    return;
  }
  if (key.length === 1 && key >= "a" && key <= "z") {
    if (wordleCurrent.length < wordleLen) wordleCurrent += key;
    saveWordleProgress();
  }
}

function wordleCanvasPos(event) {
  var rect = wordleCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (WORDLE_W / rect.width),
    y: (event.clientY - rect.top) * (WORDLE_H / rect.height)
  };
}

function wordleMenuButtons() {
  var buttons = [];
  var start = 4;
  var cols = 2;
  var bw = 210;
  var bh = 52;
  var gapX = 18;
  var gapY = 14;
  var left = (WORDLE_W - (cols * bw + (cols - 1) * gapX)) / 2;
  var top = 210;
  for (var i = 0; i < 7; i++) {
    var len = start + i;
    var col = i % cols;
    var row = Math.floor(i / cols);
    if (i === 6) col = 0.5;
    buttons.push({
      len: len,
      x: left + col * (bw + gapX),
      y: top + row * (bh + gapY),
      w: bw,
      h: bh
    });
  }
  return buttons;
}

function wordleGridMetrics() {
  var padX = 28;
  var top = 78;
  var gap = wordleLen >= 8 ? 5 : 7;
  var tile = Math.min(54, Math.floor((WORDLE_W - padX * 2 - gap * (wordleLen - 1)) / wordleLen));
  var gridW = wordleLen * tile + (wordleLen - 1) * gap;
  return {
    tile: tile,
    gap: gap,
    left: Math.floor((WORDLE_W - gridW) / 2),
    top: top,
    rowH: tile + gap
  };
}

function drawWordleTile(ctx, x, y, size, letter, mark, filled) {
  ctx.save();
  if (mark === 2) {
    ctx.fillStyle = "#3dff6a";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#2ec056";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.fillStyle = "#082010";
  } else if (mark === 1) {
    ctx.fillStyle = "#ff9a3c";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#e07d20";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.fillStyle = "#1a0d00";
  } else if (mark === 0 && filled) {
    ctx.fillStyle = "#6d6d6d";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#5a5a5a";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.fillStyle = "#f0f0f0";
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = filled ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.fillStyle = "#ffffff";
  }
  if (letter) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold " + Math.floor(size * 0.52) + "px sans-serif";
    ctx.fillText(letter.toUpperCase(), x + size / 2, y + size / 2 + 1);
  }
  ctx.restore();
}

function drawWordleLegend(ctx, y) {
  ctx.save();
  var items = [
    { mark: 2, label: "right spot" },
    { mark: 1, label: "in word" },
    { mark: 0, label: "not in word", filled: true }
  ];
  var box = 18;
  var total = 0;
  var texts = [];
  ctx.font = "13px sans-serif";
  for (var i = 0; i < items.length; i++) {
    var tw = ctx.measureText(items[i].label).width;
    texts.push(tw);
    total += box + 8 + tw + 22;
  }
  var x = (WORDLE_W - total + 22) / 2;
  for (var j = 0; j < items.length; j++) {
    drawWordleTile(ctx, x, y, box, "", items[j].mark, !!items[j].filled);
    ctx.fillStyle = "#c8c8c8";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "13px sans-serif";
    ctx.fillText(items[j].label, x + box + 8, y + box / 2);
    x += box + 8 + texts[j] + 22;
  }
  ctx.restore();
}

function drawWordleMenu(ctx) {
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 42px Impact, sans-serif";
  ctx.fillText("WORDLE", WORDLE_W / 2, 78);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#c8c8c8";
  ctx.fillText("Pick how many letters", WORDLE_W / 2, 124);
  ctx.font = "14px sans-serif";
  ctx.fillStyle = "#9a9a9a";
  ctx.fillText("Gray = not in word   Orange = wrong spot   Green = right spot", WORDLE_W / 2, 152);

  var buttons = wordleMenuButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var hover = wordleHover === i;
    var isDefault = b.len === 5;
    ctx.fillStyle = hover ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.45)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = isDefault ? "#3dff6a" : "#ffffff";
    ctx.lineWidth = hover || isDefault ? 3 : 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(isDefault ? b.len + " LETTERS  DEFAULT" : (b.len + " LETTERS"), b.x + b.w / 2, b.y + b.h / 2);
  }
  drawWordleLegend(ctx, WORDLE_H - 58);
}

function drawWordlePlay(ctx) {
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(wordleLen + " LETTERS", WORDLE_W / 2, 36);

  var g = wordleGridMetrics();
  var r, c, letter, mark;
  for (r = 0; r < WORDLE_GUESSES; r++) {
    for (c = 0; c < wordleLen; c++) {
      letter = "";
      mark = -1;
      var filled = false;
      if (r < wordleRows.length) {
        letter = wordleRows[r].guess[c];
        mark = wordleRows[r].marks[c];
        filled = true;
      } else if (r === wordleRows.length && c < wordleCurrent.length) {
        letter = wordleCurrent[c];
      }
      drawWordleTile(
        ctx,
        g.left + c * (g.tile + g.gap),
        g.top + r * g.rowH,
        g.tile,
        letter,
        mark,
        filled
      );
    }
  }

  if (wordleMessage && performance.now() < wordleMessageUntil) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(wordleMessage, WORDLE_W / 2, g.top + WORDLE_GUESSES * g.rowH + 18);
  } else {
    ctx.fillStyle = "#9a9a9a";
    ctx.font = "14px sans-serif";
    ctx.fillText("Type a word   Enter to guess   Backspace to delete", WORDLE_W / 2, g.top + WORDLE_GUESSES * g.rowH + 18);
  }
  drawWordleLegend(ctx, WORDLE_H - 42);
}

function drawWordleOver(ctx) {
  drawWordlePlay(ctx);
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, WORDLE_W, WORDLE_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Impact, sans-serif";
  ctx.fillText(wordleWon ? "YOU GOT IT" : "OUT OF GUESSES", WORDLE_W / 2, WORDLE_H / 2 - 40);
  ctx.font = "20px sans-serif";
  ctx.fillText("The word was  " + wordleAnswer.toUpperCase(), WORDLE_W / 2, WORDLE_H / 2 + 8);
  ctx.fillStyle = "#c8c8c8";
  ctx.font = "15px sans-serif";
  ctx.fillText("Enter: play again    Esc: change length", WORDLE_W / 2, WORDLE_H / 2 + 52);
}

function drawWordle() {
  if (!wordleCtx) return;
  wordleCtx.clearRect(0, 0, WORDLE_W, WORDLE_H);
  wordleCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  wordleCtx.fillRect(0, 0, WORDLE_W, WORDLE_H);
  wordleCtx.strokeStyle = "rgba(255,255,255,0.35)";
  wordleCtx.strokeRect(1.5, 1.5, WORDLE_W - 3, WORDLE_H - 3);

  if (wordleScreen === "menu") drawWordleMenu(wordleCtx);
  else if (wordleScreen === "play") drawWordlePlay(wordleCtx);
  else drawWordleOver(wordleCtx);

  requestAnimationFrame(drawWordle);
}

window.addEventListener("keydown", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "wordle") return;
  var key = event.key.toLowerCase();
  if (key === " " || key === "enter" || key === "backspace" || key === "escape") {
    event.preventDefault();
  }
  handleWordleKey(key === " " ? "space" : key);
});

wordleCanvas.addEventListener("mousemove", function (event) {
  if (wordleScreen !== "menu") {
    wordleHover = -1;
    wordleCanvas.style.cursor = "default";
    return;
  }
  var pos = wordleCanvasPos(event);
  wordleHover = -1;
  var buttons = wordleMenuButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
      wordleHover = i;
      wordleCanvas.style.cursor = "pointer";
      return;
    }
  }
  wordleCanvas.style.cursor = "default";
});

wordleCanvas.addEventListener("click", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "wordle") return;
  if (wordleScreen === "over") {
    startWordleGame(wordleLen);
    return;
  }
  if (wordleScreen !== "menu") return;
  var pos = wordleCanvasPos(event);
  var buttons = wordleMenuButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
      startWordleGame(b.len);
      wordleCanvas.style.cursor = "default";
      return;
    }
  }
});

requestAnimationFrame(drawWordle);
