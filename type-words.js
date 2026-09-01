var typeCanvas = document.getElementById("typeWordsCanvas");
var typeCtx = typeCanvas.getContext("2d");
var TYPE_W = 640;
var TYPE_H = 480;
typeCanvas.width = TYPE_W;
typeCanvas.height = TYPE_H;

var TYPE_SCORE_KEY = "typeSurviveHighScores";
var TYPE_MODES = [
  { id: "easy", label: "EASY", hint: "Short everyday words", color: "#3dff6a" },
  { id: "medium", label: "MEDIUM", hint: "A bit more to type", color: "#ffe81f" },
  { id: "hard", label: "HARD", hint: "Longer, tougher words", color: "#ff9a3c" },
  { id: "impossible", label: "IMPOSSIBLE", hint: "Huge words, faster pace", color: "#e31b23" },
  { id: "all", label: "ALL", hint: "Every list mixed together", color: "#2e8bff" }
];

var typeQueue = [];
var typeTimer = 0;
var typeSeconds = 1;
var typeMinutes = 0;
var typeFrames = 0;
var typeDifficulty = 1;
var typeTotalWords = 0;
var typeMoveSpeed = 1;
var typeSpawnMin = 120;
var typeSpawnMax = 180;
var typeScreen = "menu";
var typeMode = "easy";
var typeLastTime = 0;
var typePlayerPulse = 0;
var typeHoverMode = -1;
var typeNewHigh = false;
var typeHighScores = { easy: 0, medium: 0, hard: 0, impossible: 0, all: 0 };

function loadTypeScores() {
  try {
    var raw = localStorage.getItem(TYPE_SCORE_KEY);
    if (!raw) return;
    var parsed = JSON.parse(raw);
    TYPE_MODES.forEach(function (mode) {
      var n = parseInt(parsed[mode.id], 10);
      if (!isNaN(n) && n > 0) typeHighScores[mode.id] = n;
    });
  } catch (e) {}
}

function saveTypeScores() {
  try {
    localStorage.setItem(TYPE_SCORE_KEY, JSON.stringify(typeHighScores));
  } catch (e) {}
}

function recordTypeScore() {
  typeNewHigh = false;
  if (typeTotalWords > (typeHighScores[typeMode] || 0)) {
    typeHighScores[typeMode] = typeTotalWords;
    typeNewHigh = true;
    saveTypeScores();
  }
}

function typeWordLists() {
  return (typeof TYPE_WORD_LISTS !== "undefined") ? TYPE_WORD_LISTS : {
    easy: ["the", "and", "type"],
    medium: ["queue", "words"],
    hard: ["survive", "protect"],
    long: ["keyboard"]
  };
}

function pickTypeWord() {
  var lists = typeWordLists();
  var bucket;
  if (typeMode === "easy") bucket = lists.easy;
  else if (typeMode === "medium") bucket = lists.medium;
  else if (typeMode === "hard") bucket = lists.hard;
  else if (typeMode === "impossible") bucket = lists.long;
  else {
    var roll = Math.floor(Math.random() * 37);
    if (roll < 5) bucket = lists.easy;
    else if (roll < 15) bucket = lists.medium;
    else if (roll < 30) bucket = lists.hard;
    else bucket = lists.long;
  }
  if (!bucket || !bucket.length) bucket = lists.easy;
  return bucket[Math.floor(Math.random() * bucket.length)];
}

function TypeEnemy(word) {
  this.redText = String(word).toLowerCase();
  this.greenText = "";
  this.x = 12;
  this.r = 11;
}

TypeEnemy.prototype.checkLetter = function (letter) {
  if (!this.redText.length) return false;
  if (letter !== this.redText[0]) return true;
  this.greenText += letter;
  this.redText = this.redText.slice(1);
  return this.redText.length > 0;
};

TypeEnemy.prototype.stepDraw = function (ctx, index, dtScale) {
  this.x += typeMoveSpeed * dtScale;
  this.y = 118 + 58 * index;
  ctx.beginPath();
  ctx.fillStyle = "#e31b23";
  ctx.shadowColor = "#ff6b6b";
  ctx.shadowBlur = 8;
  ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.font = "bold 20px sans-serif";
  ctx.textBaseline = "bottom";
  var gx = this.x;
  var gy = this.y - 16;
  ctx.textAlign = "right";
  ctx.fillStyle = "#3dff6a";
  ctx.fillText(this.greenText, gx, gy);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ff4d4d";
  ctx.fillText(this.redText, gx, gy);
  return this.x < 560;
};

function typeWpm() {
  var minutes = typeMinutes + typeSeconds / 60;
  if (minutes <= 0) return 0;
  return typeTotalWords / minutes;
}

function applyTypeModeSettings(mode) {
  typeMode = mode;
  typeMoveSpeed = 1;
  typeSpawnMin = 120;
  typeSpawnMax = 180;
  if (mode === "easy") {
    typeMoveSpeed = 0.72;
    typeSpawnMin = 160;
    typeSpawnMax = 230;
  } else if (mode === "medium") {
    typeMoveSpeed = 0.88;
    typeSpawnMin = 140;
    typeSpawnMax = 200;
  } else if (mode === "hard") {
    typeMoveSpeed = 1;
    typeSpawnMin = 120;
    typeSpawnMax = 180;
  } else if (mode === "impossible") {
    typeMoveSpeed = 1.28;
    typeSpawnMin = 70;
    typeSpawnMax = 120;
  }
}

function resetTypeGame() {
  typeQueue = [];
  typeTimer = 20;
  typeSeconds = 1;
  typeMinutes = 0;
  typeFrames = 0;
  typeDifficulty = 1;
  typeTotalWords = 0;
  typeScreen = "menu";
  typeNewHigh = false;
  typeLastTime = performance.now();
}

function startTypeGame(mode) {
  applyTypeModeSettings(mode);
  typeQueue = [];
  typeTimer = 20;
  typeSeconds = 1;
  typeMinutes = 0;
  typeFrames = 0;
  typeDifficulty = mode === "impossible" ? 2 : 1;
  typeTotalWords = 0;
  typeScreen = "play";
  typeNewHigh = false;
  typeLastTime = performance.now();
}

function spawnTypeEnemy() {
  typeQueue.push(new TypeEnemy(pickTypeWord()));
}

function handleTypeKey(letter) {
  if (typeScreen !== "play" || !typeQueue.length) return;
  if (!typeQueue[0].checkLetter(letter)) {
    typeQueue.shift();
    typeTotalWords += 1;
  }
}

function endTypeGame() {
  if (typeScreen !== "play") return;
  typeScreen = "over";
  recordTypeScore();
}

function typeModeButtons() {
  var buttons = [];
  var w = 420;
  var h = 48;
  var x = (TYPE_W - w) / 2;
  var startY = 118;
  for (var i = 0; i < TYPE_MODES.length; i++) {
    buttons.push({
      mode: TYPE_MODES[i],
      x: x,
      y: startY + i * 58,
      w: w,
      h: h
    });
  }
  return buttons;
}

function typeCanvasPos(event) {
  var rect = typeCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (TYPE_W / rect.width),
    y: (event.clientY - rect.top) * (TYPE_H / rect.height)
  };
}

function drawTypeHud(ctx) {
  var clock = String(typeMinutes).padStart(2, "0") + ":" + String(typeSeconds).padStart(2, "0");
  var modeInfo = TYPE_MODES.find(function (m) { return m.id === typeMode; });
  ctx.fillStyle = "#ffe81f";
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(clock, 18, 14);
  ctx.fillStyle = modeInfo ? modeInfo.color : "#ffe81f";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText((modeInfo ? modeInfo.label : typeMode.toUpperCase()), 18, 36);

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe81f";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("SCORE " + typeTotalWords, TYPE_W / 2, 14);
  ctx.fillStyle = "#9aa3ad";
  ctx.font = "13px sans-serif";
  ctx.fillText("HIGH " + (typeHighScores[typeMode] || 0), TYPE_W / 2, 36);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffe81f";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("WPM " + typeWpm().toFixed(1), TYPE_W - 18, 14);
}

function drawTypePlayer(ctx) {
  var px = 590;
  var py = 230;
  typePlayerPulse += 0.08;
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = "#2e8bff";
  ctx.beginPath();
  ctx.arc(0, -22, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c0c8d4";
  ctx.fillRect(-14, -6, 28, 36);
  ctx.fillStyle = "#ffe81f";
  ctx.fillRect(-18, 8, 8, 22);
  ctx.fillRect(10, 8, 8, 22);
  ctx.restore();
}

function drawTypeMenu(ctx) {
  ctx.fillStyle = "#ffe81f";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "bold 34px Impact, sans-serif";
  ctx.fillText("TYPE TO SURVIVE", TYPE_W / 2, 28);
  var buttons = typeModeButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var hover = typeHoverMode === i;
    ctx.fillStyle = hover ? "rgba(255, 232, 31, 0.16)" : "rgba(255,255,255,0.06)";
    ctx.strokeStyle = hover ? b.mode.color : "rgba(255, 232, 31, 0.45)";
    ctx.lineWidth = hover ? 2.5 : 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, 8);
    else ctx.rect(b.x, b.y, b.w, b.h);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = b.mode.color;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText((i + 1) + "  " + b.mode.label, b.x + 18, b.y + b.h / 2 - 8);
    ctx.fillStyle = "#9aa3ad";
    ctx.font = "13px sans-serif";
    ctx.fillText(b.mode.hint, b.x + 46, b.y + b.h / 2 + 12);

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffe81f";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("HIGH  " + (typeHighScores[b.mode.id] || 0), b.x + b.w - 18, b.y + b.h / 2);
  }

}

function drawTypeGameOver(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, TYPE_W, TYPE_H);
  ctx.fillStyle = "#ffe81f";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 36px Impact, sans-serif";
  ctx.fillText("GAME OVER", TYPE_W / 2, TYPE_H / 2 - 56);
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Score: " + typeTotalWords + "    WPM: " + typeWpm().toFixed(1), TYPE_W / 2, TYPE_H / 2 - 12);
  ctx.fillStyle = typeNewHigh ? "#3dff6a" : "#ffe81f";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(
    typeNewHigh ? "NEW HIGH SCORE!" : ("High score: " + (typeHighScores[typeMode] || 0)),
    TYPE_W / 2,
    TYPE_H / 2 + 18
  );
}

function updateTypePlay(dtScale) {
  typeTimer -= 1 * typeDifficulty * dtScale;
  typeFrames += dtScale;
  if (typeFrames >= 60) {
    typeFrames -= 60;
    typeSeconds += 1;
  }
  if (typeSeconds >= 60) {
    typeSeconds = 0;
    typeMinutes += 1;
  }
  if (typeMinutes === 0 && typeSeconds >= 30) typeDifficulty = Math.max(typeDifficulty, 2);
  if (typeMinutes >= 1) typeDifficulty = Math.max(typeDifficulty, 3);
  if (typeMinutes >= 2) typeDifficulty = Math.max(typeDifficulty, 4);

  if (typeTimer <= 0) {
    spawnTypeEnemy();
    typeTimer = typeSpawnMin + Math.floor(Math.random() * (typeSpawnMax - typeSpawnMin + 1));
  }

  for (var i = 0; i < typeQueue.length; i++) {
    if (!typeQueue[i].stepDraw(typeCtx, i, dtScale)) {
      endTypeGame();
      break;
    }
  }
  drawTypePlayer(typeCtx);
  drawTypeHud(typeCtx);
}

function updateTypeGame(now) {
  if (typeof activeGame !== "undefined" && activeGame !== "typeSurvive") {
    typeLastTime = now;
    requestAnimationFrame(updateTypeGame);
    return;
  }

  var dt = Math.min(0.05, (now - typeLastTime) / 1000);
  typeLastTime = now;
  var dtScale = dt * 60;

  typeCtx.clearRect(0, 0, TYPE_W, TYPE_H);
  typeCtx.fillStyle = "rgba(0, 0, 0, 0.55)";
  typeCtx.fillRect(0, 0, TYPE_W, TYPE_H);
  typeCtx.strokeStyle = "rgba(255, 232, 31, 0.4)";
  typeCtx.strokeRect(1.5, 1.5, TYPE_W - 3, TYPE_H - 3);

  if (typeScreen === "menu") {
    drawTypeMenu(typeCtx);
  } else if (typeScreen === "play") {
    updateTypePlay(dtScale);
  } else {
    for (var j = 0; j < typeQueue.length; j++) {
      typeQueue[j].stepDraw(typeCtx, j, 0);
    }
    drawTypePlayer(typeCtx);
    drawTypeHud(typeCtx);
    drawTypeGameOver(typeCtx);
  }

  requestAnimationFrame(updateTypeGame);
}

function typeSelectFromKey(key) {
  if (key === "1" || key === "e") startTypeGame("easy");
  else if (key === "2" || key === "m") startTypeGame("medium");
  else if (key === "3" || key === "h") startTypeGame("hard");
  else if (key === "4" || key === "i") startTypeGame("impossible");
  else if (key === "5" || key === "a") startTypeGame("all");
}

window.addEventListener("keydown", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "typeSurvive") return;
  if (typeScreen === "menu") {
    typeSelectFromKey(event.key.toLowerCase());
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    resetTypeGame();
    return;
  }
  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    if (typeScreen === "over") startTypeGame(typeMode);
    return;
  }
  if (typeScreen !== "play") return;
  if (!event.key || event.key.length !== 1) return;
  var letter = event.key.toLowerCase();
  if (letter < "a" || letter > "z") return;
  event.preventDefault();
  handleTypeKey(letter);
});

typeCanvas.addEventListener("mousemove", function (event) {
  if (typeScreen !== "menu") {
    typeHoverMode = -1;
    return;
  }
  var pos = typeCanvasPos(event);
  typeHoverMode = -1;
  var buttons = typeModeButtons();
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
      typeHoverMode = i;
      typeCanvas.style.cursor = "pointer";
      return;
    }
  }
  typeCanvas.style.cursor = "default";
});

typeCanvas.addEventListener("click", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "typeSurvive") return;
  var pos = typeCanvasPos(event);
  if (typeScreen === "menu") {
    var buttons = typeModeButtons();
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
        startTypeGame(b.mode.id);
        typeCanvas.style.cursor = "default";
        return;
      }
    }
  } else if (typeScreen === "over") {
    startTypeGame(typeMode);
  }
});

loadTypeScores();
requestAnimationFrame(updateTypeGame);
