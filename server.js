const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 8080;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
const sessions = new Map();

const seed = {
  categories:[
    {key:'Educational Toys',ic:'puzzle'},
    {key:'Remote Control Toys',ic:'car'},
    {key:'Dolls',ic:'doll'},
    {key:'Baby Toys',ic:'rattle'},
    {key:'Outdoor Toys',ic:'bike'}
  ],
  products:[
    {id:1,name:'Sanded Beech Building Blocks',cat:'Educational Toys',price:899,was:1199,age:'1–4 yrs',stockQty:20,rating:4.8,reviews:132,ic:'blocks',badge:'Bestseller',desc:'32 hand-sanded beech blocks in soft geometric shapes, finished with plant-based dye.'},
    {id:2,name:'Turbo Trail RC Racer',cat:'Remote Control Toys',price:1899,was:2399,age:'6+ yrs',stockQty:15,rating:4.6,reviews:87,ic:'car',badge:'New',desc:'A durable 1:18 scale remote control racer with a 40m range and a rechargeable battery pack.'},
    {id:3,name:'Marigold Rag Doll',cat:'Dolls',price:749,was:null,age:'2+ yrs',stockQty:30,rating:4.9,reviews:210,ic:'doll',badge:'Handmade',desc:'A soft cotton rag doll stitched by hand with embroidered features.'},
    {id:4,name:'Cloud Rattle Set',cat:'Baby Toys',price:399,was:499,age:'0–1 yrs',stockQty:20,rating:4.7,reviews:64,ic:'rattle',badge:null,desc:'Three lightweight rattles in muted natural tones.'},
    {id:5,name:'Meadow Balance Bike',cat:'Outdoor Toys',price:2999,was:3499,age:'2–5 yrs',stockQty:4,rating:4.8,reviews:58,ic:'bike',badge:'Bestseller',desc:'A pedal-free wooden balance bike that teaches steering and balance.'},
    {id:6,name:'Forest Trail Puzzle Board',cat:'Educational Toys',price:649,was:null,age:'3–6 yrs',stockQty:25,rating:4.5,reviews:41,ic:'puzzle',badge:null,desc:'A 24-piece layered wooden puzzle board.'},
    {id:7,name:'Hazel the Plush Elephant',cat:'Baby Toys',price:599,was:749,age:'0–3 yrs',stockQty:18,rating:4.9,reviews:96,ic:'plush',badge:'Bestseller',desc:'A weighted, huggable elephant in brushed organic cotton.'},
    {id:8,name:'Stacking Rings Tower',cat:'Educational Toys',price:449,was:null,age:'1–3 yrs',stockQty:22,rating:4.6,reviews:73,ic:'rings',badge:null,desc:'Seven graduated rings in earthy natural tones.'}
  ],
  coupons:[
    {code:'BB10',label:'10% off your first order',detail:'10% off up to ₹300. Minimum spend ₹500.',type:'percent',value:10,cap:300,minOrder:500,expiry:'2026-12-31',active:true},
    {code:'WOOD200',label:'Flat ₹200 off',detail:'Flat ₹200 off above ₹1,500.',type:'flat',value:200,cap:null,minOrder:1500,expiry:'2026-12-31',active:true},
    {code:'FREESHIP',label:'Free shipping',detail:'Free standard shipping.',type:'freeship',value:0,cap:null,minOrder:0,expiry:'2026-12-31',active:true}
  ],
  notifications:[{id:1,type:'Announcement',message:'Free shipping on all orders above ₹999, all season long.',date:'01 Sep 2026',active:true}],
  storeInfo:{name:'MANA BOMMALU',tagline:'Toys made to be loved',address:'Vizianagaram, Andhra Pradesh',phone:'',email:'',hours:'Mon–Sat, 10:00 AM – 8:00 PM'},
  adminProfile:{name:'Store Admin',email:''},maintenanceMode:false
};

async function initDb(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Create Render Postgres and attach it to this service.');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (key TEXT PRIMARY KEY, icon TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price NUMERIC(12,2) NOT NULL, was_price NUMERIC(12,2), age TEXT, stock_qty INTEGER NOT NULL DEFAULT 0, rating NUMERIC(3,2) DEFAULT 0, reviews INTEGER DEFAULT 0, icon TEXT, badge TEXT, description TEXT, image_url TEXT);
    CREATE TABLE IF NOT EXISTS product_variants (id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, colour TEXT NOT NULL, size TEXT NOT NULL, price NUMERIC(12,2) NOT NULL, stock_qty INTEGER NOT NULL DEFAULT 0, image_url TEXT, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS coupons (code TEXT PRIMARY KEY, label TEXT, detail TEXT, type TEXT, value NUMERIC(12,2), cap NUMERIC(12,2), min_order NUMERIC(12,2), expiry DATE, active BOOLEAN DEFAULT TRUE);
    CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, whatsapp_number TEXT, address TEXT, city TEXT, pincode TEXT, orders_count INTEGER DEFAULT 0, joined_at TIMESTAMPTZ DEFAULT NOW(), blocked BOOLEAN DEFAULT FALSE);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_id INTEGER REFERENCES customers(id), placed_at TIMESTAMPTZ DEFAULT NOW(), status TEXT NOT NULL, total NUMERIC(12,2) NOT NULL, payment_method TEXT, payment_status TEXT, shipping_address TEXT, coupon_code TEXT);
    CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id TEXT REFERENCES orders(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id), variant_id INTEGER REFERENCES product_variants(id), product_name TEXT NOT NULL, colour TEXT, size TEXT, quantity INTEGER NOT NULL, unit_price NUMERIC(12,2) NOT NULL);
    CREATE TABLE IF NOT EXISTS store_settings (id INTEGER PRIMARY KEY CHECK (id=1), data JSONB NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY, type TEXT, message TEXT, date TEXT, active BOOLEAN DEFAULT TRUE);
  `);
  const {rows} = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  if(rows[0].n===0){
    await pool.query('BEGIN');
    try{
      for(const c of seed.categories) await pool.query('INSERT INTO categories(key,icon) VALUES($1,$2)',[c.key,c.ic]);
      for(const p of seed.products) await pool.query('INSERT INTO products(id,name,category,price,was_price,age,stock_qty,rating,reviews,icon,badge,description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[p.id,p.name,p.cat,p.price,p.was,p.age,p.stockQty,p.rating,p.reviews,p.ic,p.badge,p.desc]);
      for(const c of seed.coupons) await pool.query('INSERT INTO coupons(code,label,detail,type,value,cap,min_order,expiry,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[c.code,c.label,c.detail,c.type,c.value,c.cap,c.minOrder,c.expiry,c.active]);
      for(const n of seed.notifications) await pool.query('INSERT INTO notifications(id,type,message,date,active) VALUES($1,$2,$3,$4,$5)',[n.id,n.type,n.message,n.date,n.active]);
      await pool.query('INSERT INTO store_settings(id,data) VALUES(1,$1)',[JSON.stringify({storeInfo:seed.storeInfo,adminProfile:seed.adminProfile,maintenanceMode:false})]);
      await pool.query('COMMIT');
    }catch(e){ await pool.query('ROLLBACK'); throw e; }
  }
}

function parseCookies(req){ const h=req.headers.cookie||''; return Object.fromEntries(h.split(';').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i).trim(),decodeURIComponent(x.slice(i+1))]})); }
function requireAdmin(req,res,next){ const token=parseCookies(req).admin_session; if(!token || !sessions.has(token)) return res.status(401).json({error:'Admin login required'}); req.admin=sessions.get(token); next(); }

async function getState(includePrivate=true){
  const [cats,products,variants,coupons,customers,orders,items,settings,notifications]=await Promise.all([
    pool.query('SELECT key,icon AS ic FROM categories ORDER BY key'),
    pool.query('SELECT id,name,category AS cat,price,was_price AS was,age,stock_qty AS "stockQty",rating,reviews,icon AS ic,badge,description AS desc,image_url AS "imageUrl" FROM products ORDER BY id'),
    pool.query('SELECT id,product_id AS "productId",colour,size,price,stock_qty AS "stockQty",image_url AS "imageUrl",sort_order AS "sortOrder" FROM product_variants ORDER BY product_id,sort_order,id'),
    pool.query('SELECT code,label,detail,type,value,cap,min_order AS "minOrder",expiry,active FROM coupons ORDER BY code'),
    pool.query('SELECT id,name,email,phone,whatsapp_number AS "whatsappNumber",address,city,pincode,orders_count AS orders,TO_CHAR(joined_at,\'Mon YYYY\') AS joined,blocked FROM customers ORDER BY id'),
    pool.query('SELECT id,TO_CHAR(placed_at,\'DD Mon YYYY\') AS date,status,total,payment_method AS pay,payment_status AS "paymentStatus",customer_id AS "customerId",shipping_address AS "shippingAddress",coupon_code AS "couponCode" FROM orders ORDER BY placed_at'),
    pool.query('SELECT order_id AS "orderId",product_id AS "productId",variant_id AS "variantId",product_name AS "productName",colour,size,quantity,unit_price AS "unitPrice" FROM order_items ORDER BY id'),
    pool.query('SELECT data FROM store_settings WHERE id=1'),
    pool.query('SELECT id,type,message,date,active FROM notifications ORDER BY id')
  ]);
  const itemMap={}; const detailMap={}; for(const it of items.rows){ if(!itemMap[it.orderId]) itemMap[it.orderId]=[]; if(!detailMap[it.orderId]) detailMap[it.orderId]=[]; itemMap[it.orderId].push(it.productId); detailMap[it.orderId].push(it); }
  const customerMap=Object.fromEntries(customers.rows.map(c=>[c.id,c]));
  const outOrders=orders.rows.map(o=>({...o,total:Number(o.total),customer:customerMap[o.customerId]?.name||'—',customerPhone:customerMap[o.customerId]?.phone||null,whatsappNumber:customerMap[o.customerId]?.whatsappNumber||customerMap[o.customerId]?.phone||null,items:itemMap[o.id]||[],itemsDetailed:detailMap[o.id]||[]}));
  const s=settings.rows[0]?.data||{};
  const base={products:products.rows.map(p=>({...p,price:Number(p.price),was:p.was==null?null:Number(p.was),rating:Number(p.rating||0),variants:variants.rows.filter(v=>v.productId===p.id)})),categories:cats.rows,coupons:coupons.rows.map(c=>({...c,value:Number(c.value||0),cap:c.cap==null?null:Number(c.cap),minOrder:Number(c.minOrder||0)})),notifications:notifications.rows,storeInfo:s.storeInfo||seed.storeInfo,adminProfile:s.adminProfile||seed.adminProfile,maintenanceMode:!!s.maintenanceMode};
  if(includePrivate) return {...base,orders:outOrders,customers:customers.rows};
  return {...base,orders:[],customers:[]};
}

async function saveState(state){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const incomingProductIds=(state.products||[]).map(p=>p.id);
    if(incomingProductIds.length) await client.query('DELETE FROM products WHERE id <> ALL($1::int[])',[incomingProductIds]); else await client.query('DELETE FROM products');
    for(const p of state.products||[]){
      await client.query(`INSERT INTO products(id,name,category,price,was_price,age,stock_qty,rating,reviews,icon,badge,description,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,price=EXCLUDED.price,was_price=EXCLUDED.was_price,age=EXCLUDED.age,stock_qty=EXCLUDED.stock_qty,rating=EXCLUDED.rating,reviews=EXCLUDED.reviews,icon=EXCLUDED.icon,badge=EXCLUDED.badge,description=EXCLUDED.description,image_url=EXCLUDED.image_url`,[p.id,p.name,p.cat,p.price,p.was,p.age,p.stockQty||0,p.rating||0,p.reviews||0,p.ic,p.badge,p.desc,p.imageUrl||null]);
      if(Array.isArray(p.variants)) for(const v of p.variants){
        if(v.id) await client.query(`INSERT INTO product_variants(id,product_id,colour,size,price,stock_qty,image_url,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET colour=EXCLUDED.colour,size=EXCLUDED.size,price=EXCLUDED.price,stock_qty=EXCLUDED.stock_qty,image_url=EXCLUDED.image_url,sort_order=EXCLUDED.sort_order`,[v.id,p.id,v.colour||'Default',v.size||'Default',v.price??p.price,v.stockQty??p.stockQty,v.imageUrl||null,v.sortOrder||0]);
      }
    }
    const catKeys=(state.categories||[]).map(c=>c.key);
    if(catKeys.length) await client.query('DELETE FROM categories WHERE key <> ALL($1::text[])',[catKeys]); else await client.query('DELETE FROM categories');
    for(const c of state.categories||[]) await client.query('INSERT INTO categories(key,icon) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET icon=EXCLUDED.icon',[c.key,c.ic||'blocks']);
    for(const c of state.coupons||[]) await client.query(`INSERT INTO coupons(code,label,detail,type,value,cap,min_order,expiry,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(code) DO UPDATE SET label=EXCLUDED.label,detail=EXCLUDED.detail,type=EXCLUDED.type,value=EXCLUDED.value,cap=EXCLUDED.cap,min_order=EXCLUDED.min_order,expiry=EXCLUDED.expiry,active=EXCLUDED.active`,[c.code,c.label,c.detail,c.type,c.value,c.cap,c.minOrder,c.expiry||null,c.active!==false]);
    const couponCodes=(state.coupons||[]).map(c=>c.code); if(couponCodes.length) await client.query('DELETE FROM coupons WHERE code <> ALL($1::text[])',[couponCodes]); else await client.query('DELETE FROM coupons');
    for(const c of state.customers||[]) await client.query('UPDATE customers SET name=$1,email=$2,phone=$3,whatsapp_number=$4,address=$5,city=$6,pincode=$7,orders_count=$8,blocked=$9 WHERE id=$10',[c.name,c.email||null,c.phone||null,c.whatsappNumber||c.phone||null,c.address||null,c.city||null,c.pincode||null,c.orders||0,c.blocked||false,c.id]);
    for(const o of state.orders||[]){ if(o.status) await client.query('UPDATE orders SET status=$1 WHERE id=$2',[o.status,o.id]); if(o.paymentStatus) await client.query('UPDATE orders SET payment_status=$1 WHERE id=$2',[o.paymentStatus,o.id]); }
    for(const n of state.notifications||[]) await client.query('INSERT INTO notifications(id,type,message,date,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET type=EXCLUDED.type,message=EXCLUDED.message,date=EXCLUDED.date,active=EXCLUDED.active',[n.id,n.type,n.message,n.date,n.active!==false]);
    const notifIds=(state.notifications||[]).map(n=>n.id); if(notifIds.length) await client.query('DELETE FROM notifications WHERE id <> ALL($1::int[])',[notifIds]); else await client.query('DELETE FROM notifications');
    await client.query('INSERT INTO store_settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify({storeInfo:state.storeInfo||seed.storeInfo,adminProfile:state.adminProfile||seed.adminProfile,maintenanceMode:!!state.maintenanceMode})]);
    await client.query('COMMIT');
  }catch(e){ await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function sendWhatsAppStatus(customer, order, status){
  if(!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID || !customer?.whatsappNumber) return {sent:false,reason:'WhatsApp Cloud API is not configured or customer has no WhatsApp number'};
  const version=process.env.WHATSAPP_API_VERSION || 'v23.0';
  const url=`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body={messaging_product:'whatsapp',to:String(customer.whatsappNumber).replace(/\D/g,''),type:'template',template:{name:process.env.WHATSAPP_STATUS_TEMPLATE||'order_status_update',language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en_US'},components:[{type:'body',parameters:[{type:'text',text:order.id},{type:'text',text:status}]}]}};
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) return {sent:false,reason:await r.text()};
  return {sent:true};
}

app.post('/api/admin/login',async(req,res)=>{ const {email,password}=req.body||{}; if(email===process.env.ADMIN_EMAIL && password===process.env.ADMIN_PASSWORD){const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{email}); res.setHeader('Set-Cookie',`admin_session=${token}; HttpOnly; Path=/; SameSite=Lax${process.env.NODE_ENV==='production'?'; Secure':''}`); return res.json({ok:true});} res.status(401).json({error:'Invalid credentials'}); });
app.post('/api/admin/logout',(req,res)=>{const c=parseCookies(req).admin_session; if(c) sessions.delete(c); res.setHeader('Set-Cookie','admin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'); res.json({ok:true});});
app.get('/api/state',async(req,res)=>{try{res.json(await getState(false))}catch(e){console.error(e);res.status(500).json({error:'Database unavailable'})}});
app.get('/api/admin/state',requireAdmin,async(req,res)=>{try{res.json(await getState(true))}catch(e){console.error(e);res.status(500).json({error:'Database unavailable'})}});
app.put('/api/state',requireAdmin,async(req,res)=>{try{await saveState(req.body);res.json({ok:true})}catch(e){console.error(e);res.status(500).json({error:'Could not save database state'})}});

app.post('/api/orders',async(req,res)=>{
  const {customer,items,paymentMethod,coupon}=req.body||{};
  if(!customer?.name || !customer?.phone || !Array.isArray(items)||!items.length) return res.status(400).json({error:'Name, WhatsApp number and at least one item are required'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    let cr=await client.query('SELECT * FROM customers WHERE whatsapp_number=$1 OR phone=$1 LIMIT 1',[customer.whatsappNumber||customer.phone]);
    let cid;
    if(cr.rowCount){cid=cr.rows[0].id; await client.query('UPDATE customers SET name=$1,email=$2,phone=$3,whatsapp_number=$4,address=$5,city=$6,pincode=$7,orders_count=orders_count+1 WHERE id=$8',[customer.name,customer.email||null,customer.phone,customer.whatsappNumber||customer.phone,customer.address||null,customer.city||null,customer.pincode||null,cid]);}
    else {cr=await client.query('INSERT INTO customers(name,email,phone,whatsapp_number,address,city,pincode,orders_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[customer.name,customer.email||null,customer.phone,customer.whatsappNumber||customer.phone,customer.address||null,customer.city||null,customer.pincode||null,1]); cid=cr.rows[0].id;}
    let total=0, normalized=[];
    for(const it of items){const pr=await client.query('SELECT * FROM products WHERE id=$1 FOR UPDATE',[it.productId]); if(!pr.rowCount) throw new Error('Product not found'); const p=pr.rows[0]; const qty=Math.max(1,Number(it.qty||1)); if(p.stock_qty<qty) throw new Error(`${p.name} is out of stock`); total+=Number(p.price)*qty; normalized.push({p,qty});}
    const orderId='ORD-'+Math.floor(10000+Math.random()*90000);
    const payStatus=String(paymentMethod||'Cash on Delivery').toLowerCase().includes('cash')?'Pending':'Pending';
    await client.query('INSERT INTO orders(id,customer_id,status,total,payment_method,payment_status,shipping_address,coupon_code) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[orderId,cid,'Order Placed',total,paymentMethod||'Cash on Delivery',payStatus,[customer.address,customer.city,customer.pincode].filter(Boolean).join(', '),coupon||null]);
    for(const x of normalized){ await client.query('UPDATE products SET stock_qty=stock_qty-$1 WHERE id=$2',[x.qty,x.p.id]); await client.query('INSERT INTO order_items(order_id,product_id,product_name,quantity,unit_price) VALUES($1,$2,$3,$4,$5)',[orderId,x.p.id,x.p.name,x.qty,x.p.price]); }
    await client.query('COMMIT');
    res.json({order:{id:orderId,date:new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}),status:'Order Placed',items:normalized.map(x=>x.p.id),total,pay:paymentMethod||'Cash on Delivery',paymentStatus:payStatus,customer:customer.name}});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message});}finally{client.release();}
});

app.get('/api/orders/:id',async(req,res)=>{try{const r=await pool.query('SELECT o.*,c.name,c.phone,c.whatsapp_number FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=$1',[req.params.id]); if(!r.rowCount)return res.status(404).json({error:'Order not found'}); const i=await pool.query('SELECT * FROM order_items WHERE order_id=$1',[req.params.id]); res.json({order:r.rows[0],items:i.rows});}catch(e){res.status(500).json({error:'Database unavailable'})}});
app.post('/api/orders/:id/status',requireAdmin,async(req,res)=>{try{const r=await pool.query('SELECT o.*,c.* FROM orders o LEFT JOIN customers c ON c.id=o.customer_id WHERE o.id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Order not found'});const old=r.rows[0].status;const status=req.body.status;await pool.query('UPDATE orders SET status=$1 WHERE id=$2',[status,req.params.id]);let wa=null;if(old!==status)wa=await sendWhatsAppStatus(r.rows[0],{id:req.params.id},status);res.json({ok:true,whatsapp:wa});}catch(e){console.error(e);res.status(500).json({error:'Could not update status'})}});

app.get('/health',(req,res)=>res.json({ok:true}));
app.use(express.static(path.join(__dirname,'public')));
app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','customer.html')));

initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`MANA BOMMALU running on port ${PORT}`))).catch(err=>{console.error(err);process.exit(1)});
