import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const hidden=[]; const files=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','dist'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.name.startsWith('.')){hidden.push(p);continue;}entry.isDirectory()?walk(p):files.push(p)}}
walk(root);
if(hidden.length) throw new Error(`Hidden files are not allowed: ${hidden.join(', ')}`);
if(fs.existsSync(path.join(root,'base44'))) throw new Error('Legacy backend directory still exists');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};
if(Object.keys(deps).some(n=>n.startsWith('@base44/'))) throw new Error('Legacy SDK dependencies remain');
if(files.length>100) throw new Error(`Too many project files: ${files.length}`);
console.log(`Validation passed: ${files.length} project files, no hidden files, standalone API configuration is present.`);
