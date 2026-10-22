/*
 * ivr/retell.js — Retell AI webhook for AgroBridge
 * Retell calls POST /retell/webhook with {function_name, arguments}
 * We use same Firestore store as ivr-core, so bookings appear in app instantly.
 */
function makeRetellWebhook({ db }) {
  const { FieldValue } = require("firebase-admin/firestore");
  function capacityPerWindow(c){ const per=Number(c?.avgMinutesPerEntry)||15; const lanes=Number(c?.parallelLanes)||1; return Math.max(1, Math.floor((60/per)*lanes));}
  function formatHour(h){ const ampm=h>=12?"PM":"AM"; const h12=h%12===0?12:h%12; return `${h12}:00 ${ampm}`; }
  async function fetchCentres(){ const snap=await db.collection("centres").get(); return snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.active!==false); }
  async function fetchCentreById(id){ if(!id) return null; const s=await db.collection("centres").doc(id).get(); return s.exists?{id:s.id,...s.data()}:null; }
  async function fetchAvailableSlots(centre,dateStr){
    const capacity=capacityPerWindow(centre);
    const q=await db.collection("centreQueues").doc(`${centre.id}__${dateStr}`).get();
    const counts=q.exists?(q.data().slotCounts||{}):{};
    const [sh]=String(centre.operatingStartTime||"08:00").split(":").map(Number);
    const [eh]=String(centre.operatingEndTime||"18:00").split(":").map(Number);
    const slots=[]; const nowIst=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    const todayStr=`${nowIst.getFullYear()}-${String(nowIst.getMonth()+1).padStart(2,"0")}-${String(nowIst.getDate()).padStart(2,"0")}`;
    for(let h=sh;h<eh;h++){ if(dateStr===todayStr && h<=nowIst.getHours()) continue; const slotTime=`${String(h).padStart(2,"0")}:00`; const booked=Number(counts[slotTime])||0; const avail=Math.max(0,capacity-booked); if(avail>0) slots.push({slotTime, windowLabel:`${formatHour(h)} - ${formatHour(h+1)}`, availableCapacity:avail});}
    return slots;
  }
  function getDateOptions(){
    const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
    return [0,1,2,3].map(d=>{ const dt=new Date(ist); dt.setDate(dt.getDate()+d); const value=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`; let label=dt.toLocaleDateString("hi-IN",{weekday:"long",day:"numeric",month:"long"}); if(d===0) label="आज, "+label; if(d===1) label="कल, "+label; return {value,label};});
  }
  async function createBooking({farmerPhone, farmerName, centreId, crop, quantity, date, slot}){
    const centre=await fetchCentreById(centreId); if(!centre) throw new Error("Mandi not found: "+centreId);
    const capacity=capacityPerWindow(centre);
    const queueRef=db.collection("centreQueues").doc(`${centre.id}__${date}`);
    const tokenId=`TKN-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    const bookingRef=db.collection("bookings").doc(tokenId);
    const gatePassCode=String(Math.floor(100000+Math.random()*900000));
    return db.runTransaction(async(tx)=>{
      const qs=await tx.get(queueRef); const counts=qs.exists?(qs.data().slotCounts||{}):{}; const booked=Number(counts[slot])||0;
      if(booked>=capacity) throw new Error("SLOT_FULL");
      const openPositions=qs.exists?(qs.data().openPositions||[]):[]; const maxPos=openPositions.length?Math.max(...openPositions):0; const position=maxPos+1;
      const letter=String.fromCharCode(65+Math.floor((position-1)/20)); const num=String(((position-1)%20)+1).padStart(2,"0"); const tokenNumber=`${letter}-${num}`;
      const booking={tokenId, tokenNumber, gatePassCode, farmerId:farmerPhone, farmerName:farmerName||farmerPhone, centreId:centre.id, centreName:centre.name||centre.id, crop, quantity:Number(quantity), date, slot, status:"booked", positionAssigned:position, createdAt:new Date().toISOString(), source:"retell-ai"};
      tx.set(bookingRef, booking);
      tx.set(queueRef, {slotCounts:{...counts,[slot]:booked+1}, openPositions:[...openPositions, position], updatedAt:new Date().toISOString()}, {merge:true});
      return booking;
    });
  }

  async function handleWebhook(req,res){
    try{
      const body=req.body||{};
      // Retell sends {function_name, arguments, call_id} or {name, args}
      const fn = body.function_name || body.name || body.function || "";
      const args = body.arguments || body.args || body.parameters || {};
      // also support Retell's "custom function" format: {function_call:{name, arguments}}
      const fc = body.function_call || body.tool_call || {};
      const finalFn = fn || fc.name || "";
      const finalArgs = Object.keys(args).length ? args : (fc.arguments ? (typeof fc.arguments==="string"?JSON.parse(fc.arguments):fc.arguments) : {});
      console.log("retell webhook:", finalFn, finalArgs);
      let result={};
      if(finalFn==="list_mandis"){
        const centres=await fetchCentres(); result={mandis: centres.slice(0,10).map(c=>({id:c.id, name:c.name||c.id, address:c.address||""}))};
      } else if(finalFn==="list_dates"){
        result={dates: getDateOptions()};
      } else if(finalFn==="list_slots"){
        const centre=await fetchCentreById(finalArgs.centreId); if(!centre) throw new Error("Mandi not found");
        const slots=await fetchAvailableSlots(centre, finalArgs.date); result={centreName: centre.name, date: finalArgs.date, slots};
      } else if(finalFn==="book_slot"){
        const b=await createBooking({farmerPhone: finalArgs.farmerPhone || finalArgs.phone || "9100000001", farmerName: finalArgs.farmerName || finalArgs.name, centreId: finalArgs.centreId, crop: finalArgs.crop, quantity: finalArgs.quantity, date: finalArgs.date, slot: finalArgs.slot});
        result={ok:true, tokenNumber:b.tokenNumber, gatePassCode:b.gatePassCode, message:`बुकिंग हो गई जी! टोकन ${b.tokenNumber.split("").join(" ")} , गेट कोड ${b.gatePassCode.split("").join(" ")}`};
      } else {
        result={error:"Unknown function: "+finalFn, available:["list_mandis","list_dates","list_slots","book_slot"]};
      }
      res.json(result);
    }catch(e){
      console.error("retell webhook error:", e);
      res.status(500).json({error:e.message});
    }
  }
  return {handleWebhook};
}
module.exports={makeRetellWebhook};
