var doodleCanvas = document.getElementById("doodleJumpCanvas");
var doodleCtx = doodleCanvas.getContext("2d");
var DOODLE_W = 480;
var DOODLE_H = 640;
doodleCanvas.width = DOODLE_W;
doodleCanvas.height = DOODLE_H;

var DOODLE_SCORE_KEY = "doodleJumpHighScore";
var doodleKeys = { left: false, right: false };
var doodleLastTime = 0;
var doodleAlive = false;
var doodleScore = 0;
var doodleHigh = 0;
var doodleNewHigh = false;
var doodlePlayer = null;
var doodlePlatforms = [];
var DOODLE_JUMP = -16;

try {
  doodleHigh = parseInt(localStorage.getItem(DOODLE_SCORE_KEY) || "0", 10);
  if (isNaN(doodleHigh)) doodleHigh = 0;
} catch (e) {
  doodleHigh = 0;
}

function saveDoodleHigh() {
  try {
    localStorage.setItem(DOODLE_SCORE_KEY, String(doodleHigh));
  } catch (e) {}
}

function DoodlePlayer() {
  this.w = 46;
  this.h = 46;
  this.x = DOODLE_W / 2 - this.w / 2;
  this.y = DOODLE_H - 95;
  this.speed = DOODLE_JUMP;
  this.ms = 10;
  this.facing = 1;
}

DoodlePlayer.prototype.left = function () { return this.x; };
DoodlePlayer.prototype.right = function () { return this.x + this.w; };
DoodlePlayer.prototype.bottom = function () { return this.y + this.h; };

DoodlePlayer.prototype.moveLeft = function (dtScale) {
  this.x -= this.ms * dtScale;
  this.facing = -1;
  if (this.x + this.w < 0) this.x = DOODLE_W;
};

DoodlePlayer.prototype.moveRight = function (dtScale) {
  this.x += this.ms * dtScale;
  this.facing = 1;
  if (this.x > DOODLE_W) this.x = -this.w;
};

DoodlePlayer.prototype.update = function (platforms, dtScale) {
  if (this.bottom() > DOODLE_H) return false;

  if (this.speed > 0) {
    for (var i = 0; i < platforms.length; i++) {
      var p = platforms[i];
      if (this.right() > p.x && this.left() < p.x + p.width) {
        if (this.bottom() > p.y && this.bottom() < p.y + p.height + 8) {
          this.speed = DOODLE_JUMP;
          this.y += this.speed * dtScale;
          return true;
        }
      }
    }
  }

  if (this.speed < 10) this.speed += 1 * dtScale;
  this.y += this.speed * dtScale;
  return this.bottom() <= DOODLE_H;
};

function DoodlePlatform(x, y, platWidth, platHeight) {
  this.x = x;
  this.y = y;
  this.width = platWidth;
  this.height = platHeight;
}

DoodlePlatform.prototype.onScreen = function () {
  return this.y < DOODLE_H;
};

function followDoodleCamera() {
  var camY = DOODLE_H / 2 - doodlePlayer.h / 2;
  if (doodlePlayer.y >= camY) return;
  var scroll = camY - doodlePlayer.y;
  doodlePlayer.y = camY;
  for (var i = 0; i < doodlePlatforms.length; i++) {
    doodlePlatforms[i].y += scroll;
  }
}

function spawnDoodlePlatform(y) {
  var platWidth = 78 + Math.floor(Math.random() * 28);
  var x = Math.floor(Math.random() * (DOODLE_W - platWidth));
  doodlePlatforms.push(new DoodlePlatform(x, y, platWidth, 12));
}

function resetDoodleGame() {
  doodlePlayer = new DoodlePlayer();
  doodlePlatforms = [new DoodlePlatform(0, DOODLE_H - 30, DOODLE_W, 26)];
  for (var i = 1; i < 9; i++) {
    spawnDoodlePlatform(DOODLE_H - i * 70);
  }
  doodleScore = 0;
  doodleAlive = true;
  doodleNewHigh = false;
  doodleLastTime = performance.now();
}

function endDoodleGame() {
  doodleAlive = false;
  if (doodleScore > doodleHigh) {
    doodleHigh = doodleScore;
    doodleNewHigh = true;
    saveDoodleHigh();
  }
}

function drawDoodleBackdrop(ctx) {
  ctx.clearRect(0, 0, DOODLE_W, DOODLE_H);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, DOODLE_W, DOODLE_H);
  ctx.strokeStyle = "rgba(255, 232, 31, 0.4)";
  ctx.strokeRect(1.5, 1.5, DOODLE_W - 3, DOODLE_H - 3);
}

function drawDoodlePlatforms(ctx) {
  for (var i = 0; i < doodlePlatforms.length; i++) {
    var p = doodlePlatforms[i];
    ctx.fillStyle = "#1b3d1b";
    ctx.fillRect(p.x, p.y + 4, p.width, p.height);
    ctx.fillStyle = "#ffe81f";
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.width, p.height, 6);
      ctx.fill();
    } else {
      ctx.fillRect(p.x, p.y, p.width, p.height);
    }
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(p.x + 6, p.y + 2, p.width - 12, 3);
  }
}

function drawDoodlePlayer(ctx, player) {
  var cx = player.x + player.w / 2;
  var cy = player.y + player.h / 2;
  ctx.fillStyle = "#2ecc71";
  ctx.beginPath();
  ctx.arc(cx, cy, player.w / 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDoodleHud(ctx) {
  ctx.fillStyle = "#ffe81f";
  ctx.font = "bold 20px sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText("SCORE " + doodleScore, 16, 14);
  ctx.textAlign = "right";
  ctx.fillText("HIGH " + doodleHigh, DOODLE_W - 16, 14);
}

function drawDoodleGameOver(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, 0, DOODLE_W, DOODLE_H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe81f";
  ctx.font = "bold 36px Impact, sans-serif";
  ctx.fillText("GAME OVER", DOODLE_W / 2, DOODLE_H / 2 - 40);
  ctx.fillStyle = "#ffffff";
  ctx.font = "18px sans-serif";
  ctx.fillText("Score: " + doodleScore, DOODLE_W / 2, DOODLE_H / 2 + 4);
  ctx.fillStyle = doodleNewHigh ? "#3dff6a" : "#ffe81f";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(doodleNewHigh ? "NEW HIGH SCORE!" : ("High score: " + doodleHigh), DOODLE_W / 2, DOODLE_H / 2 + 32);
}

function updateDoodleGame(now) {
  if (typeof activeGame !== "undefined" && activeGame !== "doodleJump") {
    doodleLastTime = now;
    requestAnimationFrame(updateDoodleGame);
    return;
  }

  var dt = Math.min(0.05, (now - doodleLastTime) / 1000);
  doodleLastTime = now;
  var dtScale = dt * 60;

  drawDoodleBackdrop(doodleCtx);

  if (doodleAlive && doodlePlayer) {
    if (doodleKeys.left) doodlePlayer.moveLeft(dtScale);
    if (doodleKeys.right) doodlePlayer.moveRight(dtScale);

    if (!doodlePlayer.update(doodlePlatforms, dtScale)) {
      endDoodleGame();
    } else {
      followDoodleCamera();
      var kept = [];
      for (var i = 0; i < doodlePlatforms.length; i++) {
        if (doodlePlatforms[i].onScreen()) {
          kept.push(doodlePlatforms[i]);
        } else {
          doodleScore += 1;
        }
      }
      doodlePlatforms = kept;
      while (doodlePlatforms.length < 9) {
        spawnDoodlePlatform(-8);
      }
    }
  }

  drawDoodlePlatforms(doodleCtx);
  if (doodlePlayer) drawDoodlePlayer(doodleCtx, doodlePlayer);
  drawDoodleHud(doodleCtx);
  if (!doodleAlive) drawDoodleGameOver(doodleCtx);

  requestAnimationFrame(updateDoodleGame);
}

function doodleKeyIsLeft(event) {
  return event.key === "ArrowLeft" || event.key === "a" || event.key === "A";
}

function doodleKeyIsRight(event) {
  return event.key === "ArrowRight" || event.key === "d" || event.key === "D";
}

window.addEventListener("keydown", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "doodleJump") return;
  if (event.key === " " || event.code === "Space") {
    event.preventDefault();
    if (!doodleAlive) resetDoodleGame();
    return;
  }
  if (doodleKeyIsLeft(event) || doodleKeyIsRight(event)) {
    event.preventDefault();
    if (doodleKeyIsLeft(event)) doodleKeys.left = true;
    if (doodleKeyIsRight(event)) doodleKeys.right = true;
  }
});

window.addEventListener("keyup", function (event) {
  if (doodleKeyIsLeft(event)) doodleKeys.left = false;
  if (doodleKeyIsRight(event)) doodleKeys.right = false;
});

doodleCanvas.addEventListener("pointerdown", function (event) {
  if (typeof activeGame === "undefined" || activeGame !== "doodleJump") return;
  if (!doodleAlive) {
    resetDoodleGame();
    return;
  }
  var rect = doodleCanvas.getBoundingClientRect();
  var x = event.clientX - rect.left;
  doodleKeys.left = x < rect.width / 2;
  doodleKeys.right = x >= rect.width / 2;
});

doodleCanvas.addEventListener("pointerup", function () {
  doodleKeys.left = false;
  doodleKeys.right = false;
});

doodleCanvas.addEventListener("pointerleave", function () {
  doodleKeys.left = false;
  doodleKeys.right = false;
});

requestAnimationFrame(updateDoodleGame);
