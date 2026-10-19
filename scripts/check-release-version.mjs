import { readFile } from 'node:fs/promises';
const tag = process.argv[2];
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
if (version !== lock.version || version !== lock.packages?.['']?.version) throw new Error('Le versioni di package.json e package-lock.json non corrispondono.');
if (!tag || tag !== `v${version}`) throw new Error(`Il tag ${tag} non corrisponde a package.json (${version}). Aggiorna package.json e package-lock.json prima di preparare una release.`);
console.log(`Release version verified: ${version}`);
