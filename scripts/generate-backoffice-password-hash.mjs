import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import process from 'node:process';

const ITERATIONS = 310_000;
const KEY_LENGTH = 32;

function toBase64Url(value) {
  return value.toString('base64url');
}

function readSecret(label) {
  if (!process.stdin.isTTY) throw new Error('Execute este script em um terminal interativo.');
  return new Promise((resolve, reject) => {
    let value = '';
    process.stderr.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Operação cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          process.stderr.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value) {
            value = value.slice(0, -1);
            process.stderr.write('\b \b');
          }
          continue;
        }
        value += character;
        process.stderr.write('*');
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('data', onData);
  });
}

try {
  const password = await readSecret('Senha do primeiro administrador: ');
  const confirmation = await readSecret('Confirme a senha: ');
  if (!password || !timingSafeEqual(createHash('sha256').update(password).digest(), createHash('sha256').update(confirmation).digest())) {
    throw new Error('As senhas estão vazias ou não coincidem.');
  }
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  process.stdout.write(`PBKDF2$SHA-256$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Não foi possível gerar o hash.'}\n`);
  process.exitCode = 1;
}
