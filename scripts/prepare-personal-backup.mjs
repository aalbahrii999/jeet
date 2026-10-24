import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const metadata=JSON.parse(fs.readFileSync('release/personal-recovery.json','utf8'));
let content;
try {
  content=execFileSync('gh',['release','download','v2.0.0','--pattern','jeet-backup-recovered-2026-10-22.json','--output','-'],{stdio:['ignore','pipe','pipe']});
} catch {
  const response=JSON.parse(execFileSync('gh',['api',`repos/${process.env.GITHUB_REPOSITORY}/git/blobs/${metadata.blobSha}`],{encoding:'utf8'}));
  if(response.encoding!=='base64')throw new Error('Unsupported recovery blob encoding');
  content=Buffer.from(response.content,'base64');
}
if(crypto.createHash('sha256').update(content).digest('hex')!==metadata.sha256)throw new Error('Recovery blob checksum mismatch');
const backup=JSON.parse(content);if(backup.app!=='jeet'||backup.data.sessions.length!==2)throw new Error('Recovery bundle does not contain the expected two sessions');
fs.writeFileSync(process.env.JEET_INITIAL_BACKUP_FILE,content,{mode:0o600});
fs.writeFileSync('release-output/jeet-backup-recovered-2026-10-22.json',content);
console.log('Personal recovery prepared with checksum verification.');
