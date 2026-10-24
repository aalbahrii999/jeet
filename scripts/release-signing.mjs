import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

// Only encrypted key material may leave the runner. The owner holds the RSA
// private key; repository readers can inspect this public encryption key safely.
export function encryptBundle(bundle, publicKey) {
  const key = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const content = Buffer.concat([cipher.update(JSON.stringify(bundle), 'utf8'), cipher.final()]);
  return { format: 'jeet-signing-backup-v1', wrappedKey: crypto.publicEncrypt({key:publicKey,oaepHash:'sha256'}, key).toString('base64'), iv:iv.toString('base64'), tag:cipher.getAuthTag().toString('base64'), content:content.toString('base64') };
}
export function decryptBundle(envelope, privateKey) {
  if (envelope.format !== 'jeet-signing-backup-v1') throw new Error('Unknown signing backup format');
  const key=crypto.privateDecrypt({key:privateKey,oaepHash:'sha256'},Buffer.from(envelope.wrappedKey,'base64'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.content,'base64')),decipher.final()]).toString('utf8'));
}
function exportSigning(bundle, storeFile) {
  for(const name of ['keystoreBase64','storePassword','keyPassword','keyAlias']) if(typeof bundle[name]!=='string'||!bundle[name]||/[\r\n]/.test(bundle[name])) throw new Error('Invalid signing bundle field: '+name);
  const bytes=Buffer.from(bundle.keystoreBase64,'base64');if(bytes.length<512)throw new Error('Keystore is incomplete');
  fs.writeFileSync(storeFile,bytes,{mode:0o600});
  for(const secret of new Set([bundle.storePassword,bundle.keyPassword])) console.log('::add-mask::'+secret);
  const vars={JEET_SIGNING_STORE_FILE:storeFile,JEET_SIGNING_STORE_PASSWORD:bundle.storePassword,JEET_SIGNING_KEY_PASSWORD:bundle.keyPassword,JEET_SIGNING_KEY_ALIAS:bundle.keyAlias};
  fs.appendFileSync(process.env.GITHUB_ENV,Object.entries(vars).map(([k,v])=>`${k}=${v}`).join('\n')+'\n');
}
export function prepareSigning() {
  const output=path.resolve('release-output');fs.mkdirSync(output,{recursive:true});
  const envelopeFile=path.join(output,'signing-backup.encrypted.json');
  const storeFile=path.join(process.env.RUNNER_TEMP,'jeet-release.p12');
  const publicKey=fs.readFileSync('release/signing-backup-public.pem','utf8');
  let bundle, envelope;
  if(process.env.JEET_SIGNING_BUNDLE) {
    bundle=JSON.parse(process.env.JEET_SIGNING_BUNDLE);envelope=encryptBundle(bundle,publicKey);
  } else {
    let exists=false;
    try {execFileSync('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/releases/tags/v2.0.0`],{stdio:['ignore','pipe','pipe']});exists=true;}
    catch(error){if(!String(error.stderr).includes('404'))throw new Error('Could not determine whether a signing key already exists');}
    if(exists){
      if(!process.env.JEET_SIGNING_BACKUP_PRIVATE_KEY)throw new Error('Existing release key must be restored. Configure JEET_SIGNING_BACKUP_PRIVATE_KEY or JEET_SIGNING_BUNDLE. A replacement key will not be generated.');
      execFileSync('gh',['release','download','v2.0.0','--pattern','signing-backup.encrypted.json','--dir',output],{stdio:'pipe'});
      envelope=JSON.parse(fs.readFileSync(envelopeFile,'utf8'));bundle=decryptBundle(envelope,process.env.JEET_SIGNING_BACKUP_PRIVATE_KEY);
    } else {
      const password=crypto.randomBytes(32).toString('base64url');
      execFileSync('keytool',['-genkeypair','-alias','jeet-release','-keyalg','RSA','-keysize','3072','-validity','10950','-storetype','PKCS12','-keystore',storeFile,'-storepass:env','JEET_KEY_PASSWORD','-keypass:env','JEET_KEY_PASSWORD','-dname','CN=Jeet Release, O=Jeet, C=OM'],{env:{...process.env,JEET_KEY_PASSWORD:password},stdio:['ignore','pipe','pipe']});
      bundle={keystoreBase64:fs.readFileSync(storeFile).toString('base64'),storePassword:password,keyPassword:password,keyAlias:'jeet-release',storeType:'PKCS12'};
      envelope=encryptBundle(bundle,publicKey);
    }
  }
  fs.writeFileSync(envelopeFile,JSON.stringify(envelope,null,2)+'\n');
  // Ciphertext only: permits owner recovery even if artifact downloads expire.
  console.log('JEET_ENCRYPTED_SIGNING_BACKUP='+Buffer.from(JSON.stringify(envelope)).toString('base64'));
  exportSigning(bundle,storeFile);
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname))prepareSigning();
