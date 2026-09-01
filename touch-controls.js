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
var mobileTextInput = document.getElementById("mobileTextInput");

function touchBtn(label, action, extraClass) {
  return '<button type="button" class="tc-btn' + (extraClass ? " " + extraClass : "") +
    '" data-action="' + action + '">' + label + "</button>";
}

function touchKey(label, action, extraClass) {
  return '<button type="button" class="tc-key' + (extraClass ? " " + extraClass : "") +
    '" data-action="' + action + '">' + label + "</button>";
}

function letterKeyboard(prefix, extraRow) {
  var rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  var html = '<div class="tc-pad">';
  for (var r = 0; r < rows.length; r++) {
    html += '<div class="tc-keys">';
    for (var i = 0; i < rows[r].length; i++) {
      html += touchKey(rows[r][i].toUpperCase(), prefix + rows[r][i]);
    }
    html += "</div>";
  }
  html += '<div class="tc-keys">' + extraRow + "</div></div>";
  return html;
}

function layoutForGame(gameName) {
  if (gameName === "pinballGame") {
    return '<div class="tc-pad"><div class="tc-row">' +
      touchBtn("FLIP", "pb-left", "tc-wide") +
      touchBtn("LAUNCH", "pb-launch") +
      touchBtn("FLIP", "pb-right", "tc-wide") +
      "</div></div>";
  }
  if (gameName === "mazeGame") {
    return '<div class="tc-pad"><div class="tc-row">' + touchBtn("NEW", "maze-78") + "</div></div>";
  }
  if (gameName === "doodleJump") {
    return '<div class="tc-pad"><div class="tc-row">' +
      touchBtn("LEFT", "dj-left", "tc-wide") +
      touchBtn("RETRY", "dj-retry") +
      touchBtn("RIGHT", "dj-right", "tc-wide") +
      "</div></div>";
  }
  if (gameName === "wordle") {
    if (typeof wordleScreen !== "undefined" && wordleScreen === "menu") {
      var html = '<div class="tc-pad"><div class="tc-row">' + touchBtn("LEAVE", "wordle-leave") + "</div><div class=\"tc-row\">";
      for (var n = 4; n <= 10; n++) html += touchBtn(String(n), "wordle-len-" + n);
      html += "</div></div>";
      return html;
    }
    var extra = touchKey("ENTER", "wordle-enter", "tc-space") +
      touchKey("BACK", "wordle-back") +
      touchKey("NEW", "wordle-new") +
      touchKey("LEAVE", "wordle-leave") +
      touchKey("LETTERS", "wordle-letters");
    return letterKeyboard("wordle-", extra);
  }
  if (gameName === "typeSurvive") {
    return letterKeyboard("type-", touchKey("SPACE", "type-space", "tc-space") + touchKey("BACK", "type-back"));
  }
  return "";
}

function isHoldAction(action) {
  return action === "pb-left" || action === "pb-right" ||
    action === "dj-left" || action === "dj-right";
}

function startTouchAction(action) {
  if (action === "pb-left") leftFlipperDown = true;
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
    if (wordleScreen !== "play") updateTouchControls("wordle");
  } else if (action === "wordle-back") {
    handleWordleKey(wordleScreen === "over" ? "escape" : "backspace");
    if (wordleScreen === "menu") updateTouchControls("wordle");
  } else if (action === "wordle-new") {
    startWordleGame(wordleLen);
    updateTouchControls("wordle");
  } else if (action === "wordle-leave") {
    if (typeof wordleScreen !== "undefined" && wordleScreen === "menu" && typeof setActiveGame === "function") {
      setActiveGame("none");
    } else if (typeof wordleQuitPuzzle === "function") {
      wordleQuitPuzzle();
      updateTouchControls("wordle");
    } else {
      resetWordleGame();
      updateTouchControls("wordle");
    }
  } else if (action === "wordle-letters") {
    if (typeof wordleQuitPuzzle === "function") wordleQuitPuzzle();
    else resetWordleGame();
    updateTouchControls("wordle");
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
  if (action === "pb-left") leftFlipperDown = false;
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
  if (!touchControlsRoot) return;
  var held = touchControlsRoot.querySelectorAll(".tc-held");
  for (var i = 0; i < held.length; i++) held[i].classList.remove("tc-held");
});

function focusMobileKeyboard(gameName) {
  if (!mobileTextInput || !isNonComputerDevice()) return;
  if (gameName !== "wordle" && gameName !== "typeSurvive") {
    mobileTextInput.blur();
    return;
  }
  mobileTextInput.value = "";
  mobileTextInput.focus();
}

if (mobileTextInput) {
  mobileTextInput.addEventListener("input", function () {
    var text = (mobileTextInput.value || "").toLowerCase();
    mobileTextInput.value = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch < "a" || ch > "z") continue;
      if (activeGame === "wordle") handleWordleKey(ch);
      else if (activeGame === "typeSurvive") {
        if (typeScreen === "menu") typeSelectFromKey(ch);
        else if (typeScreen === "play") handleTypeKey(ch);
      }
    }
  });
  mobileTextInput.addEventListener("keydown", function (event) {
    if (activeGame === "wordle") {
      if (event.key === "Enter") handleWordleKey("enter");
      if (event.key === "Backspace") handleWordleKey("backspace");
      if (event.key === "Escape") handleWordleKey("escape");
    } else if (activeGame === "typeSurvive") {
      if (event.key === "Escape") resetTypeGame();
      if (event.key === " " && typeScreen === "over") startTypeGame(typeMode);
    }
  });
}

function bindSiPhoneControls() {
  var fire = document.getElementById("siFireBtn");
  var slider = document.getElementById("siMoveSlider");
  if (fire && !fire.getAttribute("data-bound")) {
    fire.setAttribute("data-bound", "1");
    fire.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      if (typeof siGame !== "undefined") {
        siGame.keyDown(32);
        siGame.keyUp(32);
      }
    });
  }
  if (slider && !slider.getAttribute("data-bound")) {
    slider.setAttribute("data-bound", "1");
    slider.addEventListener("input", function () {
      var state = typeof siGame !== "undefined" ? siGame.currentState() : null;
      if (!state || !state.ship || !siGame.gameBounds) return;
      var t = Number(slider.value) / 100;
      state.ship.x = siGame.gameBounds.left + (siGame.gameBounds.right - siGame.gameBounds.left) * t;
    });
  }
}

function updateTouchControls(gameName) {
  document.body.classList.toggle("phone-wide", isNonComputerDevice());
  if (!touchControlsRoot) return;
  document.body.classList.remove("show-touch-controls", "touch-type");
  touchHoldAction = null;
  bindSiPhoneControls();
  focusMobileKeyboard(gameName);
  if (!isNonComputerDevice()) {
    touchControlsRoot.innerHTML = "";
    return;
  }
  if (gameName === "snakeGame" || gameName === "star" || gameName === "none" ||
      gameName === "wordscapes" || gameName === "spaceInvaders") {
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

if (isNonComputerDevice()) document.body.classList.add("phone-wide");
bindSiPhoneControls();
