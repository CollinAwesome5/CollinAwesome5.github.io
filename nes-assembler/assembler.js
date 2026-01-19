/**
 * assembleNES - minimal NES assembler for browser
 * @param {string} asmText - The assembly source code
 * @param {ArrayBuffer} chrBuffer - Pattern table bytes
 * @param {HTMLElement} statusEl - Status element to write messages
 * @returns {Uint8Array} - Complete NES ROM
 */
function assembleNES(asmText, chrBuffer, statusEl) {
    statusEl.textContent += "Parsing ASM code...\n";

    // Split into lines, remove comments
    const lines = asmText.split("\n").map(l => l.split(";")[0].trim()).filter(l => l);

    // First pass: labels
    const labels = {};
    let pc = 0xC000; // PRG start for NROM-128
    let prgBytes = [];

    for (let i=0; i<lines.length; i++) {
        const line = lines[i];
        if (line.endsWith(":")) {
            // label
            const label = line.slice(0,-1);
            labels[label] = pc;
            statusEl.textContent += `Label found: ${label} -> ${pc.toString(16)}\n`;
        } else {
            // Approximate: each instruction = 1 byte for now
            pc += 1;
        }
    }

    // Second pass: convert instructions to opcodes (minimal set)
    const opcodeMap = {
        "NOP": 0xEA,
        "LDA": 0xA9,  // immediate mode only
        "STA": 0x85,  // zero page only
        "JMP": 0x4C   // absolute only
    };

    pc = 0;
    for (let line of lines) {
        if (line.endsWith(":")) continue; // skip labels
        const parts = line.split(/\s+/);
        const inst = parts[0].toUpperCase();
        const arg = parts[1] || null;

        if (!(inst in opcodeMap)) {
            statusEl.textContent += `Warning: Unknown instruction '${inst}', using NOP\n`;
            prgBytes.push(opcodeMap["NOP"]);
            pc++;
            continue;
        }

        const opcode = opcodeMap[inst];
        prgBytes.push(opcode);
        pc++;

        // Very basic argument handling
        if (inst === "LDA") {
            if (arg && arg.match(/^[0-9A-Fa-f]+$/)) {
                prgBytes.push(parseInt(arg,16));
                pc++;
            } else {
                prgBytes.push(0x00);
                pc++;
            }
        } else if (inst === "STA") {
            if (arg && arg.match(/^[0-9A-Fa-f]+$/)) {
                prgBytes.push(parseInt(arg,16));
                pc++;
            } else {
                prgBytes.push(0x00);
                pc++;
            }
        } else if (inst === "JMP") {
            if (arg in labels) {
                const addr = labels[arg];
                prgBytes.push(addr & 0xFF);       // low byte
                prgBytes.push((addr >> 8) & 0xFF); // high byte
                pc += 2;
            } else {
                prgBytes.push(0x00,0xC0); // jump to $C000 default
                pc += 2;
            }
        }
    }

    statusEl.textContent += `PRG code size: ${prgBytes.length} bytes\n`;

    // NES Header for NROM-128 (16 KB PRG, 8 KB CHR)
    const header = new Uint8Array([
        0x4E,0x45,0x53,0x1A,  // NES file signature
        1,                     // 1 PRG bank (16 KB)
        1,                     // 1 CHR bank (8 KB)
        0,0,0,0,0,0,0,0,0,0,0 // remaining header bytes
    ]);

    const prgArray = new Uint8Array(16384); // 16 KB PRG
    prgArray.set(prgBytes.slice(0,16384));

    const chrArray = new Uint8Array(8192); // 8 KB CHR
    chrArray.set(new Uint8Array(chrBuffer).slice(0,8192));

    // Combine header + PRG + CHR
    const rom = new Uint8Array(header.length + prgArray.length + chrArray.length);
    rom.set(header,0);
    rom.set(prgArray,header.length);
    rom.set(chrArray,header.length + prgArray.length);

    return rom;
}

