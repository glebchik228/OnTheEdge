(function(root) {
  'use strict';
  const node=typeof module!=='undefined'&&module.exports;
  const D=node?require('./campaign-data.js'):root.ColdWarData;
  const B=node?require('./branches.js'):root.ColdWarBranches;
  const keys=Object.keys(D.metrics),skeys=Object.keys(D.strategic),clamp=n=>Math.max(0,Math.min(100,n));
  const copy=v=>JSON.parse(JSON.stringify(v));
  function initial(side) {
    if(!Object.hasOwn(D.sides,side))throw Error('Неизвестная сторона');
    return {version:2,side,index:0,phase:'decision',stats:{tension:32,resources:70,influence:50,trust:35},strategic:{economy:side==='usa'?65:52,allies:50,readiness:50,stability:65},rival:{economy:side==='usa'?52:65,allies:50,readiness:50},flags:{science:false,channel:false,pressure:0,treaties:0,reforms:0,deficit:0,military:0,vietnamBurden:0,afghanBurden:0},historical:true,history:[],ending:null,pendingWar:false,transition:'Начало кампании. Бюджет — доступный запас; экономика — основа будущих поступлений.',ledger:null};
  }
  function current(s) {const h=s.history.at(-1);return s.phase!=='decision'&&h?.episode===D.episodes[s.index].id?h.scene:B.resolve(s);}
  function availability(s,c) {
    for(const[k,min]of Object.entries(c.requires||{}))if(s.stats[k]<min)return `Требуется: ${D.metrics[k].toLowerCase()} не ниже ${min}`;
    for(const[k,min]of Object.entries(c.requiresStrategic||{}))if(s.strategic[k]<min)return `Требуется: ${D.strategic[k].toLowerCase()} не ниже ${min}`;
    if(c.requiresReforms&&s.flags.reforms<c.requiresReforms)return `Требуется подготовка: ${c.requiresReforms} этапа реформ (сейчас ${s.flags.reforms})`;
    return '';
  }
  function strategicDelta(s,c) {
    const d={economy:0,allies:Math.round(c.delta.influence*.35+c.delta.trust*.25),readiness:0,stability:0,...c.strategic};
    if(c.tag==='pressure'){d.readiness+=7;d.allies-=6;d.stability-=2;}
    if(c.tag==='science')d.economy+=8;
    if(c.tag==='treaty'){d.allies+=4;d.readiness-=2;}
    if(c.policy==='reform'){if(s.flags.reforms>=1){d.economy+=5;d.stability+=4;}else d.stability-=5;}
    if(c.policy==='shockReform'&&s.flags.reforms<2){d.economy-=7;d.stability-=8;}
    return d;
  }
  function preview(s,c) {
    const d={...c.delta},notes=[];
    if(d.tension>0&&s.stats.trust<20){d.tension+=3;notes.push('Недоверие усиливает эскалацию: +3.');}
    if(c.tag==='pressure'&&s.flags.pressure>=3){d.tension+=2;notes.push('Накопленное силовое давление: +2 к напряжённости.');}
    if(c.policy==='reform')notes.push(s.flags.reforms>=1?'Прежняя подготовка добавляет +5 к экономике и +4 к устойчивости.':'Без прежней подготовки переход дополнительно снижает устойчивость на 5.');
    if(c.policy==='shockReform'&&s.flags.reforms<2)notes.push('Неподготовленный слом правил: ещё −7 к экономике и −8 к устойчивости.');
    if(c.war||(D.episodes[s.index].id==='cuba'&&c.tag==='pressure'))notes.push('Прямое столкновение откроет военную развилку независимо от напряжённости.');
    const stats=Object.fromEntries(keys.map(k=>[k,clamp(s.stats[k]+d[k])])),sd=strategicDelta(s,c),strategic=Object.fromEntries(skeys.map(k=>[k,clamp(s.strategic[k]+sd[k])]));
    return{stats,strategic,delta:Object.fromEntries(keys.map(k=>[k,stats[k]-s.stats[k]])),strategicDelta:Object.fromEntries(skeys.map(k=>[k,strategic[k]-s.strategic[k]])),notes};
  }
  function updateFlags(s,c,index,ep) {
    const f={...s.flags};
    if(c.tag==='science')f.science=true;if(c.tag==='channel')f.channel=true;if(c.tag==='pressure')f.pressure++;if(c.tag==='treaty')f.treaties++;
    if(['civilInvestment','reform'].includes(c.policy))f.reforms++;
    if(c.policy==='deficit')f.deficit+=2;
    if(c.policy==='budgetRules')f.deficit=Math.max(0,f.deficit-1);
    if(c.policy==='conventional')f.military+=2;
    if(c.policy==='nuclearEconomy')f.nuclearEconomy=true;
    if(c.policy==='unionAgreement')f.unionAgreement=true;
    if(c.policy==='conversion'){f.military=Math.max(0,f.military-2);f.reforms++;}
    if(ep.id==='potsdam')f.commonGermany=index===1;
    if(ep.id==='marshall')f.economicBridge=index===1;
    if(ep.id==='airlift'&&!ep.branch)f.berlinOpen=s.side==='usa'?index===2:index===1;
    if(ep.id==='korea')f.koreaLimited=index===1;
    if(ep.id==='hungary')f.pluralism=s.side==='ussr'?index!==0:index===2;
    if(ep.id==='wall'&&!ep.branch)f.mutualSecurity=s.side==='usa'?index===2:index===1;
    if(ep.id==='vietnam')f.vietnamBurden=index===1?0:index===2?(s.side==='usa'?1:4):3;
    if(ep.id==='prague'&&!ep.branch&&s.side==='ussr')f.voluntaryBloc=index!==0;
    if(ep.id==='afghan'&&!ep.branch)f.afghanBurden=index===1?0:index===2?(s.side==='usa'?4:0):(s.side==='usa'?1:3);
    return{...f,...c.set};
  }
  function choose(s,index) {
    if(s.phase!=='decision')throw Error('Сначала завершите текущий результат');
    const ep=current(s),c=ep.choices[s.side][index];
    if(!Number.isInteger(index)||!c)throw Error('Неизвестный выбор');
    const blocked=availability(s,c);if(blocked)throw Error(blocked);
    const p=preview(s,c),flags=updateFlags(s,c,index,ep),rival={...s.rival};
    rival.readiness=clamp(rival.readiness+(c.delta.tension>0?3:c.tag==='treaty'?-2:0));
    rival.economy=clamp(rival.economy+(c.delta.tension>10?-1:0));
    rival.allies=clamp(rival.allies-Math.round(p.strategicDelta.allies*.35));
    const pendingWar=p.stats.tension>=100||!!c.war||(ep.id==='cuba'&&c.tag==='pressure');
    const ending=!pendingWar&&p.stats.resources<=0?'exhaustion':null;
    const entry={episode:ep.id,choice:index,scene:copy(ep),selected:copy(c),before:{...s.stats},after:p.stats,delta:p.delta,beforeStrategic:{...s.strategic},afterStrategic:p.strategic,strategicDelta:p.strategicDelta,notes:p.notes,carry:B.carry(s)};
    return{...s,stats:p.stats,strategic:p.strategic,rival,flags,historical:s.historical&&c.historical,phase:'result',history:[...s.history,entry],pendingWar,ending};
  }
  function budget(s,next) {
    const income=5+Math.floor(s.strategic.economy/15)+(s.flags.science?2:0),military=s.flags.military+Math.max(0,Math.floor((s.strategic.readiness-65)/15));
    const wars=(next.year<=1972?s.flags.vietnamBurden:0)+(next.year<=1989?s.flags.afghanBurden:0),grants=next.id==='budget1953'&&s.flags.koreaLimited?5:0;
    return{income,military,wars,deficit:s.flags.deficit,grants,net:income+grants-military-wars-s.flags.deficit};
  }
  const power=v=>Math.round(v.readiness*.4+v.economy*.3+v.allies*.3);
  function finalEnding(s) {
    if(s.historical)return `historical_${s.side}`;
    if(s.side==='ussr'&&s.flags.unionAgreement&&s.flags.unionFulfilled&&s.strategic.economy>=55&&s.strategic.stability>=50){
      if(s.strategic.economy>=75&&s.strategic.allies>=65&&s.stats.influence>=45&&s.strategic.economy+s.strategic.allies>=s.rival.economy+s.rival.allies+20)return 'soviet_victory';
      return 'union_survives';
    }
    if(s.side==='ussr'&&s.flags.confederation)return 'commonwealth';
    if(s.side==='usa'&&s.strategic.economy>=70&&s.strategic.allies>=65&&s.strategic.stability>=45&&s.stats.influence>=60)return 'american_victory';
    if(s.stats.tension<=35&&s.stats.trust>=60)return 'cooperation';
    if(s.stats.resources<25||s.strategic.stability<30)return 'fragile';
    return 'balance';
  }
  function advance(s) {
    if(!['result','war_result'].includes(s.phase))throw Error('Сначала примите решение');
    if(s.ending)return{...s,phase:'ending'};
    if(s.pendingWar)return{...s,phase:'war'};
    if(s.index===D.episodes.length-1)return{...s,phase:'ending',ending:finalEnding(s)};
    const next=D.episodes[s.index+1],ledger=budget(s,next),stats={...s.stats};
    stats.resources=clamp(stats.resources+ledger.net);
    stats.tension=Math.max(0,Math.min(95,stats.tension+next.shock-5-(s.flags.channel?2:0)));
    const strategic={...s.strategic};if(ledger.wars)strategic.stability=clamp(strategic.stability-2);
    const rival={...s.rival};if(next.year>=1985&&s.side==='usa')rival.economy=clamp(rival.economy-3);else if(next.year>=1953)rival.economy=clamp(rival.economy+1);
    const actual=stats.resources-s.stats.resources,dt=stats.tension-s.stats.tension;
    const transition=`Бюджет ${actual>=0?'+':''}${actual}: поступления ${ledger.income}${ledger.grants?` + передышка ${ledger.grants}`:''}, содержание армии −${ledger.military}, внешние обязательства −${ledger.wars}, отложенные расходы −${ledger.deficit}. Напряжённость ${dt>=0?'+':''}${dt}.`;
    return{...s,index:s.index+1,phase:stats.resources<=0?'ending':'decision',stats,strategic,rival,ledger,transition,ending:stats.resources<=0?'exhaustion':null};
  }
  function warOptions(s) {return[
    {title:'Экстренные переговоры о прекращении огня',detail:'Уступить часть требований, оплатить восстановление и использовать дипломатические каналы.',blocked:s.stats.trust>=25||s.flags.channel?'':'Нужно доверие не ниже 25 или ранее созданный канал связи.'},
    {title:'Вести большую войну обычными силами',detail:'Исход зависит от экономики, готовности и поддержки союзников. Неядерный предел — условие этой ветки.',blocked:''},
    {title:'Перейти к ядерному применению',detail:'У противника сохраняются средства ответного удара. Безопасной победы не будет.',blocked:''}
  ];}
  function chooseWar(s,index) {
    if(s.phase!=='war'||!Number.isInteger(index)||!warOptions(s)[index])throw Error('Военное решение недоступно');
    if(warOptions(s)[index].blocked)throw Error(warOptions(s)[index].blocked);
    const stats={...s.stats},strategic={...s.strategic},rival={...s.rival},own=power(strategic),enemy=power(rival);
    let ending=null,text;
    if(index===0){stats.tension=55;stats.resources=clamp(stats.resources-8);stats.influence=clamp(stats.influence-12);stats.trust=clamp(stats.trust+8);strategic.stability=clamp(strategic.stability-5);text='Стороны принимают прекращение огня. Уступки стоят влияния и бюджета, но сохраняют возможность продолжить кампанию.';if(stats.resources===0)ending='exhaustion';}
    else if(index===1){ending=own-enemy>=8?'war_victory':enemy-own>=8?'war_defeat':'war_stalemate';stats.resources=clamp(stats.resources-35);strategic.economy=clamp(strategic.economy-25);strategic.stability=clamp(strategic.stability-20);rival.economy=clamp(rival.economy-25);text=`Соотношение перед войной: ${own} против ${enemy}. Экономика, армия и союзники определили условный исход; разрушения снизили бюджет на 35, экономику на 25 и устойчивость на 20 (до границ шкал).`;}
    else{ending='nuclear';stats.resources=0;strategic.economy=0;strategic.stability=0;rival.economy=0;text='Ядерное применение вызывает ответ. Подсчёт обычной военной силы перестаёт иметь смысл; прежние цели теряются в катастрофе.';}
    const history=copy(s.history);history.at(-1).war={choice:index,title:warOptions(s)[index].title,text,own,enemy,rivalBefore:{...s.rival},before:{stats:{...s.stats},strategic:{...s.strategic}},after:{stats,strategic},delta:Object.fromEntries(keys.map(k=>[k,stats[k]-s.stats[k]])),strategicDelta:Object.fromEntries(skeys.map(k=>[k,strategic[k]-s.strategic[k]]))};
    return{...s,stats,strategic,rival,history,phase:'war_result',pendingWar:false,ending,historical:false};
  }
  const serialize=s=>JSON.stringify({version:2,side:s.side,decisions:s.history.map(h=>({choice:h.choice,...(h.war?{warChoice:h.war.choice}:{})})),phase:s.phase});
  function restore(raw) {
    try{const p=JSON.parse(raw);if(!p||p.version!==2||!Array.isArray(p.decisions)||p.decisions.length>D.episodes.length||!['decision','result','war','war_result','ending'].includes(p.phase))return null;
      let s=initial(p.side);for(let i=0;i<p.decisions.length;i++){const a=p.decisions[i];if(!a||typeof a!=='object')return null;s=choose(s,a.choice);if(Object.hasOwn(a,'warChoice')){s=advance(s);s=chooseWar(s,a.warChoice);}if(i<p.decisions.length-1)s=advance(s);}
      if(s.phase!==p.phase&&['result','war_result'].includes(s.phase))s=advance(s);return s.phase===p.phase?s:null;
    }catch{return null;}
  }
  const endings={
    historical_usa:{title:'Исторический путь США',text:'Все принятые направления политики совпали с историческим маршрутом. Кампания заканчивается прекращением существования СССР в 1991 году и усилением международного положения США. Это итог длительного процесса, включавшего самостоятельные решения республик, обществ и других государств, а не доказательство превосходства одной стратегии.'},
    historical_ussr:{title:'Исторический путь СССР',text:'Вы последовательно выбрали исторические направления политики. Попытки реформ, кризис союзного центра и действия республик завершились распадом СССР в 1991 году. Эта последовательность не доказывает, что один выбор или только военные расходы сделали распад неизбежным.'},
    soviet_victory:{title:'СССР: выигранное соперничество',text:'В этой альтернативной ветке ранние реформы, договор республик и добровольные партнёрства сохранили обновлённый Союз. Его экономическая и союзная опора оказалась сильнее опоры соперника. Вашингтон принимает долгосрочное сосуществование на менее выгодных условиях. Это условная политико-экономическая победа, не завоевание США и не доказанный прогноз историков.'},
    union_survives:{title:'Обновлённый Союз сохранился',text:'Подготовленная экономика и исполненный договор республик позволили сохранить общие институты после 1991 года. СССР изменился и отказался от части прежнего контроля. Вы не выиграли всё соперничество, но избежали исторического распада в этой условной ветке.'},
    commonwealth:{title:'Содружество по соглашению',text:'Вы выбрали самостоятельность республик с сохранением общих программ. СССР в прежнем виде не существует, но переход опирается на договорённости о безопасности и сотрудничестве. Это альтернативный путь преобразования, а не сохранение Союза под новым названием.'},
    american_victory:{title:'США: прочное лидерство',text:'Гражданская экономическая база, устойчивость и поддержка союзников дали США длительное преимущество. В этой ветке конкуренты принимают систему договорённостей, в которой Вашингтон играет ведущую роль. Успех не означает отсутствия самостоятельных интересов у других стран.'},
    cooperation:{title:'Соперничество без решающего победителя',text:'Напряжённость снижена, доверие поддерживает договорённости. Обе стороны сохраняют собственные интересы. Прекращение опасного противостояния стало важнее односторонней победы; внутреннее устройство государств не определяется одной дипломатической сделкой.'},
    fragile:{title:'Мир на пределе возможностей',text:'Кампания завершена без глобальной войны, но нехватка бюджета или политической устойчивости ограничивает будущее. Военные и дипломатические успехи не заменяют согласия общества и работающего хозяйства.'},
    balance:{title:'Противостояние продолжается',text:'Ни одна сторона не получила устойчивого превосходства. Календарь достиг 1991 года, но в вашей ветке холодная война не обязана закончиться той же развязкой. Экономические трудности, недоверие и самостоятельные интересы союзников сохраняются.'},
    exhaustion:{title:'Курс больше нечем оплачивать',text:'Бюджет исчерпан. Армия, инвестиции, внешние обязательства и отложенные расходы оказались больше доступных средств. Это остановка выбранного курса в модели, а не автоматическое исчезновение государства.'},
    war_victory:{title:'Победа в большой обычной войне',text:'Вашей стороне хватило экономической базы, подготовленных сил и поддержки союзников, чтобы вынудить соперника к невыгодному перемирию. Победа оплачена разрушениями и потерей ресурсов. Сохранение войны ниже ядерного порога — сильное авторское допущение; результат не является историческим прогнозом.'},
    war_defeat:{title:'Поражение в большой обычной войне',text:'Соперник оказался сильнее по совокупности хозяйства, готовности и союзной поддержки. В этой условной ветке вашей стороне приходится принять невыгодное перемирие. Запаса денег или политической риторики не хватило, чтобы компенсировать отставание в подготовке.'},
    war_stalemate:{title:'Война без победителя',text:'Силы оказались слишком близки для решающей победы. Большая обычная война закончилась истощением и перемирием, оставив обе стороны беднее и слабее. Подготовка помогла выдержать конфликт, но не обеспечила победы.'},
    nuclear:{title:'Мир, который не удалось сохранить',text:'Ядерное применение вызвало ответ и разрушило возможность обычной победы. Развитая экономика и многочисленные союзники не отменили средств ответного удара. Масштаб человеческих потерь модель не пытается вычислять.'}
  };
  const api={initial,current,availability,preview,choose,advance,warOptions,chooseWar,power,budget,serialize,restore,endings,carry:B.carry};
  if(node)module.exports=api;else root.ColdWarEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
