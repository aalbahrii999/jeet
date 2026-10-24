import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { encryptBundle, decryptBundle } from './release-signing.mjs';
test('signing backup needs the owner key and rejects modified ciphertext',()=>{
  const owner=generateKeyPairSync('rsa',{modulusLength:2048}),other=generateKeyPairSync('rsa',{modulusLength:2048});
  const value={keystoreBase64:'private-key-data',storePassword:'private-password',keyAlias:'release',keyPassword:'private-password'};
  const envelope=encryptBundle(value,owner.publicKey);
  assert.deepEqual(decryptBundle(envelope,owner.privateKey),value);
  assert.equal(JSON.stringify(envelope).includes(value.storePassword),false);
  assert.throws(()=>decryptBundle(envelope,other.privateKey));
  const changed=Buffer.from(envelope.content,'base64');changed[0]^=1;
  assert.throws(()=>decryptBundle({...envelope,content:changed.toString('base64')},owner.privateKey));
});
