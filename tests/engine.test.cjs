const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine.js'),D=require('../campaign-data.js');
const routes=require('./ending-routes.json');
const step=(s,i)=>E.advance(E.choose(s,i));
const at=id=>D.episodes.findIndex(e=>e.id===id);
function historicTo(side,id){let s=E.initial(side);while(D.episodes[s.index].id!==id)s=step(s,E.current(s).choices[side].findIndex(c=>c.historical));return s;}

test('19 complete chapters, 114 base options, exposition and sources',()=>{
  assert.equal(D.episodes.length,19);assert.equal(new Set(D.episodes.map(e=>e.id)).size,19);
  let year=0,count=0;
  for(const ep of D.episodes){
    assert(ep.year>=year);year=ep.year;
    assert(ep.exposition.origin.length>100);assert(ep.exposition.stakes.length>80);assert(ep.exposition.interests.length>=3);
    for(const id of ep.sources)assert.match(D.sources[id].url,/^https:\/\//);
    for(const side of ['usa','ussr']){
      assert.equal(ep.choices[side].length,3);assert.equal(ep.choices[side].filter(c=>c.historical).length,1);
      for(const c of ep.choices[side]){count++;assert(c.why&&c.outcome);for(const n of Object.values(c.delta))assert(Number.isFinite(n));}
    }
  }
  assert.equal(count,114);assert.equal(year,1991);
});
for(const side of ['usa','ussr'])test(`all historical decisions yield dedicated ${side} ending; every phase restores`,()=>{
  let s=E.initial(side);
  while(s.phase!=='ending'){
    assert.equal(s.phase,'decision');assert.deepEqual(E.restore(E.serialize(s)),s);
    s=E.choose(s,E.current(s).choices[side].findIndex(c=>c.historical));
    assert.deepEqual(E.restore(E.serialize(s)),s);assert.throws(()=>E.choose(s,0));s=E.advance(s);
  }
  assert.equal(s.history.length,19);assert.equal(s.ending,`historical_${side}`);assert.deepEqual(E.restore(E.serialize(s)),s);
});
test('earlier diplomacy changes actual Berlin context, options and later city instead of resetting',()=>{
  let s=step(step(E.initial('usa'),1),1);
  assert.equal(E.current(s).branch.id,'berlin_compromise');
  assert.equal(E.current(s).title,'Берлин без блокады');
  assert(!E.current(s).choices.usa.some(c=>c.title.includes('воздушный мост')));
  s=step(s,0);
  while(D.episodes[s.index].id!=='wall')s=step(s,0);
  assert.equal(E.current(s).branch.id,'open_berlin');
  s=step(s,2);
  assert.equal(E.current(s).branch.id,'cuba_guarantees');
  assert.deepEqual(E.restore(E.serialize(s)),s);
});
test('preview, persistent costs and economic preparation agree with applied changes',()=>{
  const s=historicTo('usa','budget1953'),old=structuredClone(s),choice=E.current(s).choices.usa[2],p=E.preview(s,choice);
  const result=E.choose(s,2),next=E.advance(result);
  assert.deepEqual(s,old);assert.deepEqual(p.stats,result.stats);assert.deepEqual(p.strategic,result.strategic);
  assert(next.ledger.military>=2);assert.equal(next.stats.resources,Math.max(0,Math.min(100,result.stats.resources+next.ledger.net)));
  const invested=E.choose(s,1);assert(E.budget(invested,D.episodes[invested.index+1]).income>=E.budget(result,D.episodes[result.index+1]).income);
});
test('Vietnam intervention creates a visible recurring cost in the very next chapter',()=>{
  const s=historicTo('usa','vietnam'),war=step(s,0),limited=step(s,1);
  assert.equal(E.current(war).id,'economy1965');assert.equal(war.ledger.wars,3);assert.equal(limited.ledger.wars,0);
  assert(war.stats.resources<limited.stats.resources);assert(E.carry(war).some(x=>x.includes('3 пункта')));
});
test('new union treaty requires both institutions and material support',()=>{
  const s=historicTo('ussr','settlement1990'),c=E.current(s).choices.ussr[1];
  assert(E.availability(s,c));assert.throws(()=>E.choose(s,1));
  s.flags.reforms=2;s.strategic.economy=60;s.strategic.stability=50;
  assert.equal(E.availability(s,c),'');assert(E.choose(s,1).flags.unionAgreement);
});
test('a direct Cuban clash opens a war decision even below 100 tension',()=>{
  const s=historicTo('usa','cuba');s.stats.tension=0;
  const result=E.choose(s,1);assert(result.stats.tension<100);assert(result.pendingWar);
  assert.equal(E.advance(result).phase,'war');
});
test('conventional outcomes depend on readiness, economy and allies; nuclear war has no winner',()=>{
  let s=E.advance(E.choose(historicTo('usa','cuba'),1));s.rival={economy:50,allies:50,readiness:50};
  s.strategic={economy:50,allies:50,readiness:50,stability:65};
  assert.equal(E.chooseWar(s,1).ending,'war_stalemate');
  for(const key of ['economy','allies','readiness']){
    const high=structuredClone(s);high.strategic[key]=100;assert.equal(E.chooseWar(high,1).ending,'war_victory');
    const low=structuredClone(s);low.strategic[key]=0;assert.equal(E.chooseWar(low,1).ending,'war_defeat');
  }
  s.strategic={economy:100,allies:100,readiness:100,stability:100};assert.equal(E.chooseWar(s,2).ending,'nuclear');
});
test('ceasefire can resume a campaign, persists its costs and cannot be applied twice',()=>{
  let s=E.advance(E.choose(historicTo('usa','cuba'),1));s.flags.channel=true;
  const oldBudget=s.stats.resources;s=E.chooseWar(s,0);
  assert.equal(s.phase,'war_result');assert.equal(s.stats.resources,oldBudget-8);assert.throws(()=>E.chooseWar(s,0));
  s=E.advance(s);assert.equal(s.phase,'decision');assert.equal(E.current(s).id,'vietnam');
});
test('all 12 alternative endings have legal reproducible routes; source data are immutable',()=>{
  const before=JSON.stringify(D.episodes);
  for(const [ending,save]of Object.entries(routes)){
    const s=E.restore(JSON.stringify(save));assert(s,ending);assert.equal(s.ending,ending);assert.equal(s.phase,'ending');
    assert.deepEqual(E.restore(E.serialize(s)),s);
  }
  assert.equal(Object.keys(routes).length,12);assert.equal(JSON.stringify(D.episodes),before);
});
test('a single different choice disqualifies the historical ending',()=>{
  let s=step(E.initial('usa'),1);
  while(s.phase!=='ending'){const cs=E.current(s).choices.usa;const i=cs.findIndex(c=>c.historical);s=step(s,i<0?0:i);}
  assert(!s.historical);assert.notEqual(s.ending,'historical_usa');
});
test('corrupt, legacy, impossible and injected saves are rejected',()=>{
  const samples=['','null','[]','{}','{',JSON.stringify({version:1,side:'usa',decisions:[],phase:'decision'}),JSON.stringify({version:2,side:'__proto__',decisions:[],phase:'decision'}),JSON.stringify({version:2,side:'usa',decisions:[{choice:0,warChoice:2}],phase:'ending'}),JSON.stringify({version:2,side:'usa',decisions:[{choice:99}],phase:'result'}),JSON.stringify({version:2,side:'usa',decisions:[],phase:'war'})];
  for(const raw of samples)assert.equal(E.restore(raw),null);
  const p=JSON.parse(E.serialize(E.initial('usa')));p.stats={resources:999};assert.equal(E.restore(JSON.stringify(p)).stats.resources,70);
});
test('war state, result, ending and retry all restore exactly',()=>{
  let s=historicTo('usa','cuba');const before=structuredClone(s);s=E.advance(E.choose(s,1));
  assert.deepEqual(E.restore(E.serialize(s)),s);s=E.chooseWar(s,2);assert.deepEqual(E.restore(E.serialize(s)),s);
  s=E.advance(s);assert.deepEqual(E.restore(E.serialize(s)),s);
  const p=JSON.parse(E.serialize(s));p.decisions.pop();p.phase='decision';assert.deepEqual(E.restore(JSON.stringify(p)),before);
});
test('2,000 varied legal routes keep bounds and survive save replay',()=>{
  let seed=4815;
  const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let run=0;run<2000;run++){
    let s=E.initial(run%2?'usa':'ussr');
    for(let steps=0;steps<80&&s.phase!=='ending';steps++){
      if(s.phase==='decision'){
        const opts=E.current(s).choices[s.side].map((c,i)=>({c,i})).filter(({c})=>!E.availability(s,c));
        s=E.choose(s,opts[random(opts.length)].i);
      }else if(s.phase==='war'){
        const opts=E.warOptions(s).map((o,i)=>({o,i})).filter(({o})=>!o.blocked);s=E.chooseWar(s,opts[random(opts.length)].i);
      }else s=E.advance(s);
      for(const n of [...Object.values(s.stats),...Object.values(s.strategic),...Object.values(s.rival)])assert(Number.isInteger(n)&&n>=0&&n<=100);
    }
    assert.equal(s.phase,'ending');assert.deepEqual(E.restore(E.serialize(s)),s);
  }
});
