// A tiny stack VM for make.fun's tiny-stack-vm-01 ISA v1: runs every
// /input/<id>/program.bin on its input.bin and writes stdout.bin + exit.txt.
// Node 22, no dependencies. Plain JavaScript in a .ts file.
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// opcode -> [immediate bytes, pops, pushes]; a missing opcode traps 5.
const M = {0:[0,0,0],1:[1,0,1],2:[4,0,1],3:[0,1,0],4:[0,1,2],5:[0,2,2],6:[0,2,3],7:[0,3,3],16:[0,2,1],17:[0,2,1],18:[0,2,1],19:[0,2,1],20:[0,2,1],21:[0,2,1],22:[0,2,1],23:[0,1,1],24:[0,2,1],25:[0,2,1],26:[0,2,1],27:[0,1,1],28:[0,2,1],29:[0,2,1],30:[0,2,1],32:[0,2,1],33:[0,2,1],34:[0,2,1],48:[2,0,0],49:[2,1,0],50:[2,1,0],51:[2,0,0],52:[0,0,0],64:[0,1,1],65:[0,2,0],80:[0,1,0],81:[0,1,0],82:[0,0,1],83:[0,1,0]};

// Runs one program; returns [exit code, output as a string, one char per byte].
function run(p, inp) {
  const n = p.length;
  const S = new Int32Array(256), C = new Int32Array(64), Mm = new Int32Array(256);
  let pc = 0, sp = 0, cp = 0, ip = 0, st = 0, o = '';
  for (;;) {
    // ISA "One step", in order: 1 step limit (10), 2 pc bounds (9),
    // 3 unknown opcode (5), 4 cut-off immediate (9), 5 stack checks (2, 3).
    if (st === 1000000) return [10, o];
    if (pc < 0 || pc >= n) return [9, o];
    const op = p[pc], m = M[op];
    if (!m) return [5, o];
    // No-immediate opcodes can never be cut off (pc < n was just checked).
    if (m[0] && pc + m[0] >= n) return [9, o];
    st++;
    const nx = pc + 1 + m[0];
    if (sp < m[1]) return [2, o];
    if (sp - m[1] + m[2] > 256) return [3, o];
    pc = nx;
    switch (op) {
      case 0: return [0, o];
      case 1: S[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: S[sp++] = p[nx - 4] | p[nx - 3] << 8 | p[nx - 2] << 16 | p[nx - 1] << 24; break;
      case 3: sp--; break;
      case 4: S[sp] = S[sp - 1]; sp++; break;
      case 5: { const t = S[sp - 1]; S[sp - 1] = S[sp - 2]; S[sp - 2] = t; break; }
      case 6: S[sp] = S[sp - 2]; sp++; break;
      case 7: { const a = S[sp - 3]; S[sp - 3] = S[sp - 2]; S[sp - 2] = S[sp - 1]; S[sp - 1] = a; break; }
      case 23: S[sp - 1] = -S[sp - 1]; break;
      case 27: S[sp - 1] = ~S[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = S[sp - 1], a = S[sp - 2];
        let r;
        if (op === 16) r = a + b;
        else if (op === 17) r = a - b;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return [4, o]; r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return [4, o]; r = a % b; }
        else if (op === 21) { if (!b) return [4, o]; r = Math.floor((a >>> 0) / (b >>> 0)); }
        else if (op === 22) { if (!b) return [4, o]; r = (a >>> 0) % (b >>> 0); }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = a >>> (b & 31);
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; S[sp++] = r; break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | p[nx - 1] << 8) << 16) >> 16;
        let take = op === 48;
        if (op !== 48) { const v = S[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51: if (cp === 64) return [7, o]; C[cp++] = nx; pc = p[nx - 2] | p[nx - 1] << 8; break;
      case 52: if (!cp) return [8, o]; pc = C[--cp]; break;
      case 64: { const a = S[sp - 1]; if (a < 0 || a > 255) return [6, o]; S[sp - 1] = Mm[a]; break; }
      case 65: { const a = S[sp - 1], v = S[sp - 2]; if (a < 0 || a > 255) return [6, o]; sp -= 2; Mm[a] = v; break; }
      case 80: { const s = String(S[sp - 1]); if (o.length + s.length > 65536) return [11, o]; sp--; o += s; break; }
      case 81: if (o.length + 1 > 65536) return [11, o]; o += String.fromCharCode(S[--sp] & 255); break;
      case 82: S[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return [S[--sp] & 255, o];
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const d = join(I, id), od = join(O, id);
  mkdirSync(od, { recursive: true });
  const [e, o] = run(readFileSync(join(d, 'program.bin')), readFileSync(join(d, 'input.bin')));
  writeFileSync(join(od, 'stdout.bin'), Buffer.from(o, 'latin1'));
  writeFileSync(join(od, 'exit.txt'), String(e));
}
