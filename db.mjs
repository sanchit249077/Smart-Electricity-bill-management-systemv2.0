import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const dbFile = path.join(dataDir, 'db.json');

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};
const verifyPassword = (password, stored) => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
};
const readDb = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
const writeDb = (db) => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const seedUser = (email, password, role, name, category='residential') => ({ id:id(), email, password_hash:hashPassword(password), role, full_name:name, phone:'', address:'Ambala, Haryana', area:'Ambala', connection_id:`SP-${Math.floor(Math.random()*900000+100000)}`, category, created_date:now() });

export function ensureDb() {
  fs.mkdirSync(dataDir, { recursive:true });
  if (fs.existsSync(dbFile)) return;
  const customer=seedUser('demo@smartpower.local','demo1234','user','Sanchit Demo','residential');
  const admin=seedUser('admin@smartpower.local','admin1234','admin','SmartPower Admin','residential');
  const staff=seedUser('staff@smartpower.local','staff1234','staff','Department Staff','residential');
  const year = new Date().getFullYear();
  const t0=now();
  const bills=[
    {id:id(),customer_id:customer.id,bill_number:'SP-2026-001',billing_period_start:`${year}-08-01`,billing_period_end:`${year}-08-31`,units_consumed:182,total_amount:1842,amount_paid:0,due_date:`${year}-09-15`,status:'pending',created_date:t0},
    {id:id(),customer_id:customer.id,bill_number:'SP-2026-002',billing_period_start:`${year}-07-01`,billing_period_end:`${year}-07-31`,units_consumed:165,total_amount:1678,amount_paid:1678,due_date:`${year}-08-15`,status:'paid',created_date:new Date(Date.now()-86400000*30).toISOString()},
    {id:id(),customer_id:customer.id,bill_number:'SP-2026-003',billing_period_start:`${year}-06-01`,billing_period_end:`${year}-06-30`,units_consumed:194,total_amount:1965,amount_paid:1965,due_date:`${year}-07-15`,status:'paid',created_date:new Date(Date.now()-86400000*60).toISOString()}
  ];
  const consumption=[...Array(12)].map((_,i)=>({id:id(),customer_id:customer.id,year:year-Math.floor(i/12),month:((new Date().getMonth()-i+12)%12)+1,units_consumed:140+i*5,created_date:now()}));
  const solar=[...Array(6)].map((_,i)=>({id:id(),customer_id:customer.id,year:year,month:i+1,energy_generated_kwh:210-i*12,energy_exported_kwh:110-i*7,created_date:now()}));
  const appliances=[{id:id(),customer_id:customer.id,name:'Air Conditioner',category:'Cooling',wattage:1500,hours_per_day:5,days_per_month:30,monthly_units:225,created_date:now()},{id:id(),customer_id:customer.id,name:'Refrigerator',category:'Kitchen',wattage:200,hours_per_day:8,days_per_month:30,monthly_units:48,created_date:now()}];
  const notifications=[{id:id(),user_id:customer.id,title:'New bill generated',message:'Your latest electricity bill is ready.',type:'bill',read:false,created_date:t0}];
  const outages=[{id:id(),title:'Scheduled maintenance',area:'Ambala Cantt',status:'scheduled',start_time:new Date(Date.now()+86400000).toISOString(),end_time:null,description:'Planned feeder maintenance.',created_date:t0,reported_by:admin.id}];
  const tariffs=[{id:id(),name:'Residential Standard',category:'residential',fixed_charges:100,gst_rate:18,slabs:[{upto:100,rate:3.5},{upto:200,rate:5},{upto:null,rate:7}],active:true,created_date:t0}];
  const complaints=[];
  const payments=bills.filter(b=>b.status==='paid').map((b)=>({id:id(),bill_id:b.id,customer_id:customer.id,amount:b.total_amount,status:'success',payment_date:b.created_date,created_date:b.created_date,method:'Demo Payment'}));
  const theft=[{id:id(),customer_id:customer.id,customer_name:customer.full_name,consumption_spike_percentage:42,detected_by:'SmartPower Analytics',status:'open',created_date:t0}];
  const db={users:[customer,admin,staff],sessions:[],resetTokens:[],Bill:bills,Payment:payments,Complaint:complaints,TheftAlert:theft,User:[customer,admin,staff],ConsumptionData:consumption,Appliance:appliances,SolarData:solar,Notification:notifications,Outage:outages,Tariff:tariffs};
  writeDb(db);
}

export { id, now, hashPassword, verifyPassword, readDb, writeDb };
