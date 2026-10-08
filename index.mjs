import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ensureDb, id, now, hashPassword, verifyPassword, readDb, writeDb } from './db.mjs';

ensureDb();
const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, '..', 'dist');
const PORT = Number(process.env.PORT || 4400);
const COOKIE = 'smartpower_session';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;
const mime = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon' };

const json = (res, status, body, headers={}) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', ...headers}); res.end(JSON.stringify(body)); };
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x=>{const i=x.indexOf('='); return [x.slice(0,i).trim(), decodeURIComponent(x.slice(i+1).trim())]}));
const readBody = (req) => new Promise((resolve,reject)=>{ let data=''; req.on('data',c=>{data+=c; if(data.length>1_000_000){req.destroy();reject(new Error('Payload too large'))}}); req.on('end',()=>{ if(!data)return resolve({}); try{resolve(JSON.parse(data))}catch{reject(new Error('Invalid JSON'))}}); req.on('error',reject); });
const safeUser = (u) => { const {password_hash,...rest}=u; return rest; };
const sessionUser = (req) => {
  const bearer = String(req.headers.authorization||'').startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const token = bearer || parseCookies(req)[COOKIE]; if(!token) return null;
  const db=readDb(); const s=db.sessions.find(x=>x.token===token&&x.expires_at>Date.now()); return s ? db.users.find(u=>u.id===s.user_id)||null : null;
};
const requireAuth = (req,res) => { const u=sessionUser(req); if(!u){json(res,401,{message:'Authentication required'}); return null;} req.user=u; return u; };
const requireRole = (user, roles, res) => { if(!roles.includes(user.role)){json(res,403,{message:'Insufficient permissions'}); return false;} return true; };
const setSession = (res,userId) => { const db=readDb(); const token=crypto.randomBytes(32).toString('hex'); db.sessions=db.sessions.filter(s=>s.expires_at>Date.now()); db.sessions.push({token,user_id:userId,expires_at:Date.now()+SESSION_TTL}); writeDb(db); res.setHeader('Set-Cookie',`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL/1000)}`); };
const filterRows = (rows,filters) => Object.entries(filters||{}).length ? rows.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)) : rows;
const sortRows = (rows,sort) => { if(!sort)return rows; const desc=sort.startsWith('-'); const key=desc?sort.slice(1):sort; return [...rows].sort((a,b)=>{const av=a[key]??'',bv=b[key]??''; const an=Number(av),bn=Number(bv); const c=Number.isNaN(an)||Number.isNaN(bn)?String(av).localeCompare(String(bv)):an-bn; return desc?-c:c;}); };
const collection=(db,name)=>Array.isArray(db[name])?(db[name]):(db[name]=[]);
const isOwner = (user,name,row) => {
  if (name==='Notification') return row.user_id===user.id;
  if (['Bill','Payment','Complaint','TheftAlert','ConsumptionData','Appliance','SolarData'].includes(name)) return row.customer_id===user.id;
  if (name==='User') return row.id===user.id;
  return false;
};
const canRead=(user,name,row)=> user.role==='admin'||user.role==='staff'||isOwner(user,name,row)||name==='Outage';
const canWrite=(user,name,row)=> {
  if(name==='Tariff') return user.role==='admin';
  if(name==='TheftAlert') return user.role==='admin'||user.role==='staff';
  if(name==='Complaint') return user.role==='admin'||user.role==='staff'||isOwner(user,name,row);
  if(name==='Notification') return isOwner(user,name,row);
  if(name==='Appliance') return isOwner(user,name,row);
  if(name==='Outage') return user.role!=='user' || row.reported_by===user.id;
  if(name==='User') return user.role==='admin' || row.id===user.id;
  if(['Bill','Payment','ConsumptionData','SolarData'].includes(name)) return user.role==='admin'||user.role==='staff'||isOwner(user,name,row);
  return user.role==='admin';
};

async function handleApi(req,res,url){
  const parts=url.pathname.split('/').filter(Boolean).slice(1); // after api
  try {
    if(parts[0]==='health'&&req.method==='GET') return json(res,200,{ok:true,name:'SmartPower'});

    if(parts[0]==='auth'){
      if(parts[1]==='register'&&req.method==='POST'){
        const b=await readBody(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||'');
        if(!email||password.length<6)return json(res,400,{message:'Email and password (6+ characters) are required'});
        const db=readDb(); if(db.users.some(u=>u.email===email))return json(res,409,{message:'An account with that email already exists'});
        const full_name=email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()); const user={id:id(),email,password_hash:hashPassword(password),role:'user',full_name,phone:'',address:'',area:'',connection_id:`SP-${Date.now().toString().slice(-6)}`,category:'residential',created_date:now()};
        db.users.push(user); db.User.push(user); writeDb(db); return json(res,201,safeUser(user));
      }
      if(parts[1]==='login'&&req.method==='POST'){
        const b=await readBody(req),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''); const db=readDb(); const user=db.users.find(u=>u.email===email); if(!user||!verifyPassword(password,user.password_hash))return json(res,401,{message:'Invalid email or password'}); setSession(res,user.id); return json(res,200,safeUser(user));
      }
      if(parts[1]==='me'&&req.method==='GET'){const u=requireAuth(req,res); return u?json(res,200,safeUser(u)):undefined;}
      if(parts[1]==='me'&&req.method==='PATCH'){const u=requireAuth(req,res); if(!u)return; const b=await readBody(req),db=readDb(),idx=db.users.findIndex(x=>x.id===u.id); const blocked=['id','email','role','password_hash','created_date']; for(const k of blocked)delete b[k]; Object.assign(db.users[idx],b); const mirror=db.User.find(x=>x.id===u.id);if(mirror)Object.assign(mirror,b);writeDb(db);return json(res,200,safeUser(db.users[idx]));}
      if(parts[1]==='logout'&&req.method==='POST'){const token=parseCookies(req)[COOKIE]; if(token){const db=readDb();db.sessions=db.sessions.filter(x=>x.token!==token);writeDb(db);} res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; Max-Age=0`);return json(res,200,{ok:true});}
      if(parts[1]==='forgot-password'&&req.method==='POST'){const b=await readBody(req),email=String(b.email||'').trim().toLowerCase(),db=readDb(),u=db.users.find(x=>x.email===email); if(!u)return json(res,200,{ok:true}); const token=crypto.randomBytes(20).toString('hex');db.resetTokens=db.resetTokens.filter(x=>x.user_id!==u.id);db.resetTokens.push({token,user_id:u.id,expires_at:Date.now()+15*60*1000});writeDb(db);return json(res,200,{ok:true,reset_token:token});}
      if(parts[1]==='reset-password'&&req.method==='POST'){const b=await readBody(req),db=readDb(),r=db.resetTokens.find(x=>x.token===b.resetToken&&x.expires_at>Date.now());if(!r)return json(res,400,{message:'Reset link is invalid or expired'});if(String(b.newPassword||'').length<6)return json(res,400,{message:'Password must be at least 6 characters'});const u=db.users.find(x=>x.id===r.user_id);u.password_hash=hashPassword(b.newPassword);const m=db.User.find(x=>x.id===u.id);if(m)m.password_hash=u.password_hash;db.resetTokens=db.resetTokens.filter(x=>x.token!==b.resetToken);writeDb(db);return json(res,200,{ok:true});}
      return json(res,404,{message:'Auth route not found'});
    }

    const user=requireAuth(req,res); if(!user)return;
    if(parts[0]==='entities'){
      const name=parts[1]; const db=readDb(); const rows=collection(db,name);
      if(parts.length===2&&req.method==='GET'){
        let filters={}; if(url.searchParams.get('filters')){try{filters=JSON.parse(url.searchParams.get('filters'));}catch{}}
        const visible=sortRows(filterRows(rows,filters).filter(r=>canRead(user,name,r)),url.searchParams.get('sort')||''); const limit=Math.min(Number(url.searchParams.get('limit')||100),500); return json(res,200,visible.slice(0,limit).map(r=>name==='User'?safeUser(r):r));
      }
      if(parts.length===2&&req.method==='POST'){
        const allowedCreate=name==='Tariff'?['admin']:name==='Outage'?['admin','staff','user']:['admin','staff','user']; if(!requireRole(user,allowedCreate,res))return;
        const b=await readBody(req); const row={id:id(),created_date:now(),...b};
        if(['Bill','Payment','Complaint','TheftAlert','ConsumptionData','Appliance','SolarData'].includes(name)&&user.role==='user') { const owner=row.customer_id||row.user_id; if(name==='Complaint')row.customer_id=user.id; else if(owner&&owner!==user.id)return json(res,403,{message:'Cannot create records for another customer'}); }
        if(name==='Outage'){row.reported_by=user.id;row.reported_by_name=user.full_name;}
        rows.push(row);if(name==='User')db.users.push(row);writeDb(db);return json(res,201,name==='User'?safeUser(row):row);
      }
      if(parts.length===3&&req.method==='GET') { const row=rows.find(x=>x.id===parts[2]); if(!row||!canRead(user,name,row))return json(res,404,{message:'Record not found'}); return json(res,200,name==='User'?safeUser(row):row); }
      if(parts.length===3&&req.method==='PATCH') { const row=rows.find(x=>x.id===parts[2]); if(!row||!canWrite(user,name,row))return json(res,403,{message:'Cannot modify this record'}); const b=await readBody(req); if(name==='User'){delete b.email;delete b.role;delete b.password_hash;} if(name==='Complaint'&&user.role==='user'){delete b.status;delete b.response;delete b.responded_by;delete b.responded_at;} Object.assign(row,b);if(name==='User'){const m=db.users.find(x=>x.id===row.id);if(m)Object.assign(m,row)}writeDb(db);return json(res,200,name==='User'?safeUser(row):row); }
      if(parts.length===3&&req.method==='DELETE'){const row=rows.find(x=>x.id===parts[2]);if(!row||!canWrite(user,name,row))return json(res,403,{message:'Cannot delete this record'});db[name]=rows.filter(x=>x.id!==row.id);if(name==='User')db.users=db.users.filter(x=>x.id!==row.id);writeDb(db);return json(res,200,{ok:true});}
      if(parts.length===3&&parts[2]==='bulk'&&req.method==='PATCH'){if(name!=='Notification')return json(res,403,{message:'Bulk update not supported'});const b=await readBody(req);for(const item of (b.items||[])){const row=rows.find(x=>x.id===item.id);if(row&&canWrite(user,name,row))Object.assign(row,item)}writeDb(db);return json(res,200,{ok:true});}
      return json(res,404,{message:'Entity route not found'});
    }

    if(parts[0]==='functions'&&parts[1]){
      const name=parts[1],b=await readBody(req),db=readDb();
      if(name==='createCheckoutSession'){const bill=db.Bill.find(x=>x.id===b.bill_id);if(!bill||!canRead(user,'Bill',bill))return json(res,404,{message:'Bill not found'});const balance=Math.max(0,Number(bill.total_amount||0)-Number(bill.amount_paid||0));if(balance<=0)return json(res,400,{message:'This bill is already paid'});const payment={id:id(),bill_id:bill.id,customer_id:bill.customer_id,amount:balance,status:'pending',method:'Local Checkout',created_date:now()};db.Payment.push(payment);writeDb(db);return json(res,200,{data:{url:`/checkout?bill_id=${bill.id}&payment_id=${payment.id}`}});}
      if(name==='completePayment'){const bill=db.Bill.find(x=>x.id===b.bill_id),payment=db.Payment.find(x=>x.id===b.payment_id&&x.bill_id===b.bill_id);if(!bill||!payment||!canRead(user,'Bill',bill))return json(res,404,{message:'Payment request not found'});if(payment.status==='success')return json(res,200,{ok:true});payment.status='success';payment.payment_date=now();bill.amount_paid=Number(bill.amount_paid||0)+Number(payment.amount||0);if(bill.amount_paid>=Number(bill.total_amount||0))bill.status='paid';db.Notification.push({id:id(),user_id:bill.customer_id,title:'Payment successful',message:`Payment for ${bill.bill_number} was recorded successfully.`,type:'payment',read:false,created_date:now()});writeDb(db);return json(res,200,{ok:true,payment,bill});}
      if(name==='respondToComplaint'){if(!requireRole(user,['admin','staff'],res))return;const c=db.Complaint.find(x=>x.id===b.complaint_id);if(!c)return json(res,404,{message:'Complaint not found'});c.response=String(b.reply||'');c.responded_by=user.id;c.responded_at=now();c.status='in_progress';db.Notification.push({id:id(),user_id:c.customer_id,title:'Complaint updated',message:c.response,type:'complaint',read:false,created_date:now()});writeDb(db);return json(res,200,{complaint:c});}
      if(name==='runTheftScan'){if(!requireRole(user,['admin','staff'],res))return;const created=[];const latest=new Map();for(const row of db.ConsumptionData||[]){const prev=latest.get(row.customer_id);if(!prev||Number(row.year)>Number(prev.year)||(Number(row.year)===Number(prev.year)&&Number(row.month)>Number(prev.month)))latest.set(row.customer_id,row);}for(const [uid,current] of latest){const hist=(db.ConsumptionData||[]).filter(x=>x.customer_id===uid&&x.id!==current.id).slice(-6);const avg=hist.length?hist.reduce((s,x)=>s+Number(x.units_consumed||0),0)/hist.length:0;if(avg&&Number(current.units_consumed)>avg*1.35){const open=db.TheftAlert.find(x=>x.customer_id===uid&&!["resolved","false_alarm"].includes(x.status));if(!open){const u=db.users.find(x=>x.id===uid);const a={id:id(),customer_id:uid,customer_name:u?.full_name||'Customer',consumption_spike_percentage:Math.round((current.units_consumed/avg-1)*100),detected_by:'SmartPower Scan',status:'open',created_date:now()};db.TheftAlert.push(a);created.push(a)}}}writeDb(db);return json(res,200,{data:{created:created.length,alerts:created}});}
      return json(res,404,{message:'Unknown function'});
    }
    return json(res,404,{message:'API route not found'});
  } catch(e) { console.error(e); return json(res,500,{message:e.message||'Server error'}); }
}

const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
  if(url.pathname.startsWith('/api/')) return handleApi(req,res,url);
  if(req.method!=='GET'){res.writeHead(405);return res.end('Method Not Allowed');}
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'||!fs.existsSync(publicDir)){if(!fs.existsSync(publicDir)){res.writeHead(503,{'Content-Type':'text/plain'});return res.end('Frontend not built. Run npm run build first.')}pathname='/index.html';}
  let file=path.normalize(path.join(publicDir,pathname));
  if(!file.startsWith(publicDir))return res.writeHead(400).end();
  if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(publicDir,'index.html');
  const ext=path.extname(file);res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
server.listen(PORT,'0.0.0.0',()=>console.log(`SmartPower standalone API/server running on http://0.0.0.0:${PORT}`));
