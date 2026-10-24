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
function extractName(text){ const m=text.match(/(?:मेरा नाम|नाम|name is|i am|मैं)\s*([\u0900-\u097F a-zA-Z]{3,20})/i); return m?m[1].trim().split(" ").slice(0,2).join(" "):null; }
function extractFromText(text, centres){
  const raw=text.toLowerCase();
  // normalize Hindi variations to roman for matching
  const norm = raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  let centreId=null;
  const centreKeywords = {
    "centre_gurugram_01": ["gurugram","gurgaon","गुरु","गुडगाँव","गुड़गांव","गुड़गाँव","gur gram"],
    "centre_sohna_02": ["sohna","सोहना","sohna"],
    "centre_rewari_03": ["rewari","रेवाड़ी","रेवाडी","rewadi"],
    "centre_pataudi_04": ["pataudi","पटौदी","pataudi"],
    "centre_farrukhnagar_05": ["farrukhnagar","फर्रुख","फरुखनगर","farrukh","farukh"],
  };
  for(const c of centres){
    const kws = centreKeywords[c.id] || [c.id.toLowerCase(), String(c.name||"").toLowerCase().slice(0,4)];
    if(kws.some(k=> raw.includes(k) || norm.includes(k))) { centreId=c.id; break; }
  }
  let crop=null;
  const cropKeywords = {
    "wheat": ["wheat","geh","गेह","kank","kanak","gehu","gehun"],
    "paddy": ["paddy","dha","धान","chawal","dhan","padi"],
    "mustard": ["mustard","sar","सरसों","sarso","sarson","must","sarson"],
    "cotton": ["cotton","kap","कपास","kapas"],
    "maize": ["maize","mak","मक्का","corn","makka","makki"],
    "gram": ["gram","chan","चना","chana","chane"],
  };
  for(const c of CROP_LIST){
    const kws = cropKeywords[c.id] || [c.id, c.hi, c.en.toLowerCase()];
    if(kws.some(k=> raw.includes(k) || norm.includes(k.toLowerCase()))) { crop=c.id; break; }
  }
  const qMatch=raw.match(/(\d{1,3})\s*(q|quintal|kuntal|bori|क्विंटल)?/);
  const quantity=qMatch?Number(qMatch[1]):null;
  let date=null;
  const dateMatch=raw.match(/(\d{4}-\d{2}-\d{2})/);
  if(dateMatch) date=dateMatch[1];
  else {
    // Hindi relative dates
    const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if(raw.includes("परसों") || raw.includes("parso")) { const d=new Date(ist); d.setDate(d.getDate()+2); date=fmt(d); }
    else if(raw.includes("कल") || raw.includes("kal")) { const d=new Date(ist); d.setDate(d.getDate()+1); date=fmt(d); }
    else if(raw.includes("आज") || raw.includes("aaj")) { date=fmt(ist); }
    else if(raw.includes("नरसों") || raw.includes("narso")) { const d=new Date(ist); d.setDate(d.getDate()+3); date=fmt(d); }
  }
  const slotMatch=raw.match(/(\d{1,2})\s*[:\-]?\s*00/) || raw.match(/(\d{1,2})\s*baje/) || raw.match(/(\d{1,2})\s*बजे/);
  const slot=slotMatch?`${String(slotMatch[1]).padStart(2,"0")}:00`:null;
  return {centreId,crop,quantity,slot, date};
}
async function ruleBasedReply({messages, phone, store, lang}){
  const centres=await store.fetchCentres();
  const lastUser=[...messages].reverse().find(m=>m.role==="user")?.content||"";
  const historyText=messages.filter(m=>m.role==="user").map(m=>m.content).join(" | ");
  const extracted=extractFromText(historyText, centres);
  // extract farmer name via helper or default to phone
  let farmerName=extractName(historyText) || messages.find(m=>m.role==="user")?.content?.split(" ").slice(0,2).join(" ")||phone;
  if(!farmerName || farmerName.length>20 || /\d/.test(farmerName)) farmerName=phone;
  // single-ask tracking: check what we already asked in last assistant message
  const lastAsk = [...messages].reverse().find(m=>m.role==="assistant")?.content||"";
  const alreadyAsked = (kw)=> lastAsk.includes(kw);
  // check what's missing — ask only once, second time give type fallback
  if(!extracted.centreId){
    if(alreadyAsked("मंडी") || alreadyAsked("mandi")) return lang==="hi" ? `मंडी का नाम अभी भी समझ नहीं आया जी, कृपया नीचे type कर दीजिए — जैसे Gurugram` : `Mandi name still unclear, please type it below.`;
    const list=centres.slice(0,3).map(c=>c.name||c.id).join(", ");
    return lang==="hi"
      ? `कौन सी मंडी में लाना है? ${list} — नाम बता दीजिए।`
      : `Which mandi? Try ${list}.`;
  }
  if(!extracted.crop){
    if(alreadyAsked("फसल") || alreadyAsked("crop")) return lang==="hi" ? `फसल समझ नहीं आई, कृपया type करें — गेहूं/धान/सरसों` : `Crop unclear, please type wheat/paddy/mustard.`;
    return lang==="hi"
      ? `कौन सी फसल है — गेहूं, धान, सरसों?`
      : `Which crop — wheat, paddy or mustard?`;
  }
  if(!extracted.quantity || extracted.quantity<1 || extracted.quantity>999){
    if(alreadyAsked("क्विंटल") || alreadyAsked("quintal") || alreadyAsked("quantity")) return lang==="hi" ? `मात्रा समझ नहीं आई, कृपया type करें — जैसे 20` : `Quantity unclear, please type e.g. 20.`;
    return lang==="hi"
      ? `कितना माल है — कितने क्विंटल?`
      : `How much quantity — how many quintals?`;
  }
  if(!extracted.date){
    if(alreadyAsked("दिन") || alreadyAsked("date")) return lang==="hi" ? `तारीख समझ नहीं आई, कृपया type करें — जैसे 2026-10-24 या कल` : `Date unclear, please type YYYY-MM-DD or kal.`;
    const dates=store.getDateOptions(lang);
    const opts=dates.slice(0,3).map(d=>`${d.value} (${d.label})`).join(" | ");
    return lang==="hi"
      ? `किस दिन आएंगे? ${opts} — बता दीजिए।`
      : `Which date? ${opts}`;
  }
  // need slot
  const centre=await store.fetchCentreById(extracted.centreId);
  const slots=await store.fetchAvailableSlots(centre, extracted.date);
  if(!slots.length){
    return lang==="hi" ? `उस दिन कोई स्लॉट खाली नहीं है जी, दूसरा दिन बताइए।` : `No slots free that day, please pick another date.`;
  }
  if(!extracted.slot || !slots.find(s=>s.slotTime===extracted.slot)){
    if(alreadyAsked("स्लॉट") || alreadyAsked("slot") || alreadyAsked("समय")) return lang==="hi" ? `समय समझ नहीं आया, कृपया type करें — जैसे 10:00` : `Time unclear, please type e.g. 10:00.`;
    const slotList=slots.slice(0,4).map(s=>s.windowLabel).join(", ");
    return lang==="hi"
      ? `वाह जी, ${extracted.date} को ये स्लॉट खाली हैं: ${slotList}। कौन सा समय चाहिए?`
      : `${extracted.date} has these free: ${slotList}. Which time slot?`;
  }
  // all collected -> if user said everything in one go and is asking to book, auto-confirm if they said "chahiye" or gave slot
  const last=lastUser.toLowerCase();
  const isConfirm = /(ha|yes|confirm|kar do|book|theek|ok|chahiye|कर.*दो|बुक)/.test(last);
  const isOneShot = extracted.centreId && extracted.crop && extracted.quantity && extracted.date && extracted.slot && /(chahiye|चाहिए|book|करो)/.test(last);
  if(!isConfirm && !isOneShot){
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
  const OPENROUTER_KEY=process.env.OPENROUTER_API_KEY||"";
  const OPENROUTER_MODEL=process.env.OPENROUTER_MODEL||"meta-llama/llama-3.1-8b-instruct:free";
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

  async function callOpenRouter(messages, phone, lang){
    const OpenAI=require("openai");
    const client=new OpenAI({apiKey:OPENROUTER_KEY, baseURL: "https://openrouter.ai/api/v1"});
    const centres=await store.fetchCentres();
    const centreHint=`Active mandis: ${centres.map(c=>`${c.id} (${c.name||c.id})`).join(", ")}.`;
    const sys=SYSTEM_PROMPT+"\n"+centreHint+`\nFarmer phone: ${phone}. Today IST: ${new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}. Use OpenRouter model ${OPENROUTER_MODEL}.`;
    const tools=buildTools();
    const resp=await client.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages:[{role:"system", content:sys}, ...messages],
      tools, tool_choice:"auto", temperature:0.6, max_tokens:300,
    });
    const msg=resp.choices[0].message;
    if(msg.tool_calls && msg.tool_calls.length){
      const toolResults=[];
      for(const tc of msg.tool_calls){
        const name=tc.function.name; const args=JSON.parse(tc.function.arguments||"{}"); let result="";
        try{
          if(name==="list_mandis"){ result=JSON.stringify(centres.slice(0,10).map(c=>({id:c.id,name:c.name}))); }
          else if(name==="list_crops"){ result=JSON.stringify(CROP_LIST); }
          else if(name==="list_dates"){ result=JSON.stringify(store.getDateOptions(args.lang||lang)); }
          else if(name==="list_slots"){ const centre=await store.fetchCentreById(args.centreId); const slots=await store.fetchAvailableSlots(centre,args.date); result=JSON.stringify(slots.slice(0,10)); }
          else if(name==="book_slot"){ const centre=await store.fetchCentreById(args.centreId); const booking=await store.createBooking({farmerId:phone, farmerName:args.farmerName||phone, centre, crop:args.crop, quantity:args.quantity, date:args.date, slot:args.slot}); result=JSON.stringify({ok:true, tokenNumber:booking.tokenNumber, gatePassCode:booking.gatePassCode}); }
        }catch(e){ result=JSON.stringify({error:e.message}); }
        toolResults.push({ tool_call_id: tc.id, role:"tool", content: result });
      }
      const second=await client.chat.completions.create({
        model: OPENROUTER_MODEL,
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

  async function handleChat({messages=[], phone="9100000001", lang="hi"}={}){
    const cleanMessages = Array.isArray(messages) ? messages : [];
    if(!cleanMessages.length) return {reply: lang==="hi"?"नमस्ते जी! मैं एग्रोब्रिज एआई हूँ। कैसे मदद करूँ? मंडी का नाम बताइए।":"Hello! I'm AgroBridge AI. Which mandi do you want to book?", done:false};
    let reply="";
    try{
      if(OPENROUTER_KEY) reply=await callOpenRouter(cleanMessages, phone, lang);
      else if(OPENAI_KEY) reply=await callOpenAI(cleanMessages, phone, lang);
      else if(GEMINI_KEY) reply=await callGemini(cleanMessages, phone, lang);
      else reply=await ruleBasedReply({messages: cleanMessages, phone, store, lang});
    }catch(inner){
      console.error("ai-agent llm failed, falling back to rule-based:", inner.message);
      reply=await ruleBasedReply({messages: cleanMessages, phone, store, lang});
    }
    if(!reply || !String(reply).trim()){
      reply=await ruleBasedReply({messages: cleanMessages, phone, store, lang});
    }
    const isDone=/(टोकन|गेट कोड|हो गया|done|token)/i.test(reply);
    return {reply, done:isDone};
  }

  return {store, handleChat};
}

module.exports={makeAiAgent};
