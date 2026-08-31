import { parseASM, encodeInstructions } from "./parser.js";

/**
 * Main NES assembler
 * Builds an NROM-128 (.nes) ROM
 */
export function assembleNES(asmText, chrBuffer, statusEl) {
    statusEl.textContent += "Assembler started...\n";

    // Parse ASM and labels
    const { instructions, labels } = parseASM(asmText, statusEl);

    // Encode instructions into PRG bytes
    const prgData = encodeInstructions(instructions, labels, statusEl);

    // NES header (NROM-128)
    const header = new Uint8Array(16);
    header.set([
        0x4E, 0x45, 0x53, 0x1A, // "NES<EOF>"
        0x01, // 1 × 16KB PRG
        0x01, // 1 × 8KB CHR
        0x00, // mapper / mirroring
        0x00, // mapper
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00
    ]);

    // PRG ROM (16KB)
    const prgROM = new Uint8Array(16384);
    prgROM.fill(0xEA); // fill with NOPs
    prgROM.set(prgData.slice(0, 16384), 0);

    // CHR ROM (8KB)
    const chrROM = new Uint8Array(8192);
    chrROM.fill(0x00);

    if (chrBuffer && chrBuffer.byteLength > 0) {
        chrROM.set(new Uint8Array(chrBuffer).slice(0, 8192));
        statusEl.textContent += "CHR loaded successfully.\n";
    } else {
        statusEl.textContent += "Warning: No CHR data, using blank tiles.\n";
    }

    // Combine into final ROM
    const rom = new Uint8Array(
        header.length + prgROM.length + chrROM.length
    );

    rom.set(header, 0);
    rom.set(prgROM, header.length);
    rom.set(chrROM, header.length + prgROM.length);

    statusEl.textContent += "ROM build complete!\n";
    statusEl.textContent += `Final ROM size: ${rom.length} bytes\n`;

    return rom;
}
