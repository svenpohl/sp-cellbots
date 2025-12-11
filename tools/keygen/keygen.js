// tools/keygen/keygen.js
// Universal key generator for HMAC, Ed25519, and RSA
// Sven Pohl © 2025 — MIT License

const signature_class = require('../../common/signature/signature_class');
const sig = new signature_class();

function printKeyBlock(title, data) {
  console.log(`\n=== ${title} ===`);
  for (const [k, v] of Object.entries(data)) {
    console.log(`${k}:`);
    console.log(v);
    console.log('');
  }
}

// --- HMAC (SIG=01) ---
const hmac = sig.create_keypair_or_secret(sig.SIG_HMAC);
printKeyBlock('HMAC (SIG=01)', {
  SHARED_SECRET: hmac.PUBLIC_KEY_OR_SECRET
});

// --- ED25519 (SIG=02) ---
const ed = sig.create_keypair_or_secret(sig.SIG_ED25519);
printKeyBlock('ED25519 (SIG=02)', {
  PRIVATE_KEY: ed.PRIVATE_KEY_OR_SECRET,
  PUBLIC_KEY: ed.PUBLIC_KEY_OR_SECRET
});

// --- RSA (SIG=03) ---
const rsa = sig.create_keypair_or_secret(sig.SIG_RSA);
printKeyBlock('RSA (SIG=03)', {
  PRIVATE_KEY_COMPRESSED: sig.compressPEM(rsa.PRIVATE_KEY_OR_SECRET),
  PUBLIC_KEY_COMPRESSED: sig.compressPEM(rsa.PUBLIC_KEY_OR_SECRET)
});

console.log('\nNote: Compressed PEM keys can be safely transmitted as compact opcode metadata.\n');
