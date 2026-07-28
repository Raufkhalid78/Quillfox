const crypto = require('crypto').webcrypto;
const forge = require('node-forge');

async function test() {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const masterKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const plaintext = 'This is a test private key';
  const encoder = new TextEncoder();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    encoder.encode(plaintext)
  );
  
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertextBuffer).length);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);
  
  let binary = '';
  for(let i=0; i<combined.length; i++) binary += String.fromCharCode(combined[i]);
  const encoded = 'enc:' + btoa(binary);
  
  // Now decrypt with forge
  const rawKeyBuffer = await crypto.subtle.exportKey('raw', masterKey);
  let rawKeyString = '';
  const rkb = new Uint8Array(rawKeyBuffer);
  for(let i=0; i<rkb.length; i++) rawKeyString += String.fromCharCode(rkb[i]);
  
  const b64 = encoded.slice(4);
  const forgeBinary = forge.util.decode64(atob(btoa(b64))); 
  
  const f_iv = forgeBinary.substring(0, 12);
  const f_enc = forgeBinary.substring(12);
  const f_ct = f_enc.substring(0, f_enc.length - 16);
  const f_tg = f_enc.substring(f_enc.length - 16);
  
  const decipher = forge.cipher.createDecipher('AES-GCM', rawKeyString);
  decipher.start({ iv: f_iv, tag: forge.util.createBuffer(f_tg) });
  decipher.update(forge.util.createBuffer(f_ct));
  const pass = decipher.finish();
  
  console.log('Decryption passed:', pass);
  if (pass) console.log('Decrypted text:', forge.util.decodeUtf8(decipher.output.getBytes()));
}
test().catch(console.error);
