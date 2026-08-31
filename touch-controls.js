function isNonComputerDevice() {
  var ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  if (window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
    return true;
  }
  return false;
}

var touchControlsRoot = document.getElementById("touchControls");
var touchHoldAction = null;

function touchBtn(label, action, extraClass) {
  return '<button type="button" class="tc-btn' + (extraClass ? " " + extraClass : "") +
    '" data-action="' + action + '">' + label + "</button>";
}

function touchKey(label, action, extraClass) {
  return '<button type="button" class="tc-key' + (extraClass ? " " + extraClass : "") +
    '" data-action="' + action + '">' + label + "</button>";
}

function layoutForGame(gameName) {
  if (gameName === "spaceInvaders") {
    return '<div class="tc-pad"><div class="tc-row">' +
      touchBtn("<", "si-left") +
      touchBtn("FIRE", "si-fire", "tc-wide") +
      touchBtn(">", "si-right") +
      "</div></div>";
  }
  if (gameName === "pinballGame") {
    return '<div class="tc-pad"><div class="tc-row">' +
      touchBtn("FLIP", "pb-left", "tc-wide") +
      touchBtn("LAUNCH", "pb-launch") +
      touchBtn("FLIP", "pb-right", "tc-wide") +
      "</div></div>";
  }
  if (gameName === "mazeGame") {
    return '<div class="tc-pad">' +
      '<div class="tc-row">' + touchBtn("^", "maze-38") + "</div>" +
      '<div class="tc-row">' +
        touchBtn("<", "maze-37") +
        touchBtn("\/", "maze-40") +
        touchBtn(">", "maze-39") +
      "</div>" +
      '<div class="tc-row">' + touchBtn("NEW", "maze-78") + "</div>" +
      "</div>";
  }
  if (gameName === "doodleJump") {
    return '<div class="tc-pad"><div class="tc-row">' +
      touchBtn("<", "dj-left", "tc-wide") +
      touchBtn("RETRY", "dj-retry") +
      touchBtn(">", "dj-right", "tc-wide") +
      "</div></div>";
  }
  if (gameName === "wordle") {
    if (typeof wordleScreen !== "undefined" && wordleScreen === "menu") {
      var html = '<div class="tc-pad"><div class="tc-row">';
      for (var n = 4; n <= 10; n++) {
        html += touchBtn(n === 5 ? "5 DEF" : String(n), "wordle-len-" + n);
      }
      html += "</div></div>";
      return html;
    }
    var rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    var keys = '<div class="tc-pad">';
    for (var r = 0; r < rows.length; r++) {
      keys += '<div class="tc-keys">';
      for (var i = 0; i < rows[r].length; i++) {
        keys += touchKey(rows[r][i].toUpperCase(), "wordle-" + rows[r][i]);
      }
      keys += "</div>";
    }
    keys += '<div class="tc-keys">' +
      touchKey("ENTER", "wordle-enter", "tc-space") +
      touchKey("BACK", "wordle-back") +
      "</div></div>";
    return keys;
  }
  if (gameName === "typeSurvive") {
    var rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
    var html = '<div class="tc-pad">';
    for (var r = 0; r < rows.length; r++) {
      html += '<div class="tc-keys">';
      for (var i = 0; i < rows[r].length; i++) {
        html += touchKey(rows[r][i].toUpperCase(), "type-" + rows[r][i]);
      }
      html += "</div>";
    }
    html += '<div class="tc-keys">' +
      touchKey("SPACE", "type-space", "tc-space") +
      touchKey("BACK", "type-back") +
      "</div></div>";
    return html;
  }
  return "";
}

function isHoldAction(action) {
  return action === "si-left" || action === "si-right" ||
    action === "pb-left" || action === "pb-right" ||
    action === "dj-left" || action === "dj-right";
}

function startTouchAction(action) {
  if (action === "si-left") siGame.keyDown(37);
  else if (action === "si-right") siGame.keyDown(39);
  else if (action === "si-fire") {
    siGame.keyDown(32);
    siGame.keyUp(32);
  }
  else if (action === "pb-left") leftFlipperDown = true;
  else if (action === "pb-right") rightFlipperDown = true;
  else if (action === "pb-launch") {
    if (typeof plungeBall === "function" && ball.pos.x > LAUNCH_LANE_X && ball.pos.y < 3) {
      plungeBall();
    }
  } else if (action === "dj-left") doodleKeys.left = true;
  else if (action === "dj-right") doodleKeys.right = true;
  else if (action === "dj-retry") {
    if (!doodleAlive) resetDoodleGame();
  } else if (action.indexOf("maze-") === 0) {
    mazeHandleKey(parseInt(action.slice(5), 10));
  } else if (action === "type-space") {
    if (typeScreen === "over") startTypeGame(typeMode);
  } else if (action === "type-back") {
    resetTypeGame();
  } else if (action.indexOf("wordle-len-") === 0) {
    startWordleGame(parseInt(action.slice(11), 10));
    updateTouchControls("wordle");
  } else if (action === "wordle-enter") {
    handleWordleKey("enter");
    if (typeof updateTouchControls === "function" && wordleScreen !== "play") {
      updateTouchControls("wordle");
    }
  } else if (action === "wordle-back") {
    handleWordleKey(wordleScreen === "over" ? "escape" : "backspace");
    if (wordleScreen === "menu") updateTouchControls("wordle");
  } else if (action.indexOf("wordle-") === 0) {
    handleWordleKey(action.slice(7));
    if (wordleScreen !== "play") updateTouchControls("wordle");
  } else if (action.indexOf("type-") === 0) {
    var letter = action.slice(5);
    if (typeScreen === "menu") typeSelectFromKey(letter);
    else if (typeScreen === "play") handleTypeKey(letter);
  }
}

function endTouchAction(action) {
  if (action === "si-left") siGame.keyUp(37);
  else if (action === "si-right") siGame.keyUp(39);
  else if (action === "si-fire") siGame.keyUp(32);
  else if (action === "pb-left") leftFlipperDown = false;
  else if (action === "pb-right") rightFlipperDown = false;
  else if (action === "dj-left") doodleKeys.left = false;
  else if (action === "dj-right") doodleKeys.right = false;
}

if (touchControlsRoot) {
  touchControlsRoot.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
}

function bindTouchPad(root) {
  var buttons = root.querySelectorAll("[data-action]");
  for (var i = 0; i < buttons.length; i++) {
    (function (btn) {
      var action = btn.getAttribute("data-action");
      var hold = isHoldAction(action);
      function down(event) {
        event.preventDefault();
        event.stopPropagation();
        if (hold) {
          touchHoldAction = action;
          btn.classList.add("tc-held");
        }
        startTouchAction(action);
      }
      function up(event) {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        btn.classList.remove("tc-held");
        if (hold && touchHoldAction === action) {
          endTouchAction(action);
          touchHoldAction = null;
        }
      }
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointerleave", up);
      btn.addEventListener("pointercancel", up);
    })(buttons[i]);
  }
}

window.addEventListener("pointerup", function () {
  if (!touchHoldAction) return;
  endTouchAction(touchHoldAction);
  touchHoldAction = null;
  var held = touchControlsRoot.querySelectorAll(".tc-held");
  for (var i = 0; i < held.length; i++) held[i].classList.remove("tc-held");
});

function updateTouchControls(gameName) {
  if (!touchControlsRoot) return;
  document.body.classList.remove("show-touch-controls", "touch-type");
  touchHoldAction = null;
  if (!isNonComputerDevice()) {
    touchControlsRoot.innerHTML = "";
    return;
  }
  if (gameName === "snakeGame" || gameName === "star" || gameName === "none" || gameName === "wordscapes") {
    touchControlsRoot.innerHTML = "";
    return;
  }
  var html = layoutForGame(gameName);
  if (!html) {
    touchControlsRoot.innerHTML = "";
    return;
  }
  touchControlsRoot.innerHTML = html;
  bindTouchPad(touchControlsRoot);
  document.body.classList.add("show-touch-controls");
  if (gameName === "typeSurvive" || gameName === "wordle") document.body.classList.add("touch-type");
}
