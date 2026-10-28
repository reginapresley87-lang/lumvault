/* Lumvault design preview – interaction script (example data only). Designed by dmeneri */
(function(){
  'use strict';
  var SHOT = /[?&]shot=1/.test(location.search);
  var $ = function(id){ return document.getElementById(id); };
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }

  /* ---------- optional sound kit (guarded) ---------- */
  function S(){ return window.LinkabaraSounds || null; }
  function snd(name, arg){ try{ var s=S(); if(!s) return; if(arg!==false && typeof s.isMuted==='function' && s.isMuted()) return; var f=s[name];
      if(typeof arg==='boolean' && f){ if(typeof f[arg?'start':'stop']==='function') f[arg?'start':'stop'](); else if(typeof f==='function') f(arg); }
      else if(typeof f==='function') f(); }catch(e){} }
  var btn=$('soundBtn');
  function paintBtn(muted){ btn.classList.toggle('muted',muted); btn.setAttribute('aria-pressed',String(!muted)); btn.querySelector('.lbl').textContent=muted?'Sound off':'Sound on'; }
  function isMuted(){ var s=S(); return s && typeof s.isMuted==='function' ? s.isMuted() : true; }
  paintBtn(true);
  var sc=document.createElement('script'); sc.src='sounds/linkabara-sounds.js'; sc.async=true;
  sc.onload=function(){ var s=S(); if(!s){ btn.style.display='none'; return; }
    try{ if(localStorage.getItem('linkabaraMuted')===null) s.setMuted(true); }catch(e){ try{s.setMuted(true);}catch(_){} }
    paintBtn(isMuted()); };
  sc.onerror=function(){ btn.style.display='none'; };   // site works fine without sounds
  document.head.appendChild(sc);
  btn.addEventListener('click',function(){ var s=S(); if(!s) return; var m=!isMuted();
    try{ if(!m && typeof s.unlock==='function') s.unlock(); s.setMuted(m); }catch(e){} paintBtn(m); if(!m) snd('click'); });

  /* ---------- mascot talking ---------- */
  function setTalking(on){
    document.querySelectorAll('.linkabara').forEach(function(m){ m.classList.toggle('talking',on); });
    if(window.Linkabara) window.Linkabara.setTalking(on);
    $('mascotStatus').textContent = on ? 'Linkabara is writing…' : 'Ready to help · works on your device';
    snd('talk', on);
  }

  /* ---------- samples: content/samples.json with built-in fallback ---------- */
  var FALLBACK=[
    {id:'essay',title:'Essay paragraph',icon:'📝',output:'In conclusion, city parks are more than green space — they quietly support our health, our community and the planet. Protecting them is an investment every town can make.'},
    {id:'email',title:'Email',icon:'✉️',output:{subject:'Notes from today',body:'Hi Jordan,\n\nThanks for the chat today. I have added my notes to the shared folder — let me know if anything is missing.\n\nSee you Thursday,\nAlex'}},
    {id:'grammar',title:'Grammar fix',icon:'✅',output:{before:'their going too the shop tomorow',after:"They're going to the shop tomorrow.",fixes:["their → they're","too → to","tomorow → tomorrow"]}}
  ];
  var PROMPTS={essay:'Can you finish the last paragraph of my essay?',email:'Help me write a short email to my teammate.',slides:'Turn my notes into a 5-slide outline.',budget:'Make me a simple weekly budget.',schedule:'Plan my Saturday to-do list.',translation:'Translate this message into Spanish.',story:'Finish my bedtime story about a star.',grammar:'Fix the grammar in this sentence, please.'};
  var REPLIES={essay:"Here's a closing paragraph that ties your points together:",email:"Here's a friendly, short draft you can tweak:",slides:'Done! Here is a clear 5-slide outline:',budget:"Here's your week at a glance:",schedule:"Here's a balanced plan for your day:",translation:"Here's the translation:",story:'Here is a gentle ending for your story:',grammar:'All fixed! Here are the changes I made:'};

  function textOf(s){ var o=s.output;
    if(typeof o==='string') return o;
    switch(s.id){
      case 'email': return 'Subject: '+(o.subject||'')+'\n\n'+(o.body||'');
      case 'slides': return (o||[]).map(function(x){ return (x.slide||'')+'. '+x.title+' — '+(x.points||[]).join(', '); }).join('\n');
      case 'budget': return (o.rows||[]).map(function(r){ return r[0]+': '+o.currency+r[2]+' of '+o.currency+r[1]; }).join('\n')+(o.total?'\n'+o.total[0]+': '+o.currency+o.total[2]+' of '+o.currency+o.total[1]:'')+(o.tip?'\n\n'+o.tip:'');
      case 'schedule': return (o||[]).map(function(x){ return (x.done?'✓ ':'○ ')+x.time+' — '+x.task; }).join('\n');
      case 'translation': return (o.from||'')+': '+o.before+'\n'+(o.to||'')+': '+o.after;
      case 'grammar': return o.after+'\n\n'+(o.fixes||[]).map(function(f){ return '• '+f; }).join('\n');
    }
    try{ return JSON.stringify(o); }catch(e){ return ''; }
  }
  function docFor(s){ var o=s.output, t={type:s.title, title:s.title, body:'', added:textOf(s)};
    switch(s.id){
      case 'essay': t.title='Rainforests: the lungs of the planet'; t.body='Draft · 3 paragraphs written. Final paragraph needed.'; break;
      case 'email': t.title=o.subject||'Email'; t.body='To: Sam (example)'; t.added=o.body||t.added; break;
      case 'slides': t.title='Recycling — class talk'; t.body='Notes pasted from class.'; break;
      case 'budget': t.title='My weekly budget · example'; t.body='Planned $'+(o.total?o.total[1]:'')+' · spent $'+(o.total?o.total[2]:''); break;
      case 'schedule': t.title='Saturday plan'; t.body='6 tasks · 2 done'; break;
      case 'translation': t.title='Message to a friend'; t.body=o.before||''; t.added=o.after||t.added; break;
      case 'story': t.title='Pip the little star'; t.body='Every night, a tiny star named Pip watched the town below…'; break;
      case 'grammar': t.title='Sentence check'; t.body=o.before||''; t.added=t.added; break;
    }
    return t;
  }

  var samples=FALLBACK, current=null, timers=[];
  function clearTimers(){ timers.forEach(clearTimeout); timers=[]; }
  function later(fn,ms){ timers.push(setTimeout(fn,ms)); }

  function buildChips(){
    var box=$('sampleChips'); box.textContent='';
    samples.forEach(function(s){ var b=el('button','chip-btn',(s.icon?s.icon+' ':'')+s.title); b.type='button';
      b.addEventListener('click',function(){ snd('click'); play(s); }); s._chip=b; box.appendChild(b); });
  }
  function fillDoc(s){ var d=docFor(s);
    $('docType').textContent=d.type; $('docTitle').textContent=d.title; $('docBody').textContent=d.body; $('docAdded').textContent=d.added;
    var words=(d.body+' '+d.added).split(/\s+/).filter(Boolean).length;
    $('docMeta').textContent=words+' words · example document · you choose what to keep'; }

  function play(s){
    clearTimers(); setTalking(false); snd('type',false); current=s;
    samples.forEach(function(x){ if(x._chip) x._chip.classList.toggle('active',x===s); });
    var chat=$('chat'); chat.textContent='';
    var me=el('div','msg me',PROMPTS[s.id]||('Help me with my '+s.title.toLowerCase()+'.'));
    var reply=el('div','msg buddy'); var who=el('div','who','🧸 Linkabara'); reply.appendChild(who);
    reply.appendChild(el('div',null,REPLIES[s.id]||"Here's what I came up with:"));
    var out=el('div',null,''); out.style.whiteSpace='pre-line'; out.style.marginTop='6px'; reply.appendChild(out);
    var full=textOf(s); if(full.length>420) full=full.slice(0,400).replace(/\s+\S*$/,'')+'…';
    var keep=el('div','suggest'); keep.style.marginTop='4px';
    ['Keep it','Make it shorter','Try again'].forEach(function(l){ keep.appendChild(el('span','chip',l)); });
    fillDoc(s);
    if(SHOT){ chat.append(me,reply,keep); out.textContent=full; setTalking(true); return; }
    $('docAdded').style.opacity='0.25';
    chat.appendChild(me);
    var typing=el('div','msg buddy typing'); typing.append(el('i'),el('i'),el('i'));
    later(function(){ chat.appendChild(typing); snd('type',true); setTalking(true); },700);
    later(function(){ snd('type',false); typing.remove(); chat.appendChild(reply);
      var i=0, step=Math.max(2,Math.round(full.length/120));
      (function tick(){ i+=step; out.textContent=full.slice(0,i);
        if(i<full.length) later(tick,28); else { setTalking(false); snd('done'); $('docAdded').style.opacity='1'; chat.appendChild(keep);
          later(function(){ var idx=samples.indexOf(current); play(samples[(idx+1)%samples.length]); },9000); } })();
    },2100);
  }

  function start(){ buildChips(); play(samples[0]); }
  fetch('content/samples.json',{cache:'no-cache'})
    .then(function(r){ if(!r.ok) throw 0; return r.json(); })
    .then(function(j){ var arr=Array.isArray(j)?j:(j&&j.samples); if(Array.isArray(arr)&&arr.length){
        samples=arr.filter(function(s){ return s&&s.id&&s.title&&s.output!=null; }); if(!samples.length) samples=FALLBACK; } })
    .catch(function(){ samples=FALLBACK; })
    .then(start);

  // hero mascot says hi now and then
  if(!SHOT) setInterval(function(){ var h=document.querySelector('.hero-mascot .linkabara'); if(!h) return;
    var inst=window.Linkabara&&window.Linkabara.instances.find(function(i){return i.el===h;}); if(inst&&!document.querySelector('#mainMascot.talking')){ inst.talking=true; setTimeout(function(){inst.talking=false;},1200);} },7000);
})();
