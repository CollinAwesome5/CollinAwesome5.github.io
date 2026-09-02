#!/usr/bin/env python3
"""Generate wordscapes-levels.js from common words."""
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_PATH = ROOT / "wordscapes-levels.js"
GRID_W = 12
GRID_H = 12
VOWELS = set("aeiou")


def load_common_words():
    ns = {}
    exec((ROOT / "my_dict.py").read_text(encoding="utf-8"), ns)
    words = set()
    for key in ("easy", "medium", "hard", "long"):
        for w in ns.get(key, []):
            w = str(w).strip().lower()
            if w.isalpha() and 3 <= len(w) <= 7:
                words.add(w)
    return words


def can_make(word, bag):
    need = Counter(word)
    return all(need[ch] <= bag[ch] for ch in need)


def fits(grid, word, x, y, dx, dy, must_cross):
    cells = [(x + i * dx, y + i * dy) for i in range(len(word))]
    crossed = 0
    for i, (cx, cy) in enumerate(cells):
        if not (0 <= cx < GRID_W and 0 <= cy < GRID_H):
            return False
        existing = grid.get((cx, cy))
        if existing:
            if existing != word[i]:
                return False
            crossed += 1
        else:
            px, py = -dy, dx
            if grid.get((cx + px, cy + py)) or grid.get((cx - px, cy - py)):
                return False
    before = (x - dx, y - dy)
    after = (x + len(word) * dx, y + len(word) * dy)
    if grid.get(before) or grid.get(after):
        return False
    if must_cross and crossed == 0:
        return False
    return True


def place(grid, word, x, y, dx, dy):
    for i, ch in enumerate(word):
        grid[(x + i * dx, y + i * dy)] = ch


def find_spots(grid, word):
    spots = []
    letters = {}
    for (cx, cy), ch in grid.items():
        letters.setdefault(ch, []).append((cx, cy))
    for i, ch in enumerate(word):
        for gx, gy in letters.get(ch, []):
            spots.append((gx - i, gy, 1, 0))
            spots.append((gx, gy - i, 0, 1))
    return spots


def level_payload(board, seed):
    cells_x = []
    cells_y = []
    for item in board:
        dx = 1 if item["dir"] == "H" else 0
        dy = 1 if item["dir"] == "V" else 0
        for i in range(len(item["word"])):
            cells_x.append(item["x"] + i * dx)
            cells_y.append(item["y"] + i * dy)
    ox, oy = min(cells_x), min(cells_y)
    words = []
    for item in board:
        words.append({
            "word": item["word"],
            "x": item["x"] - ox,
            "y": item["y"] - oy,
            "dir": item["dir"],
        })
    return {"tiles": list(seed), "words": words}


def unique_enough(word):
    return len(set(word)) >= len(word) - 1


def build_level(seed, pool, rng):
    bag = Counter(seed)
    candidates = [w for w in pool if 3 <= len(w) <= len(seed) and can_make(w, bag)]
    candidates = sorted(set(candidates), key=lambda w: (-len(w), w))
    if len(candidates) < 6:
        return None
    grid = {}
    board = []
    x0 = (GRID_W - len(seed)) // 2
    y0 = GRID_H // 2
    place(grid, seed, x0, y0, 1, 0)
    board.append({"word": seed, "x": x0, "y": y0, "dir": "H"})
    used = {seed}

    for word in candidates:
        if word in used or len(board) >= 8:
            continue
        spots = find_spots(grid, word)
        rng.shuffle(spots)
        for x, y, dx, dy in spots[:60]:
            if fits(grid, word, x, y, dx, dy, True):
                place(grid, word, x, y, dx, dy)
                board.append({
                    "word": word,
                    "x": x,
                    "y": y,
                    "dir": "H" if dx else "V",
                })
                used.add(word)
                break

    if len(board) < 4:
        return None
    return level_payload(board, seed)


def main():
    pool = load_common_words()
    seeds = [
        w for w in pool
        if 5 <= len(w) <= 7
        and unique_enough(w)
        and len(set(w) & VOWELS) >= 2
    ]
    targets = [(5, 24), (6, 30), (7, 30)]
    levels = []
    used_seeds = set()
    rng = random.Random(42)
    rng.shuffle(seeds)
    for length, count in targets:
        got = 0
        for seed in seeds:
            if len(seed) != length or seed in used_seeds:
                continue
            result = build_level(seed, pool, rng)
            if not result:
                continue
            levels.append(result)
            used_seeds.add(seed)
            got += 1
            if got >= count:
                break
        print(f"built {length}: {got}")

    OUT_PATH.write_text(
        "var WORDSCAPES_LEVELS = " + json.dumps(levels, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print("levels", len(levels), "bytes", OUT_PATH.stat().st_size)


if __name__ == "__main__":
    main()
