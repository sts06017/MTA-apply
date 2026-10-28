import { readFileSync, statSync } from 'node:fs';
import { privateDecrypt, constants } from 'node:crypto';

const privateKeyPath = process.env.MTA_PRIVATE_KEY_PATH || '/Users/dev/.mta-apply/insurance-private.pem';
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const ciphertext = Buffer.concat(chunks).toString('utf8').trim();
if (!/^[A-Za-z0-9+/]{512}$/.test(ciphertext)) {
  process.stderr.write('암호문 한 개를 표준 입력으로 전달해 주세요.\n');
  process.exit(1);
}
if ((statSync(privateKeyPath).mode & 0o077) !== 0) {
  process.stderr.write('개인키 파일 권한을 소유자만 읽을 수 있도록 설정해 주세요.\n');
  process.exit(1);
}
const result = privateDecrypt({
  key: readFileSync(privateKeyPath),
  padding: constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: 'sha256'
}, Buffer.from(ciphertext, 'base64')).toString('utf8');
if (!/^\d{13}$/.test(result)) throw new Error('복호화한 값의 형식이 올바르지 않습니다.');
process.stdout.write(result + '\n');
