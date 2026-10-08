import { spawn } from 'node:child_process';
const run=(cmd,args)=>spawn(cmd,args,{stdio:'inherit',env:process.env});
const backend=run(process.execPath,['server/index.mjs']);
const frontend=run(process.platform==='win32'?'npm':'npm',['run','dev','--','--host','0.0.0.0']);
const stop=(code=0)=>{backend.kill('SIGTERM');frontend.kill('SIGTERM');process.exit(code)};
process.on('SIGINT',()=>stop()); process.on('SIGTERM',()=>stop());
backend.on('exit',(code)=>{if(code!==null&&code!==0) stop(code);});
frontend.on('exit',(code)=>{if(code!==null&&code!==0) stop(code);});
