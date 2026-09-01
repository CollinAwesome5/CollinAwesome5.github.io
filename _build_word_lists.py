#!/usr/bin/env python3
"""Build type-words-data.js: common easy/medium words, no abbreviations anywhere."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DICT_PATH = Path("/usr/share/dict/words")
MY_DICT_PATH = ROOT / "my_dict.py"
OUT_PATH = ROOT / "type-words-data.js"
WORDLE_PATH = ROOT / "wordle-words.js"

EXTRA_WORDS = {
    "deli", "ent", "wars", "raws", "ears",
}

# Obvious 3-letter abbreviations / codes, not everyday words.
THREE_LETTER_ABBREVS = {
    "eta", "etc", "rea", "ass", "aka", "api", "app", "atm", "avg",
    "bbc", "bmw", "btw", "cbs", "ceo", "cfg", "cia", "cnn",
    "com", "cpu", "css", "cvs", "dea", "dhs", "dna", "dob", "dod",
    "dsl", "edt", "edu", "esc", "eur", "faq", "fbi", "ftp",
    "gdp", "gif", "gmt", "gnu", "gov", "gps", "gpu", "hrs",
    "ibm", "idk", "imo", "inc", "ins", "ios", "irs", "iso",
    "jpg", "lcd", "lib", "lol", "ltd", "mba", "mlb", "mms",
    "msg", "msn", "nba", "nbc", "nfl", "nhl", "nsa", "num",
    "omg", "org", "pda", "pdf", "phd", "png", "psp", "qty",
    "rom", "rpm", "rss", "sms", "sql", "src", "ssn", "std",
    "tba", "tbd", "txt", "url", "usb", "usd", "usr", "utc",
    "vip", "vol", "vpn", "www", "xls", "xml", "yrs",
    "jan", "feb", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    "mrs", "ref", "fwd", "tmp", "cfg", "sys", "bin", "dll",
}

# Whole-word blocklist (lowercase). Variants with common suffixes are also dropped.
BLOCKED = {
    "anal", "anus", "arse", "asses", "asshole", "assholes",
    "bastard", "bastards", "bitch", "bitches", "bitchy", "bollocks", "boob",
    "boobs", "bugger", "bullshit", "clit", "clitoris", "cock", "cocks",
    "cocksucker", "crap", "cum", "cunt", "cunts", "damn", "damned", "dick",
    "dicks", "dildo", "dildos", "dyke", "fag", "faggot", "faggots", "fags",
    "feck", "felch", "fellate", "fellatio", "fuck", "fucked", "fucker",
    "fuckers", "fucking", "fucks", "goddamn", "hell", "homo", "horny",
    "jackoff", "jerkoff", "jizz", "kike", "labia", "lmfao", "muff", "nazi",
    "nigga", "nigger", "niggers", "nutsack", "orgasm", "orgasms", "penis",
    "piss", "pissed", "pisses", "porn", "porno", "pornography",
    "prick", "pube", "pubes", "pussy", "queer", "rectum", "retard",
    "retarded", "rimjob", "sex", "sexual", "sexually", "sexy", "shit", "shits",
    "shitty", "slut", "sluts", "smegma", "spunk", "tit", "tits", "titties",
    "turd", "twat", "vagina", "wank", "wanker", "whore", "whores", "wtf",
    "chink", "coon", "gook", "jap", "kike", "spic", "wetback", "tranny",
    "shemale", "beaner", "paki", "gypsy", "redskin", "darkie", "cracker",
    "honky", "gringo", "squaw", "spook", "towelhead",
    "sperm", "semen", "ejaculate", "ejaculation", "erection", "boner",
    "handjob", "blowjob", "blowjobs", "handjobs", "masturbate",
    "masturbation", "xxx", "doggystyle",
    "threesome", "orgy", "incest", "bestiality", "pedo", "pedophile",
    "paedophile", "rape", "raped", "rapist", "raping", "molest",
    "molestation", "molester", "genitals", "genital", "testicle", "testicles",
    "scrotum", "pornographic", "erotic", "erotica", "intercourse",
    "fart", "farts", "farted", "poop", "poops", "pee",
    "ass", "butt", "butts", "suck", "sucks",
}

SUFFIXES = ("s", "es", "ed", "er", "ers", "ing", "ings", "y", "ies", "ier", "iest")

EXTRA_BLOCK = {
    "shat", "shite", "shithead", "dickhead", "dumbass", "jackass", "smartass",
    "badass", "hardass", "kickass", "asshat", "asswipe", "buttplug",
    "buttfuck", "motherfucker", "motherfuckers", "motherfucking",
    "fuckwit", "fuckhead", "shitface", "shitstorm", "clusterfuck",
    "cocksucking", "cocksuckers", "bullshitting", "horseshit",
    "dipshit", "chickenshit", "apeshit", "batshit", "holyfuck",
    "fuckboy", "fuckboys", "fuckup", "fuckups", "fucktard",
    "shitless", "shittier", "shittiest", "bitching", "bitchier",
    "niggard", "niggardly",
    "raper", "rapists", "rapes", "sexuality",
    "bloody", "bloodied",
}

# Abbreviations, acronyms, initialisms, and clipped forms that are not
# everyday full words. Applied to every difficulty.
ABBREVS = {
    # titles / honorifics
    "mr", "mrs", "ms", "miss", "dr", "prof", "sr", "jr", "rev", "hon",
    "st", "rd", "ave", "blvd", "hwy", "rte", "apt", "dept", "inc", "ltd",
    "corp", "co", "llc", "assn", "acct", "amt", "approx", "est", "qty",
    "recd", "tel", "fax", "vol", "chap", "pp", "pg", "fig", "eq",
    # time / dates
    "am", "pm", "bc", "ad", "ce", "bce", "gmt", "utc", "est", "edt",
    "cst", "cdt", "mst", "mdt", "pst", "pdt", "jan", "feb", "mar", "apr",
    "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
    "mon", "tue", "tues", "wed", "thu", "thur", "thurs", "fri", "sat", "sun",
    # common shortenings
    "vs", "etc", "ie", "eg", "aka", "ok", "okay", "tv", "pc", "cd", "dvd",
    "id", "iq", "ok", "info", "pic", "pics", "pics", "app", "apps",
    "min", "mins", "max", "sec", "secs", "hr", "hrs", "yr", "yrs",
    "lb", "lbs", "oz", "kg", "km", "cm", "mm", "ft", "in",
    "no",  # "number" abbreviation — keep as word? "no" is also a word. KEEP as word.
    # tech / orgs / codes
    "dna", "rna", "hiv", "aids", "ceo", "cfo", "cio", "cto", "coo",
    "cpu", "gpu", "ram", "rom", "usb", "pdf", "jpg", "jpeg", "gif", "png",
    "html", "css", "http", "https", "www", "url", "uri", "api", "sql",
    "php", "xml", "json", "faq", "asap", "diy", "lol", "omg", "btw",
    "imo", "idk", "brb", "ttyl", "imo", "fyi", "tba", "tbd", "eta",
    "nba", "nfl", "mlb", "nhl", "ncaa", "fifa", "ufc",
    "fbi", "cia", "nsa", "irs", "ssa", "dod", "dhs", "dea", "atf",
    "nasa", "un", "eu", "uk", "usa", "ussr", "nato", "who",  # who is also a word — KEEP
    "gdp", "ssn", "dob", "po", "aka", "aka",
    "alt", "ctrl", "esc", "del", "ins", "num",
    "gps", "lcd", "led",  # led is also a verb — KEEP led
    "hdtv", "wifi", "wi", "fi",
    "vip", "rsvp", "ps", "pps", "cc", "bcc",
    "phd", "ba", "bs", "ma", "mba", "md", "dds", "jd",
    "usa", "uk", "uae", "uss",
    "ibm", "att", "aol", "msn", "bbc", "cnn", "abc", "nbc", "cbs", "espn",
    "vhs", "hd", "sd", "kb", "mb", "gb", "tb",
    "rpm", "mph", "kph", "mpg",
    "avg", "std", "var", "misc", "temp", "admin", "cfg", "config",
    "msg", "msgs", "txt", "sms", "mms",
    "ref", "refs", "ed", "eds", "anon",
    "gov", "org", "edu", "com", "net",
    "re", "fwd", "fw",
    "wpm", "rpm",
    "atm", "pin", "ssn",
    "kgb", "ss",
    "nyc", "la", "dc", "sf",
    "am", "fm",
    "ac", "dc",
    "pr", "hr", "it",  # it is a word — KEEP
    "vp", "svp", "evp",
    "usaid", "unicef",
    "isbn", "issn",
    "ascii", "unicode",
    "jpeg", "mpeg", "mp3", "mp4", "wav", "avi",
    "os", "ios", "macos", "win",
    "ui", "ux",
    "ai", "ml",
    "vr", "ar",
    "qr",
    "ip", "isp", "lan", "wan", "vpn",
    "pdf",
    "doc", "xls", "ppt",
    "aka",
    "wrt", "nb",
    "ca", "ny", "tx", "fl", "il", "pa", "oh", "ga", "nc", "mi",
    "al", "ak", "az", "ar", "co", "ct", "de", "hi", "id", "in",  # in is a word
    "ia", "ks", "ky", "la", "me", "md", "ma", "mn", "ms", "mo",
    "mt", "ne", "nv", "nh", "nj", "nm", "nd", "ok", "or",  # or is a word
    "ri", "sc", "sd", "tn", "ut", "vt", "va", "wa", "wv", "wi", "wy",
}

# "no", "who", "it", "or", "in", "led", "me", "ma" need care.
# Keep real everyday words even if they overlap an abbreviation.
KEEP_AS_WORDS = {
    "a", "i",
    "ah", "am", "an", "as", "at", "ax", "be", "by",
    "do", "go", "ha", "he", "hi", "if", "in", "is", "it",
    "me", "my", "no", "of", "oh", "on", "or", "ox",
    "so", "to", "up", "us", "we",
    "who", "led", "may", "march", "august",
    "miss",
    "ent", "deli", "wars", "raws", "ears",
}

# Everyday 2-letter words only. Everything else that short is an abbrev or obscure.
TWO_LETTER_WORDS = {
    "ah", "am", "an", "as", "at", "ax", "be", "by",
    "do", "go", "ha", "he", "hi", "if", "in", "is", "it",
    "me", "my", "no", "of", "oh", "on", "or", "ox",
    "so", "to", "up", "us", "we",
}

# Extra clipped / slang abbreviations that show up in common-word lists.
MORE_ABBREVS = {
    "ok", "okay", "tv", "vs", "etc", "ie", "eg", "mr", "mrs", "ms", "dr",
    "pm", "am",  # "am" kept via KEEP_AS_WORDS
    "pc", "cd", "dvd", "dna", "rna", "ceo", "cfo", "cio",
    "lab",  # short for laboratory — commonly a word; KEEP
    "ad", "ads",  # advertisement
    "promo", "info", "pic", "pics", "app", "apps",
    "tech", "bio", "chem", "sci", "maths",
    "univ", "coll", "acct",
    "govt", "intl", "natl", "assoc",
    "blvd", "ave", "hwy",
    "approx", "est",
    "misc", "temp",
    "admin", "config",
    "msg", "txt",
    "ref",
    "anon",
    "pls", "plz", "thx", "ty",
    "bc", "cuz", "cos",
    "w", "u", "ur", "r",
    "im", "ive", "id", "ill",  # contractions without apostrophe; ill is a word
    "dont", "cant", "wont", "isnt", "arent", "wasnt", "werent",
    "hasnt", "havent", "hadnt", "doesnt", "didnt", "shouldnt",
    "wouldnt", "couldnt", "mustnt",
    "lets",
    "gonna", "wanna", "gotta", "kinda", "sorta", "outta",
    "yall", "yalls",
    "lol", "lmao", "omg", "wtf", "brb", "idk", "imo", "imho",
    "fyi", "asap", "diy", "aka", "tba", "tbd",
    "usa", "uk", "eu",
    "nba", "nfl", "mlb", "nhl",
    "fbi", "cia", "nasa",
    "phd", "mba", "md",
    "html", "css", "http", "www",
    "pdf", "jpg", "gif",
    "usb", "cpu", "gpu", "ram", "rom",
    "hiv", "aids",
    "vip", "rsvp",
    "atm", "pin",
    "gps",
    "wifi",
    "avg",
    "max", "min",
    "hr", "hrs", "yr", "yrs",
    "lb", "oz",
    "un",
    "re",
    "ps",
    "cc",
    "inc", "ltd", "corp",
    "dept",
    "st",
    "rd",
    "fl",
    "pt",  # pint / point / part
    "qt",
    "gal",
    "cm", "mm", "km", "kg",
    "rpm", "mph",
    "est",
    "jan", "feb", "aug", "sept", "oct", "nov", "dec",
    "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    "sr", "jr",
    "rev",
    "hon",
    "prof",
    "sgt", "cpl", "lt", "col", "gen", "adm",
    "bros",
    "co",
}

# Keep these even if they appear in MORE_ABBREVS / ABBREVS.
KEEP_AS_WORDS |= {
    "am", "no", "who", "it", "or", "in", "led", "may",
    "march", "august", "miss", "ill", "math",
    "gal",  # girl informal — skip, it's also gallon abbrev. Exclude gal.
    "pt",  # skip
    "fl",  # skip
    "co",  # skip
    "re",  # skip
    "un",  # skip
}

KEEP_AS_WORDS.discard("gal")
KEEP_AS_WORDS.discard("pt")
KEEP_AS_WORDS.discard("fl")
KEEP_AS_WORDS.discard("co")
KEEP_AS_WORDS.discard("re")
KEEP_AS_WORDS.discard("un")

# Prefixes / clippings / web junk that are not everyday full words.
JUNK = {
    "acc", "anti", "auto", "beta", "blog", "cds", "char", "cnet", "con",
    "lab",
    "cvs", "demo", "der", "des", "dev", "diff", "dsl", "dvds", "ebay",
    "eur", "faqs", "gnu", "iii", "int", "ipod", "iso", "lib", "los",
    "mac", "mens", "mini", "non", "para", "pcs", "pda", "perl", "pmid",
    "pre", "prev", "pro", "psp", "pub", "que", "res", "rss", "sony",
    "src", "sub", "und", "unix", "ups", "usd", "usr", "via", "voip",
    "von", "xbox", "zum", "cnet", "faqs", "iso",
    "ad", "ads", "app", "apps", "pic", "pics", "info", "promo",
    "tech", "bio", "cfg", "config", "admin", "msg", "txt",
    "mysql", "phpbb", "xhtml", "html", "http", "https",
    "cached", "cialis", "cheats", "bytes", "avatar", "adobe",
    "alerts", "autos", "coding",
}

# Proper names / brands / places — fine for hard, not for easy/medium.
NAMES = {
    "arab", "arabia", "jew", "jewish",
}

# 3+ letter words with no vowel that are still real English.
NO_VOWEL_OK = {"dry", "fly", "gym", "hymn", "myth", "sky", "spy", "try", "why"}

def expand_blocked():
    blocked = set(BLOCKED)
    blocked |= EXTRA_BLOCK
    extra = set()
    for word in list(blocked):
        for suffix in SUFFIXES:
            extra.add(word + suffix)
        if word.endswith("e"):
            extra.add(word[:-1] + "ing")
            extra.add(word[:-1] + "ed")
        if word.endswith("y"):
            extra.add(word[:-1] + "ies")
            extra.add(word[:-1] + "ied")
    blocked |= extra
    return blocked


def has_vowel(word):
    return any(c in word for c in "aeiou")


def is_abbrev(word):
    if word in KEEP_AS_WORDS:
        return False
    if word in THREE_LETTER_ABBREVS:
        return True
    if word in ABBREVS or word in MORE_ABBREVS or word in JUNK:
        return True
    if len(word) == 1 and word not in {"a", "i"}:
        return True
    if len(word) == 2 and word not in TWO_LETTER_WORDS:
        return True
    if len(word) >= 3 and not has_vowel(word) and word not in NO_VOWEL_OK:
        return True
    return False


def load_my_dict_lists():
    """Original curated everyday lists from my_dict.py."""
    ns = {}
    exec(MY_DICT_PATH.read_text(encoding="utf-8"), ns)
    def clean(items):
        out = []
        for w in items:
            w = str(w).strip().lower()
            if looks_like_word(w):
                out.append(w)
        return out
    return {
        "easy": clean(ns.get("easy", [])),
        "medium": clean(ns.get("medium", [])),
    }


def looks_like_word(word):
    return bool(re.fullmatch(r"[a-z]+", word))


def load_dictionary():
    words = set()
    for line in DICT_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        w = line.strip().lower()
        if looks_like_word(w):
            words.add(w)
    return words


def main():
    blocked = expand_blocked()
    dictionary = load_dictionary()
    original = load_my_dict_lists()

    def allowed(word):
        return word not in blocked and not is_abbrev(word)

    def simple_enough(word):
        return word not in NAMES

    easy = {
        w for w in original["easy"]
        if allowed(w) and simple_enough(w) and 2 <= len(w) <= 4
    }
    easy |= {w for w in TWO_LETTER_WORDS if allowed(w)}
    easy = sorted(easy)
    medium = sorted({
        w for w in original["medium"]
        if allowed(w) and simple_enough(w) and 5 <= len(w) <= 6
    })
    hard = sorted(w for w in dictionary if allowed(w) and 7 <= len(w) <= 8)
    long = sorted(w for w in dictionary if allowed(w) and 9 <= len(w) <= 14)

    # All mode uses the four buckets; keep hard/long large but clean.
    lists = {
        "easy": easy,
        "medium": medium,
        "hard": hard,
        "long": long,
    }

    leftover_abbrevs = []
    for name, bucket in lists.items():
        leftover_abbrevs.extend((name, w) for w in bucket if is_abbrev(w))

    out = "var TYPE_WORD_LISTS = " + json.dumps(lists, separators=(",", ":")) + ";\n"
    OUT_PATH.write_text(out, encoding="utf-8")

    for extra in EXTRA_WORDS:
        if allowed(extra):
            if 2 <= len(extra) <= 4:
                if extra not in easy:
                    easy.append(extra)
                    easy.sort()
            elif 5 <= len(extra) <= 6:
                if extra not in medium:
                    medium.append(extra)
                    medium.sort()
            dictionary.add(extra)

    wordle = {str(n): [] for n in range(3, 11)}
    base = set()
    for w in dictionary:
        if 3 <= len(w) <= 10 and allowed(w):
            wordle[str(len(w))].append(w)
            base.add(w)
    for extra in EXTRA_WORDS:
        if 3 <= len(extra) <= 10 and allowed(extra) and extra not in base:
            wordle[str(len(extra))].append(extra)
            base.add(extra)
    for w in list(base):
        plural = w + "s"
        if 3 <= len(plural) <= 10 and allowed(plural) and plural not in base:
            wordle[str(len(plural))].append(plural)
            base.add(plural)
    for key in wordle:
        wordle[key] = sorted(set(wordle[key]))
    WORDLE_PATH.write_text(
        "var WORDLE_ANSWERS = " + json.dumps(wordle, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )

    print("counts:")
    for name, bucket in lists.items():
        print(f"  {name}: {len(bucket)}")
    print(f"  leftover abbreviations: {len(leftover_abbrevs)}")
    if leftover_abbrevs[:20]:
        print("  sample leftovers:", leftover_abbrevs[:20])
    print("easy sample:", " ".join(easy[:40]))
    print("medium sample:", " ".join(medium[:30]))
    print("wordle:")
    for key in wordle:
        print(f"  {key}: {len(wordle[key])}")
    print("  irate in 5:", "irate" in wordle["5"])


if __name__ == "__main__":
    main()
