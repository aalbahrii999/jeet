import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const gh=(args)=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const repo=process.env.GITHUB_REPOSITORY;
const tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
const runs=JSON.parse(gh(['api',`repos/${repo}/actions/runs?branch=codex%2Frest-timer-pocket-alerts&status=success&per_page=30`])).workflow_runs;
let selected;
for(const run of runs.filter(r=>r.name==='Release Jeet'&&r.event==='push')){
  const commit=JSON.parse(gh(['api',`repos/${repo}/git/commits/${run.head_sha}`]));
  if(commit.tree.sha===tree){selected=run;break;}
}
if(!selected)throw new Error('No successful signed release build matches this exact source tree');
gh(['run','download',String(selected.id),'--name','jeet-2.0.0-release','--dir','release-output']);
const manifest=JSON.parse(fs.readFileSync('release-output/release-manifest.json','utf8'));
if(manifest.sourceCommit!==selected.head_sha||manifest.sourceTree!==tree)throw new Error('Release build provenance mismatch');
for(const [name,expected] of Object.entries(manifest.sha256)){
  const actual=crypto.createHash('sha256').update(fs.readFileSync('release-output/'+name)).digest('hex');
  if(actual!==expected)throw new Error('Release artifact checksum mismatch: '+name);
}
execFileSync('python3',['scripts/check-release-apks.py'],{stdio:'inherit'});
gh(['release','create','v2.0.0','release-output/jeet-2.0.0.apk','release-output/jeet-2.0.0-personal.apk','release-output/jeet-backup-recovered-2026-10-22.json','release-output/signing-backup.encrypted.json','release-output/release-manifest.json','release-output/SHA256SUMS','--target',process.env.GITHUB_SHA,'--title','جيت 2.0.0','--notes-file','release/notes-2.0.0.ar.md','--latest']);
console.log('Published stable v2.0.0 from verified build '+selected.id);
