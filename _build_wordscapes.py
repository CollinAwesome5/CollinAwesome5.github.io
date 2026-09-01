#!/usr/bin/env python3
"""Generate 20,000 Wordscapes levels in wordscapes-levels/ (100 per file)."""
import json
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT_DIR = ROOT / "wordscapes-levels"
GRID = 16
VOWELS = set("aeiou")
TOTAL = 20000
CHUNK = 100
MIN_WORDS = 10


def load_pool():
    words = set()
    ns = {}
    exec((ROOT / "my_dict.py").read_text(encoding="utf-8"), ns)
    for key in ("easy", "medium", "hard", "long"):
        for w in ns.get(key, []):
            w = str(w).strip().lower()
            if w.isalpha() and 3 <= len(w) <= 8:
                words.add(w)
    type_path = ROOT / "type-words-data.js"
    if type_path.exists():
        raw = type_path.read_text(encoding="utf-8")
        data = json.loads(raw.split("=", 1)[1].strip().rstrip(";"))
        for key in ("easy", "medium"):
            for w in data.get(key, []):
                if w.isalpha() and 3 <= len(w) <= 8:
                    words.add(w)
    for extra in ("deli", "ent", "wars", "raws", "ears", "likes"):
        if extra.isalpha():
            words.add(extra)
    plurals = set()
    for w in words:
        if not w.endswith("s") and 3 <= len(w) + 1 <= 8:
            plurals.add(w + "s")
    words |= plurals
    return words


def can_make(word, bag):
    need = Counter(word)
    return all(need[ch] <= bag[ch] for ch in need)


def fits(grid, word, x, y, dx, dy, must_cross):
    crossed = 0
    for i, ch in enumerate(word):
        cx, cy = x + i * dx, y + i * dy
        if not (0 <= cx < GRID and 0 <= cy < GRID):
            return False
        existing = grid.get((cx, cy))
        if existing:
            if existing != ch:
                return False
            crossed += 1
        else:
            px, py = -dy, dx
            if grid.get((cx + px, cy + py)) or grid.get((cx - px, cy - py)):
                return False
    if grid.get((x - dx, y - dy)) or grid.get((x + len(word) * dx, y + len(word) * dy)):
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


def tiles_for(seed, board):
    bag = Counter(seed)
    for item in board:
        need = Counter(item["word"])
        for ch, n in need.items():
            if n > bag[ch]:
                bag[ch] = n
    tiles = []
    if bag["s"] < 1:
        bag["s"] = 1
    bag["s"] += 1
    for ch, n in bag.items():
        tiles.extend([ch] * n)
    return tiles


def payload(board, tiles):
    xs, ys = [], []
    for item in board:
        dx = 1 if item["dir"] == "H" else 0
        dy = 1 if item["dir"] == "V" else 0
        for i in range(len(item["word"])):
            xs.append(item["x"] + i * dx)
            ys.append(item["y"] + i * dy)
    ox, oy = min(xs), min(ys)
    return {
        "tiles": tiles,
        "words": [
            {
                "word": item["word"],
                "x": item["x"] - ox,
                "y": item["y"] - oy,
                "dir": item["dir"],
            }
            for item in board
        ],
    }


def build_level(seed, pool, rng, target_words, prefer_long):
    bag = Counter(seed)
    bag["s"] += 1
    extras = "aeioulnrst"
    for ch in extras:
        if len(bag) < 8 and rng.random() < 0.25:
            bag[ch] += 1
    candidates = [w for w in pool if 3 <= len(w) <= 8 and can_make(w, bag)]
    if prefer_long:
        candidates.sort(key=lambda w: (-len(w), w))
    else:
        candidates.sort(key=lambda w: (len(w), w))
    if len(candidates) < target_words:
        return None
    grid = {}
    board = []
    x0 = max(0, (GRID - len(seed)) // 2)
    y0 = GRID // 2
    place(grid, seed, x0, y0, 1, 0)
    board.append({"word": seed, "x": x0, "y": y0, "dir": "H"})
    used = {seed}

    def try_place(word):
        spots = find_spots(grid, word)
        rng.shuffle(spots)
        for x, y, dx, dy in spots[:80]:
            if fits(grid, word, x, y, dx, dy, True):
                place(grid, word, x, y, dx, dy)
                board.append({
                    "word": word,
                    "x": x,
                    "y": y,
                    "dir": "H" if dx else "V",
                })
                used.add(word)
                return True
        return False

    for word in candidates:
        if word in used:
            continue
        if len(board) >= target_words + 4:
            break
        try_place(word)

    if len(board) < target_words:
        for word in candidates:
            if word in used:
                continue
            if try_place(word) and len(board) >= target_words:
                break

    if len(board) < target_words:
        return None
    tiles = tiles_for(seed, board)
    return payload(board, tiles)


def seed_length(index):
    t = index / TOTAL
    if t < 0.12:
        return 5 if index % 5 else 6
    if t < 0.35:
        return 6 if index % 4 else 5
    if t < 0.65:
        return 7 if index % 3 else 6
    if t < 0.85:
        return 7 if index % 5 else 8
    return 8 if index % 4 else 7


def main():
    pool = load_pool()
    by_len = {}
    for w in pool:
        by_len.setdefault(len(w), []).append(w)
    for lst in by_len.values():
        lst.sort()

    OUT_DIR.mkdir(exist_ok=True)
    existing_chunks = sorted(OUT_DIR.glob("*.json"))
    start_index = len(existing_chunks) * CHUNK
    rng = random.Random(2027 + start_index)
    levels = []
    used_seeds = set()
    attempts = 0
    index = start_index
    while index < TOTAL and attempts < (TOTAL - start_index + 1) * 40:
        attempts += 1
        length = seed_length(index)
        choices = [w for w in by_len.get(length, []) if w not in used_seeds]
        if len(choices) < 20:
            used_seeds.clear()
            choices = list(by_len.get(length, []))
        if not choices:
            continue
        seed = rng.choice(choices)
        used_seeds.add(seed)
        target = MIN_WORDS + (2 if index > 8000 else 0) + (2 if index > 15000 else 0)
        prefer_long = (index % 7 != 0) if index > 3000 else (index % 4 == 0)
        result = build_level(seed, pool, rng, target, prefer_long)
        if not result:
            result = build_level(seed, pool, rng, MIN_WORDS, False)
        if not result:
            continue
        levels.append(result)
        index += 1
        if index % 500 == 0:
            print(f"built {index}/{TOTAL}")

    need = TOTAL - start_index
    if len(levels) < need:
        print(f"only built {len(levels)}, repeating with variation")
        i = 0
        while len(levels) < need:
            src = dict(levels[i % max(1, len(levels))])
            tiles = list(src["tiles"])
            rng.shuffle(tiles)
            src = {"tiles": tiles, "words": src["words"]}
            levels.append(src)
            i += 1

    for offset, part_start in enumerate(range(0, len(levels), CHUNK)):
        chunk_num = (start_index // CHUNK) + offset + 1
        part = levels[part_start:part_start + CHUNK]
        path = OUT_DIR / f"{chunk_num:03d}.json"
        path.write_text(json.dumps(part, separators=(",", ":")), encoding="utf-8")
    print("wrote", start_index + len(levels), "levels in", OUT_DIR)


if __name__ == "__main__":
    main()
