/*
 * engine/selftest.mjs   (install44)
 * Run:   node engine/selftest.mjs
 * Proves the engine works OUTSIDE the app (no Firebase, no browser) -
 * exactly how it will run on the AgroBridge server later.
 */
import { centreCapacity, windowList, planLoad, applyPlan } from './capacity.js';
import { correctionRatio } from './models/correction.js';
import { showProbability } from './models/noshow.js';
import { learnThroughput } from './models/throughput.js';
import PARAMS from './models/params.js';

const centre = { name: 'Test Mandi', throughputPerHour: { default: 400 }, bufferPercent: 15, maxSharePercent: 25, operatingStartTime: '08:00', operatingEndTime: '18:00', parallelLanes: 2 };
const cap = centreCapacity(centre, 'wheat');
const slots = windowList(centre);
console.log('\n== Capacity ==', { throughput: cap.throughput, bookable: cap.bookableMinutes, full: cap.fullMinutes, share: cap.shareMinutes });

console.log('\n== Model A: declared -> expected ==');
console.log(' new farmer, wheat 80 q      ->', correctionRatio('wheat', []));
console.log(' farmer who brings +15% (3x) ->', correctionRatio('wheat', [{ declared: 80, actual: 92 }, { declared: 50, actual: 57 }, { declared: 60, actual: 70 }]));

console.log('\n== Model C: P(show) ==');
console.log(' new farmer, app, tomorrow 9AM, 40q ->', showProbability({ pastBookings: 0, pastNoShows: 0, leadDays: 1, hour: 9, quintals: 40 }).pShow);
console.log(' 6 days ahead, 4PM, 120q, 2/5 noshow ->', showProbability({ pastBookings: 5, pastNoShows: 2, leadDays: 6, hour: 16, quintals: 120 }).pShow);
console.log(' booked at gate, now                ->', showProbability({ pastBookings: 0, pastNoShows: 0, leadDays: 0, hour: 11, quintals: 40, bookedVia: 'gate' }).pShow);

console.log('\n== Planner: fill 9:00 with 80 q loads ==');
let queue = {};
let n = 0;
for (;;) {
  const plan = planLoad(cap, slots, queue, 1, 80, { ratio: 1.05, pShow: 0.85 });
  if (!plan.ok) { console.log(` booking #${n + 1}: ❌ ${plan.reason}`); break; }
  queue = { ...queue, ...applyPlan(queue, plan, 80) };
  n += 1;
  console.log(` booking #${n}: ✅ reserved ${plan.reservedQuintals} q, windows ${plan.windows.join('+')} | 09:00 nominal ${queue.slotLoadMinutes['09:00']} min, expected ${queue.slotExpectedMinutes['09:00']} min`);
}
console.log(' (with ratio=1, pShow=1 the old install41 rule applies - try it)');

console.log('\n== install45: perishables ==');
const capR = centreCapacity({ ...centre, perishableReservePercent: 30 }, 'wheat');
console.log(' reserve 30% ->', capR.reserveMinutes, 'of', capR.bookableMinutes, 'bookable minutes held for perishables');
let q2 = {}; let g = 0;
for (;;) { const pl = planLoad(capR, slots, q2, 2, 60, { cropClass: 'grain', leadDays: 3 }); if (!pl.ok) break; q2 = { ...q2, ...applyPlan(q2, pl, 60) }; g += 1; }
console.log(' grain 3 days ahead fills 10:00 up to', q2.slotLoadMinutes['10:00'], 'min (' + g + ' loads) - reserve untouched');
console.log(' tomato same day into that hour ->', planLoad(capR, slots, q2, 2, 60, { cropClass: 'perishable', leadDays: 0 }).ok ? '✅ fits (reserve + buffer)' : '❌');
console.log(' tomato 3 days ahead ->', planLoad(capR, slots, {}, 2, 60, { cropClass: 'perishable', leadDays: 3 }).reason, '(perishables book only today/tomorrow)');
console.log(' grain 9 days ahead  ->', planLoad(capR, slots, {}, 2, 60, { cropClass: 'grain', leadDays: 9 }).reason, '(grain horizon 7 days)');

console.log('\n== Model B: learn throughput from synthetic weighings ==');
const fs = await import('fs');
const csv = fs.readFileSync(new URL('../ml/data/bookings.csv', import.meta.url), 'utf8').trim().split('\n');
const head = csv[0].split(',');
const rows = csv.slice(1).map((l) => Object.fromEntries(l.split(',').map((v, i) => [head[i], v]))).map((r) => ({ weighedAt: r.weighedAt, actualQuantity: Number(r.actual) }));
const learned = learnThroughput(rows);
console.log(' alpha', learned.alpha, 'days', learned.days, 'overall', learned.overall, 'q/h  MAE', learned.mae);
console.log(' per hour', learned.perHour);
console.log('\nparams.js trained on:', PARAMS.trainedOn, '| noshow AUC', PARAMS.noshow.auc, '| samples', PARAMS.samples);
