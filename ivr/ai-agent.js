/*
 * ivr/ai-agent.js — AGROBRIDGE AI Booking Agent (natural conversation)
 * Keeps IVR untouched. Adds:
 *   POST /agent/chat   -> {messages, phone, lang}  -> {reply, booking?}
 * Uses OpenAI (if OPENAI_API_KEY) else Gemini (if GEMINI_API_KEY) else rule-based fallback (free, no key)
 * Tools call the SAME Firestore as ivr-core.js so bookings appear everywhere.
 */
const { FieldValue } = require("firebase-admin/firestore");

const CROP_LIST = [
  { id: "wheat", en: "Wheat", hi: "गेहूँ" },
  { id: "paddy", en: "Paddy", hi: "धान" },
  { id: "mustard", en: "Mustard", hi: "सरसों" },
  { id: "cotton", en: "Cotton", hi: "कपास" },
  { id: "maize", en: "Maize", hi: "मक्का" },
  { id: "gram", en: "Gram", hi: "चना" },
];
const ACTIVE_STATUSES = ["booked", "in-gate", "assay", "price-fixed", "weighing", "payment-processing"];

function spell(s){ return String(s||"").replace(/-/g," ").split("").join(" ").trim(); }
function capacityPerWindow(c){ const per=Number(c?.avgMinutesPerEntry)||15; const lanes=Number(c?.parallelLanes)||1; return Math.max(1, Math.floor((60/per)*lanes));}
function formatHour(h){ const ampm=h>=12?"PM":"AM"; const h12=h%12===0?12:h%12; return `${h12}:00 ${ampm}`; }

function makeStore(db){
  async function fetchCentres(){ const snap=await db.collection("centres").get(); return snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.active!==false).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""))); }
  async function fetchCentreById(id){ if(!id) return null; const s=await db.collection("centres").doc(id).get(); return s.exists?{id:s.id,...s.data()}:null; }
  async function fetchAvailableSlots(centre,dateStr){
    const capacity=capacityPerWindow(centre);
    const q=await db.collection("centreQueues").doc(`${centre.id}__${dateStr}`).get();
    const counts=q.exists?(q.data().slotCounts||{}):{};
    const [sh]=String(centre.operatingStartTime||"08:00").split(":").map(Number);
    const [eh]=String(centre.operatingEndTime||"18:00").split(":").map(Number);
    const slots=[];
    const nowIst=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    const todayStr=`${nowIst.getFullYear()}-${String(nowIst.getMonth()+1).padStart(2,"0")}-${String(nowIst.getDate()).padStart(2,"0")}`;
    for(let h=sh;h<eh;h++){
      if(dateStr===todayStr && h<=nowIst.getHours()) continue;
      const slotTime=`${String(h).padStart(2,"0")}:00`;
      const booked=Number(counts[slotTime])||0;
      const avail=Math.max(0,capacity-booked);
      if(avail>0) slots.push({slotTime, windowLabel:`${formatHour(h)} - ${formatHour(h+1)}`, availableCapacity:avail});
    }
    return slots;
  }
  function getDateOptions(lang){
    const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    return [0,1,2,3].map(d=>{
      const dt=new Date(ist); dt.setDate(dt.getDate()+d);
      const value=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
      let label=dt.toLocaleDateString(lang==="hi"?"hi-IN":"en-IN",{weekday:"long",day:"numeric",month:"long"});
      if(d===0) label=(lang==="hi"?"आज, ":"Today, ")+label;
      if(d===1) label=(lang==="hi"?"कल, ":"Tomorrow, ")+label;
      return {value,label};
    });
  }
  async function createBooking({farmerId, farmerName, centre, crop, quantity, date, slot}){
    const capacity=capacityPerWindow(centre);
    const queueRef=db.collection("centreQueues").doc(`${centre.id}__${date}`);
    const tokenId=`TKN-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const bookingRef=db.collection("bookings").doc(tokenId);
    const gatePassCode=String(Math.floor(100000+Math.random()*900000));
    return db.runTransaction(async(tx)=>{
      const qs=await tx.get(queueRef);
      const counts=qs.exists?(qs.data().slotCounts||{}):{};
      const booked=Number(counts[slot])||0;
      if(booked>=capacity) throw new Error("SLOT_FULL");
      const openPositions=qs.exists?(qs.data().openPositions||[]):[];
      const maxPos=openPositions.length?Math.max(...openPositions):0;
      const position=maxPos+1;
      const letter=String.fromCharCode(65+Math.floor((position-1)/20));
      const num=String(((position-1)%20)+1).padStart(2,"0");
      const tokenNumber=`${letter}-${num}`;
      const booking={
        tokenId, tokenNumber, gatePassCode,
        farmerId, farmerName: farmerName||farmerId,
        centreId: centre.id, centreName: centre.name||centre.id,
        crop, quantity: Number(quantity),
        date, slot,
        status:"booked",
        positionAssigned: position,
        createdAt: new Date().toISOString(),
        source:"ai-agent",
      };
      tx.set(bookingRef, booking);
      tx.set(queueRef, {
        slotCounts:{...counts,[slot]:booked+1},
        openPositions:[...openPositions, position],
        updatedAt: new Date().toISOString(),
      },{merge:true});
      return booking;
    });
  }
  return {fetchCentres, fetchCentreById, fetchAvailableSlots, getDateOptions, createBooking, capacityPerWindow};
}

const SYSTEM_PROMPT = `You are AgroBridge AI Booking Assistant — a warm, human, Indian farmer helper. Speak ONLY in clear Hindi (Devanagari script) when lang is 'hi', pure Hindi with 'जी' respectfully. Never use Roman Hindi. Be natural like a person, not a robot.

Goal: book a mandi slot. Collect step by step by asking like a human: 
1) farmer name (if not known), 2) mandi, 3) crop (wheat/paddy/mustard/cotton/maize/gram), 4) quantity 1-999 quintals, 5) date (next 4 days), 6) time slot.

Rules:
- Ask ONE question at a time, like a real conversation. Interrogate gently.
- If user says mandi/crop/quantity together, extract all.
- Confirm before booking in Hindi Devanagari: "तो {mandi}, {crop}, {quantity} क्विंटल, {date} {slot} — कन्फर्म करूँ जी?"
- On booking success, spell token like "A - 0 5" and give gate code.
- If slot full, suggest another slot nearby.
- Keep reply under 40 words, friendly, short.
- Always reply in Devanagari Hindi if lang is 'hi', else English. Never mix Roman Hindi.`;

function buildTools(){ return [
  { type:"function", function:{ name:"list_mandis", description:"List active mandis with id and name", parameters:{type:"object", properties:{}, required:[]} }},
  { type:"function", function:{ name:"list_crops", description:"List crops accepted", parameters:{type:"object", properties:{}, required:[]} }},
  { type:"function", function:{ name:"list_dates", description:"List next 4 bookable dates", parameters:{type:"object", properties:{ lang:{type:"string", enum:["hi","en"]} }, required:[]} }},
  { type:"function", function:{ name:"list_slots", description:"List available time slots for a mandi and date", parameters:{type:"object", properties:{ centreId:{type:"string"}, date:{type:"string"} }, required:["centreId","date"]} }},
  { type:"function", function:{ name:"book_slot", description:"Create booking after all details collected", parameters:{type:"object", properties:{
    centreId:{type:"string"}, crop:{type:"string", enum:CROP_LIST.map(c=>c.id)}, quantity:{type:"integer"}, date:{type:"string"}, slot:{type:"string"}, farmerName:{type:"string"}
  }, required:["centreId","crop","quantity","date","slot"]} }},
];}

// ---------- rule-based fallback (no API key, still sounds human) ----------
function extractFromText(text, centres){
  const t=text.toLowerCase();
  let centreId=null;
  for(const c of centres){ if(t.includes(c.id.toLowerCase()) || t.includes(String(c.name||"").toLowerCase().slice(0,4))) {centreId=c.id; break;} }
  let crop=null;
  for(const c of CROP_LIST){ if(t.includes(c.id) || t.includes(c.hi) || t.includes(c.en.toLowerCase())) crop=c.id; }
  const qMatch=t.match(/(\d{1,3})\s*(q|quintal|kuntal|bori)?/);
  const quantity=qMatch?Number(qMatch[1]):null;
  const dateMatch=t.match(/(\d{4}-\d{2}-\d{2})/);
  const slotMatch=t.match(/(\d{1,2})\s*[:\-]?\s*00/);
  const slot=slotMatch?`${String(slotMatch[1]).padStart(2,"0")}:00`:null;
  return {centreId,crop,quantity,slot, date: dateMatch?dateMatch[1]:null};
}
async function ruleBasedReply({messages, phone, store, lang}){
  const centres=await store.fetchCentres();
  const lastUser=[...messages].reverse().find(m=>m.role==="user")?.content||"";
  const historyText=messages.filter(m=>m.role==="user").map(m=>m.content).join(" | ");
  const extracted=extractFromText(historyText, centres);
  // try to infer farmerName from first user message if looks like name
  let farmerName=messages.find(m=>m.role==="user")?.content?.split(" ").slice(0,2).join(" ")||phone;
  if(farmerName.length>20) farmerName=phone;
  // check what's missing
  if(!extracted.centreId){
    const list=centres.slice(0,3).map(c=>c.name||c.id).join(", ");
    return lang==="hi"
      ? `बिल्कुल जी! कौन सी मंडी में लाना है? ${list} — नाम बता दीजिए।`
      : `Sure! Which mandi do you want? Try ${list} — just tell me the name.`;
  }
  if(!extracted.crop){
    return lang==="hi"
      ? `समझ गया जी, ${extracted.centreId} में। कौन सी फसल है — गेहूं, धान, सरसों?`
      : `Got it — ${extracted.centreId}. Which crop — wheat, paddy or mustard?`;
  }
  if(!extracted.quantity || extracted.quantity<1 || extracted.quantity>999){
    return lang==="hi"
      ? `ठीक है, ${extracted.crop} जी। कितना माल है — कितने क्विंटल?`
      : `Great, ${extracted.crop}. How much quantity — how many quintals?`;
  }
  if(!extracted.date){
    const dates=store.getDateOptions(lang);
    const opts=dates.slice(0,3).map(d=>`${d.value} (${d.label})`).join(" | ");
    return lang==="hi"
      ? `शुक्रिया जी, ${extracted.quantity} क्विंटल। किस दिन आएंगे? ${opts} — बता दीजिए।`
      : `Thanks, ${extracted.quantity} quintals. Which date? ${opts}`;
  }
  // need slot
  const centre=await store.fetchCentreById(extracted.centreId);
  const slots=await store.fetchAvailableSlots(centre, extracted.date);
  if(!slots.length){
    return lang==="hi" ? `उस दिन कोई स्लॉट खाली नहीं है जी, दूसरा दिन बताइए।` : `No slots free that day, please pick another date.`;
  }
  if(!extracted.slot || !slots.find(s=>s.slotTime===extracted.slot)){
    const slotList=slots.slice(0,4).map(s=>s.windowLabel).join(", ");
    return lang==="hi"
      ? `वाह जी, ${extracted.date} को ये स्लॉट खाली हैं: ${slotList}। कौन सा समय चाहिए?`
      : `${extracted.date} has these free: ${slotList}. Which time slot?`;
  }
  // all collected -> ask confirm if last message not confirming
  const last=lastUser.toLowerCase();
  const isConfirm = /(ha|yes|confirm|kar do|book|theek|ok)/.test(last);
  if(!isConfirm){
    return lang==="hi"
      ? `तो कन्फर्म करूं जी — ${centre.name||centre.id}, ${extracted.crop}, ${extracted.quantity} क्विंटल, ${extracted.date} ${extracted.slot} वाली स्लॉट? हाँ बोलिए तो बुक कर देता हूँ।`
      : `Confirm — ${centre.name||centre.id}, ${extracted.crop}, ${extracted.quantity} quintals, ${extracted.date} ${extracted.slot}? Say yes to book.`;
  }
  // book
  try{
    const booking=await store.createBooking({farmerId:phone, farmerName, centre, crop:extracted.crop, quantity:extracted.quantity, date:extracted.date, slot:extracted.slot});
    return lang==="hi"
      ? `हो गया जी! टोकन ${spell(booking.tokenNumber)} — गेट कोड ${spell(booking.gatePassCode)}. ${extracted.date} ${extracted.slot} पर आइए। धन्यवाद!`
      : `Done! Token ${spell(booking.tokenNumber)} — गेट कोड ${spell(booking.gatePassCode)}. Come on ${extracted.date} at ${extracted.slot}. Thank you!`
  }catch(e){
    if(String(e.message).includes("SLOT_FULL")) return lang==="hi"?`अरे वाह, ये स्लॉट अभी भर गया। दूसरा समय बताइए।`:`That slot just got full, pick another time.`;
    return lang==="hi"?`कुछ गड़बड़ हो गई जी, फिर से कोशिश करते हैं।`:`Something went wrong, let's try again.`;
  }
}

function makeAiAgent({db}){
  const store=makeStore(db);
  const OPENAI_KEY=process.env.OPENAI_API_KEY||process.env.OPENAI_KEY||"";
  const GEMINI_KEY=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||"";

  async function callOpenAI(messages, phone, lang){
    const OpenAI=require("openai");
    const client=new OpenAI({apiKey:OPENAI_KEY});
    const centres=await store.fetchCentres();
    const centreHint=`Active mandis: ${centres.map(c=>`${c.id} (${c.name||c.id})`).join(", ")}.`;
    const sys=SYSTEM_PROMPT+"\n"+centreHint+`\nFarmer phone: ${phone}. Today IST: ${new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}.`;
    const tools=buildTools();
    const resp=await client.chat.completions.create({
      model: process.env.OPENAI_MODEL||"gpt-4o-mini",
      messages:[{role:"system", content:sys}, ...messages],
      tools, tool_choice:"auto", temperature:0.6, max_tokens:300
    });
    const msg=resp.choices[0].message;
    // handle tool calls
    if(msg.tool_calls && msg.tool_calls.length){
      const toolResults=[];
      for(const tc of msg.tool_calls){
        const name=tc.function.name;
        const args=JSON.parse(tc.function.arguments||"{}");
        let result="";
        try{
          if(name==="list_mandis"){ result=JSON.stringify(centres.slice(0,10).map(c=>({id:c.id,name:c.name}))); }
          else if(name==="list_crops"){ result=JSON.stringify(CROP_LIST); }
          else if(name==="list_dates"){ result=JSON.stringify(store.getDateOptions(args.lang||lang)); }
          else if(name==="list_slots"){ const centre=await store.fetchCentreById(args.centreId); const slots=await store.fetchAvailableSlots(centre,args.date); result=JSON.stringify(slots.slice(0,10)); }
          else if(name==="book_slot"){
            const centre=await store.fetchCentreById(args.centreId);
            const booking=await store.createBooking({farmerId:phone, farmerName:args.farmerName||phone, centre, crop:args.crop, quantity:args.quantity, date:args.date, slot:args.slot});
            result=JSON.stringify({ok:true, tokenNumber:booking.tokenNumber, gatePassCode:booking.gatePassCode, date:booking.date, slot:booking.slot});
          }
        }catch(e){ result=JSON.stringify({error:e.message}); }
        toolResults.push({ tool_call_id: tc.id, role:"tool", content: result });
      }
      const second=await client.chat.completions.create({
        model: process.env.OPENAI_MODEL||"gpt-4o-mini",
        messages:[{role:"system", content:sys}, ...messages, msg, ...toolResults],
        temperature:0.6, max_tokens:300
      });
      return second.choices[0].message.content;
    }
    return msg.content;
  }

  async function callGemini(messages, phone, lang){
    const centres=await store.fetchCentres();
    const prompt=SYSTEM_PROMPT+"\nActive mandis: "+centres.map(c=>c.id).join(", ")+"\nFarmer phone:"+phone+"\nConversation:\n"+messages.map(m=>`${m.role}: ${m.content}`).join("\n")+"\nReply as assistant in "+(lang==="hi"?"Hindi":"English")+":";
    const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({contents:[{parts:[{text:prompt}]}]})
    });
    const j=await res.json();
    return j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  async function handleChat(req,res){
    try{
      const {messages=[], phone="9100000001", lang="hi"} = req.body||{};
      if(!Array.isArray(messages) || !messages.length) return res.json({reply: lang==="hi"?"नमस्ते जी! मैं एग्रोब्रिज एआई हूँ। कैसे मदद करूँ? मंडी का नाम बताइए।":"Hello! I'm AgroBridge AI. Which mandi do you want to book?"});
      let reply="";
      if(OPENAI_KEY) reply=await callOpenAI(messages, phone, lang);
      else if(GEMINI_KEY) reply=await callGemini(messages, phone, lang);
      else reply=await ruleBasedReply({messages, phone, store, lang});
      // detect booking success
      const isDone=/(token|gate code|ho gaya|done)/i.test(reply);
      return res.json({reply, done:isDone});
    }catch(e){
      console.error("ai-agent error",e);
      res.status(500).json({reply:"क्षमा कीजिए जी, थोड़ी तकनीकी दिक्कत आ गई। कृपया फिर से बताइए।", error:e.message});
    }
  }

  return {store, handleChat};
}

module.exports={makeAiAgent};
