//
// signature_class.js — Sven Pohl <sven.pohl@zen-systems.de> — MIT License © 2025
// v1.1
// 

const crypto = require('crypto');
const nacl   = require('tweetnacl');
const util   = require('tweetnacl-util');


class signature_class 
{

 
 
 
constructor()
{

this.SIG_NONE      = 0;
this.SIG_HMAC      = 1;
this.SIG_ED25519   = 2;
this.SIG_RSA       = 3;

} // constructor()



//
// create_keypair_or_secret
//
create_keypair_or_secret( sigtype )
{
let keypair = {};
console.log("Create Keypair: " + sigtype);

if ( sigtype == this.SIG_HMAC )
   {
   keypair['PUBLIC_KEY_OR_SECRET']  = this.generateSharedSecret(32);
   keypair['PRIVATE_KEY_OR_SECRET'] =  keypair['PUBLIC_KEY_OR_SECRET'];
   } // SIG_HMAC
 

if (sigtype == this.SIG_ED25519) 
   {
   const keypair_ed25519 = nacl.sign.keyPair();
   
   keypair['PUBLIC_KEY_OR_SECRET']  = util.encodeBase64(keypair_ed25519.publicKey);
   keypair['PRIVATE_KEY_OR_SECRET'] = util.encodeBase64(keypair_ed25519.secretKey);
         
   } // SIG_ED25519


if (sigtype == this.SIG_RSA) 
   {
   const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', 
      {
      modulusLength: 2048,
      publicKeyEncoding: 
            {
            type: 'spki',
            format: 'pem'
            },
      privateKeyEncoding: 
            {
            type: 'pkcs8',
            format: 'pem'
            }
      });

   keypair['PUBLIC_KEY_OR_SECRET']  = publicKey;
   keypair['PRIVATE_KEY_OR_SECRET'] = privateKey;
   } // SIG_RSA


return( keypair );
} // create_keypair_or_secret()




//
// signMessage
//
signMessage(sigtype, message, private_key_or_secret ) 
{


if ( sigtype == this.SIG_HMAC )
   {

   const hmac = crypto.createHmac('sha256', private_key_or_secret);
   hmac.update( message );
   return hmac.digest('hex'); // oder 'base64'
  
   } // SIG_HMAC
 
 
if (sigtype == this.SIG_ED25519) 
   {
   // private_key_or_secret ist Base64 → robust in Buffer dekodieren
   const privBuf = Buffer.from(private_key_or_secret.trim(), 'base64');
   const privateKey = new Uint8Array(privBuf);  // Uint8Array für tweetnacl

   // message → UTF-8 → Uint8Array
   const msgBuf = Buffer.from(message, 'utf8');
   const messageBytes = new Uint8Array(msgBuf);

   const signature = nacl.sign.detached(messageBytes, privateKey);

   // Signatur als Base64 zurück
   return Buffer.from(signature).toString('base64');
   } // SIG_ED25519

 

if (sigtype == this.SIG_RSA) {

    let pemKey = private_key_or_secret;

    if (pemKey.startsWith("PEM|")) {
        pemKey = this.normalizePEM(pemKey, "PRIVATE KEY");
    }

    const signature = crypto.sign("sha256", Buffer.from(message), {
        key: pemKey,
        padding: crypto.constants.RSA_PKCS1_PADDING     
    });

    return signature.toString("base64");
} // SIG_RSA




} /// signMessage();



//
// verifyMessage
//
verifyMessage(sigtype, message, receivedSignature, keypair_or_secret) 
{


if ( sigtype == this.SIG_HMAC )
   {
   const expectedSignature = this.signMessage(sigtype, message, keypair_or_secret);
   
   return crypto.timingSafeEqual
      (
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
     );
  
   } // SIG_HMAC
   
   
if (sigtype == this.SIG_ED25519) 
   {
   // Public Key (Base64) → Uint8Array
   const pubBuf = Buffer.from(keypair_or_secret.trim(), 'base64');
   const publicKey = new Uint8Array(pubBuf);

   // Message → UTF-8 → Uint8Array
   const msgBuf = Buffer.from(message, 'utf8');
   const messageBytes = new Uint8Array(msgBuf);

   // Signature (Base64) → Uint8Array
   const sigBuf = Buffer.from(receivedSignature.trim(), 'base64');
   const signatureBytes = new Uint8Array(sigBuf);

   return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
   } // SIG_ED25519



if (sigtype == this.SIG_RSA) {

    let pemKey = keypair_or_secret;

    if (pemKey.startsWith("PEM|")) {
        pemKey = this.normalizePEM(pemKey, "PUBLIC KEY");
    }

    return crypto.verify(
        "sha256",
        Buffer.from(message),
        {
            key: pemKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(receivedSignature, "base64")
    );
}


 
} /// verifyMessage





// 
// generateSharedSecret() 
// (for SIG_HMAC)
//
generateSharedSecret(length = 32) 
{
return crypto.randomBytes(length).toString('hex');
} // generateSharedSecret()



// For RSA
compressPEM(pem) {
  const body = pem
    .split('\n')
    .filter(line => line && !line.includes('-----')) // Only keep Base64-lines
    .join('|');
    
  return `PEM|${body}`;
}


// For RSA
restorePEM(compact, type = 'PUBLIC KEY') {
  if (compact.startsWith('PEM|')) {
    compact = compact.slice(4); // remove "PEM|"
  }

  const body = compact
    .split('|')
    .filter(line => line.trim() !== '')   
    .join('\n');

  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----\n`;
}




normalizePEM(pem, type) {
    // remove PEM|
    if (pem.startsWith("PEM|")) {
        pem = pem.slice(4);
    }

    // Flatten lines and remove whitespace
    let body = pem
        .replace(/-----.*-----/g, "")
        .replace(/\s+/g, "")
        .trim();

    // Split into 64-character lines
    const lines = body.match(/.{1,64}/g) || [];

    return [
        `-----BEGIN ${type}-----`,
        ...lines,
        `-----END ${type}-----`
    ].join("\n");
}





} // class signature_class 




// Export class
module.exports = signature_class;


