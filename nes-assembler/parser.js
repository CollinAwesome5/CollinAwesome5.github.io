/**
 * parser.js - Parses 6502 NES assembly code for the assembler
 * Supports:
 * - Labels
 * - Basic 6502 instructions: NOP, LDA, STA, JMP
 * - Immediate (#xx) and zero page addressing
 * - Label resolution for jumps
 */

export function parseASM(asmText, statusEl) {
    statusEl.textContent += "Parsing ASM code...\n";

    // Clean up lines: remove comments and whitespace
    const lines = asmText.split("\n")
        .map(l => l.split(";")[0].trim())
        .filter(l => l.length > 0);

    const labels = {};
    const instructions = [];
    let pc = 0xC000; // Default start address for NROM-128 PRG

    // First pass: record label addresses
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.endsWith(":")) {
            const label = line.slice(0, -1);
            labels[label] = pc;
            statusEl.textContent += `Label found: ${label} -> ${pc.toString(16)}\n`;
        } else {
            // Estimate instruction size
            const inst = line.split(/\s+/)[0].toUpperCase();
            if (inst === "NOP") pc += 1;
            else if (inst === "LDA" || inst === "STA") pc += 2; // 1 opcode + 1 byte operand
            else if (inst === "JMP") pc += 3; // 1 opcode + 2 byte address
            else pc += 1; // default fallback
        }
    }

    statusEl.textContent += `First pass done. Labels: ${Object.keys(labels).join(", ")}\n`;

    // Second pass: convert lines to instructions with operands
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.endsWith(":")) continue; // skip labels

        const parts = line.split(/\s+/);
        const inst = parts[0].toUpperCase();
        const arg = parts[1] || null;

        instructions.push({ inst, arg, line: line });
    }

    return { instructions, labels };
}

/**
 * encodeInstructions - convert parsed instructions to bytes
 * @param {Array} instructions - output of parseASM
 * @param {Object} labels - label address mapping
 * @param {HTMLElement} statusEl - for logging
 * @returns {Uint8Array} PRG bytes
 */
export function encodeInstructions(instructions, labels, statusEl) {
    const prgBytes = [];
    const opcodeMap = {
        "NOP": 0xEA,
        "LDA": 0xA9, // immediate only
        "STA": 0x85, // zero page only
        "JMP": 0x4C  // absolute
    };

    for (let item of instructions) {
        const { inst, arg, line } = item;

        if (!(inst in opcodeMap)) {
            statusEl.textContent += `Warning: Unknown instruction '${inst}' on line "${line}", using NOP\n`;
            prgBytes.push(opcodeMap["NOP"]);
            continue;
        }

        const opcode = opcodeMap[inst];
        prgBytes.push(opcode);

        // Handle argument
        if (inst === "LDA") {
            if (arg) {
                let value = parseInt(arg.replace("#",""),16) || 0;
                prgBytes.push(value);
            } else {
                prgBytes.push(0x00);
            }
        } else if (inst === "STA") {
            if (arg) {
                let value = parseInt(arg,16) || 0;
                prgBytes.push(value);
            } else {
                prgBytes.push(0x00);
            }
        } else if (inst === "JMP") {
            if (arg in labels) {
                const addr = labels[arg];
                prgBytes.push(addr & 0xFF);       // low byte
                prgBytes.push((addr >> 8) & 0xFF); // high byte
            } else {
                statusEl.textContent += `Warning: Unknown label '${arg}' for JMP, defaulting to $C000\n`;
                prgBytes.push(0x00, 0xC0);
            }
        }
    }

    statusEl.textContent += `Encoded ${prgBytes.length} bytes of PRG code.\n`;
    return new Uint8Array(prgBytes);
}

