// Нужен для проверки достижимости концовок без изменения правил и состояния.
const E=require('../engine.js'),fs=require('node:fs'),path=require('node:path');
const found={};let seed=1991;
function random(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
for(let run=0;run<6000;run++){
  let s=E.initial(run%2?'usa':'ussr');
  for(let steps=0;steps<70&&s.phase!=='ending';steps++){
    if(s.phase==='decision'){
      const cs=E.current(s).choices[s.side].map((c,i)=>({c,i})).filter(({c})=>!E.availability(s,c));
      s=E.choose(s,cs[random(cs.length)].i);
    }else if(s.phase==='war'){
      const opts=E.warOptions(s).map((o,i)=>({o,i})).filter(({o})=>!o.blocked);
      s=E.chooseWar(s,opts[random(opts.length)].i);
    }else s=E.advance(s);
  }
  if(!found[s.ending])found[s.ending]=JSON.parse(E.serialize(s));
}
fs.mkdirSync(path.join(__dirname,'../test-artifacts'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../test-artifacts/routes.json'),JSON.stringify(found,null,2));
console.log('Reached: '+Object.keys(found).join(', '));
