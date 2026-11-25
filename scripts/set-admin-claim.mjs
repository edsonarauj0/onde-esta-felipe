/**
 * Script para conceder a custom claim `admin: true` a uma conta do Firebase Auth.
 *
 * Uso:
 *   node --env-file=.env.local scripts/set-admin-claim.mjs felipe@exemplo.com
 */
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node --env-file=.env.local scripts/set-admin-claim.mjs <email>');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    'Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env.local.'
  );
  process.exit(1);
}

initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});

const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { admin: true });

console.log(`Claim admin: true aplicada com sucesso para ${user.email} (UID: ${user.uid}).`);
console.log('Faça logout e login novamente no app para renovar o token.');
