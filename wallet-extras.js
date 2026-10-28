/* Lumvault wallet extras – card flip, hover tilt/sheen, freeze toggle, security activity.
   Visual design preview only: example data, nothing is stored or sent. Designed by dmeneri */
(function(){
  'use strict';
  if (typeof document === 'undefined') return;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced(){ return !!(mq && mq.matches); }
  var finePointer = window.matchMedia ? window.matchMedia('(hover: hover) and (pointer: fine)') : null;
  function canTilt(){ return !reduced() && !!(finePointer && finePointer.matches); }

  function $all(sel, root){ try{ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }catch(e){ return []; } }
  function $one(sel, root){ try{ return (root||document).querySelector(sel); }catch(e){ return null; } }
  function el(tag, cls, text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; }
  function svg(markup, cls){ var w=document.createElement('span'); w.innerHTML=markup; var s=w.firstChild; if(cls && s && s.setAttribute) s.setAttribute('class',cls); return s; }
  function last4(text){ var m=String(text||'').match(/(\d{4})\s*$/); return m ? m[1] : null; }
  function mask(l4){ return '•••• ' + (l4 || '0000'); }
  function onKeyActivate(node, fn){
    node.addEventListener('keydown', function(e){
      if(e.key==='Enter' || e.key===' ' || e.key==='Spacebar'){ e.preventDefault(); fn(e); }
    });
  }
  function safe(name, fn){ try{ fn(); }catch(e){ if(window.console && console.warn) console.warn('[wallet-extras] '+name+' skipped', e); } }

  /* live region for screen readers */
  var live=null;
  function say(msg){ try{ if(!live){ live=el('div','wx-sr'); live.setAttribute('aria-live','polite'); document.body.appendChild(live); }
    live.textContent=''; setTimeout(function(){ live.textContent=msg; },30); }catch(e){} }

  var PADLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="wx-shackle" d="M7.5 11V8a4.5 4.5 0 019 0v3"/><rect class="wx-body" x="5" y="10.5" width="14" height="10.5" rx="3"/><circle class="wx-hole" cx="12" cy="15.4" r="1.6"/></svg>';
  var FLAKES = '<svg viewBox="0 0 320 200" preserveAspectRatio="none" aria-hidden="true">'+
    '<path d="M30 30l18 18M48 30L30 48M39 24v30M24 39h30"/>'+
    '<path d="M270 150l14 14M284 150l-14 14M277 145v24M265 157h24"/>'+
    '<path d="M250 26l10 10M260 26l-10 10M255 22v18M246 31h18"/>'+
    '<path d="M60 160l8 8M68 160l-8 8M64 156v16M56 164h16"/>'+
    '<path d="M0 8c40 10 70 2 110 14M210 196c30-14 70-8 110-20M0 120c18 4 26 16 30 34M320 60c-20 2-34 12-40 30"/></svg>';

  /* ---------------- state shared by cards, toggles, action + activity ---------------- */
  var state = {};          // last4 -> { frozen:bool }
  var listeners = [];      // fn(last4, frozen, quiet)
  function isFrozen(l4){ return !!(state[l4] && state[l4].frozen); }
  function setFrozen(l4, frozen, quiet){
    if(!l4) return;
    state[l4] = { frozen: !!frozen };
    listeners.forEach(function(fn){ safe('sync', function(){ fn(l4, !!frozen, !!quiet); }); });
    if(!quiet) say('Card '+mask(l4)+(frozen?' frozen':' unfrozen')+' (example only)');
  }

  /* ---------------- 1. Card flip + hover tilt / sheen ---------------- */
  function addSheen(face){ if(!$one(':scope > .wx-sheen', face)) face.appendChild(el('span','wx-sheen')); }

  function buildBack(front){
    var back = el('div','card wx-face wx-back');
    ['c1','c2','c3'].forEach(function(c){ if(front.classList.contains(c)) back.classList.add(c); });
    back.setAttribute('aria-hidden','true');
    var bankEl=$one('.bank',front), metaSpans=$all('.meta span',front);
    var bank=bankEl ? bankEl.textContent.trim() : 'Sample Bank';
    var holder=metaSpans[0] ? metaSpans[0].textContent.trim() : 'A. SAMPLE';
    var l4=last4(($one('.num',front)||{}).textContent);
    back.appendChild(el('div','wx-stripe'));
    var sig=el('div','wx-sig'); sig.appendChild(el('div','wx-sig-strip',holder));
    var cvv=el('div','wx-cvv'); cvv.appendChild(el('small',null,'CVV')); cvv.appendChild(document.createTextNode('•••'));
    sig.appendChild(cvv); back.appendChild(sig);
    var foot=el('div','wx-back-foot'); var info=el('div');
    info.appendChild(el('b',null,bank)); info.appendChild(document.createTextNode(mask(l4)+' · example card, not real'));
    foot.appendChild(info); foot.appendChild(el('span','wx-back-tag','Design preview'));
    back.appendChild(foot); addSheen(back);
    return back;
  }

  function bindTilt(target, varHost, opts){
    var raf=0, pending=null;
    function apply(){ raf=0; if(!pending) return; var p=pending; pending=null;
      var r=target.getBoundingClientRect(); if(!r.width||!r.height) return;
      var x=Math.min(1,Math.max(0,(p.x-r.left)/r.width)), y=Math.min(1,Math.max(0,(p.y-r.top)/r.height));
      var max=opts.max||10, flipped=opts.isFlipped && opts.isFlipped();
      varHost.style.setProperty('--wx-ry', ((x-.5)*2*max*(flipped?-1:1)).toFixed(2)+'deg');
      varHost.style.setProperty('--wx-rx', ((.5-y)*2*max*0.8).toFixed(2)+'deg');
      varHost.style.setProperty('--wx-mx', (flipped?(1-x):x)*100+'%');
      varHost.style.setProperty('--wx-my', y*100+'%');
    }
    target.addEventListener('pointermove', function(e){
      if(e.pointerType && e.pointerType!=='mouse' && e.pointerType!=='pen') return;
      if(!canTilt()) return;
      target.classList.add('wx-tilting');
      pending={x:e.clientX,y:e.clientY}; if(!raf) raf=requestAnimationFrame(apply);
    });
    target.addEventListener('pointerleave', function(){
      target.classList.remove('wx-tilting'); pending=null;
      ['--wx-rx','--wx-ry'].forEach(function(v){ varHost.style.setProperty(v,'0deg'); });
      varHost.style.setProperty('--wx-mx','50%'); varHost.style.setProperty('--wx-my','50%');
    });
  }

  function initFlipCards(){
    // Phone-screen cards only (hero cards are absolutely positioned decorations; they get tilt only)
    $all('.phone .card').forEach(function(card){
      if(card.closest('.wx-flip') || card.classList.contains('float-card')) return;
      var l4=last4(($one('.num',card)||{}).textContent);
      var wrap=el('div','wx-flip'), inner=el('div','wx-flip-inner');
      // carry the card's own top margin to the wrapper so layout is unchanged
      var mt=card.style && card.style.marginTop; if(mt){ wrap.style.marginTop=mt; }
      card.parentNode.insertBefore(wrap, card);
      inner.appendChild(card); wrap.appendChild(inner);
      card.classList.add('wx-face','wx-front'); if(mt) card.style.marginTop='0';
      if(l4) card.setAttribute('data-wx-last4', l4);
      addSheen(card);
      var hint=el('span','wx-hint','↻ Tap to flip'); hint.setAttribute('aria-hidden','true'); card.appendChild(hint);
      inner.appendChild(buildBack(card));

      wrap.setAttribute('role','button'); wrap.setAttribute('tabindex','0'); wrap.setAttribute('aria-pressed','false');
      wrap.setAttribute('aria-label','Example card '+mask(l4)+'. Flip to see the back (visual only)');
      var t=0;
      function flip(){
        var on=!wrap.classList.contains('is-flipped');
        wrap.classList.add('wx-flipping','wx-used'); wrap.classList.remove('wx-tilting');
        wrap.classList.toggle('is-flipped', on); wrap.setAttribute('aria-pressed', String(on));
        clearTimeout(t); t=setTimeout(function(){ wrap.classList.remove('wx-flipping'); }, 720);
      }
      wrap.addEventListener('click', flip);
      onKeyActivate(wrap, flip);
      bindTilt(wrap, inner, { max:9, isFlipped:function(){ return wrap.classList.contains('is-flipped'); } });
    });

    // Hero floating cards: tilt, lift and sheen while keeping their original rotation
    $all('.float-card.one, .float-card.two').forEach(function(card){
      if(card.classList.contains('wx-tilt-on')) return;
      card.classList.add('wx-tilt-on'); addSheen(card);
      bindTilt(card, card, { max:8 });
    });
  }

  /* ---------------- 2. Freeze / lock (visual state only) ---------------- */
  function initIce(){
    $all('.card.wx-front, .phone .card:not(.wx-back)').forEach(function(card){
      if($one(':scope > .wx-ice', card)) return;
      var ice=el('div','wx-ice'); ice.setAttribute('aria-hidden','true');
      var fl=svg(FLAKES,'wx-flakes'); if(fl) ice.appendChild(fl);
      var badge=el('div','wx-ice-badge'); var pl=svg(PADLOCK,'wx-padlock'); if(pl) badge.appendChild(pl);
      badge.appendChild(el('span',null,'Frozen · example')); ice.appendChild(badge);
      card.insertBefore(ice, card.firstChild);
    });
    listeners.push(function(l4, frozen, quiet){
      $all('.card[data-wx-last4="'+l4+'"]').forEach(function(card){
        var was=card.classList.contains('wx-frozen');
        if(was===frozen) return;
        card.classList.remove('wx-thawing','wx-just-frozen');
        if(frozen){ card.classList.add('wx-frozen'); if(!quiet && !reduced()){ void card.offsetWidth; card.classList.add('wx-just-frozen'); } }
        else { card.classList.remove('wx-frozen'); if(!quiet && !reduced()){ card.classList.add('wx-thawing'); setTimeout(function(){ card.classList.remove('wx-thawing'); }, 800); } }
        var wrap=card.closest('.wx-flip');
        if(wrap) wrap.setAttribute('aria-label','Example card '+mask(l4)+(frozen?' (frozen)':'')+'. Flip to see the back (visual only)');
      });
    });
  }

  function initRowToggles(){
    // Wallet rows: .list-row containing a .mini-card, a "•••• 1234" line and a .toggle
    $all('.list-row').forEach(function(row){
      var mini=$one('.mini-card',row), tg=$one('.toggle',row), sub=$one('.s',row);
      if(!mini || !tg || !sub || tg.classList.contains('wx-lock')) return;
      var m=sub.textContent.match(/••••\s*(\d{4})/); if(!m) return;
      var l4=m[1];
      tg.classList.add('wx-lock'); tg.setAttribute('data-wx-last4', l4);
      tg.setAttribute('role','switch'); tg.setAttribute('tabindex','0');
      var knob=el('span','wx-knob'); knob.setAttribute('aria-hidden','true'); var pl=svg(PADLOCK); if(pl) knob.appendChild(pl); tg.appendChild(knob);
      mini.setAttribute('data-wx-last4', l4);
      if(!(l4 in state)) state[l4]={ frozen: !tg.classList.contains('on') };
      function toggle(){ setFrozen(l4, !isFrozen(l4)); tg.classList.remove('wx-pop'); void tg.offsetWidth; tg.classList.add('wx-pop'); }
      tg.addEventListener('click', function(e){ e.stopPropagation(); toggle(); });
      onKeyActivate(tg, toggle);
    });
    listeners.push(function(l4, frozen){
      $all('.toggle.wx-lock[data-wx-last4="'+l4+'"]').forEach(function(tg){
        tg.classList.toggle('on', !frozen);
        tg.setAttribute('aria-checked', String(!frozen));
        tg.setAttribute('aria-label','Card '+mask(l4)+' '+(frozen?'frozen':'active')+' – example, visual only');
        var row=tg.closest('.list-row'); if(!row) return;
        var st=$one('.status',row);
        if(st){ var txt=frozen?'❄ Frozen':'Active';
          if(st.textContent!==txt){ st.textContent=txt; st.classList.toggle('st-frz',frozen); st.classList.toggle('st-on',!frozen);
            st.classList.remove('wx-swap'); void st.offsetWidth; st.classList.add('wx-swap'); } }
      });
      $all('.mini-card[data-wx-last4="'+l4+'"]').forEach(function(mc){
        mc.classList.toggle('wx-frozen', frozen); mc.classList.toggle('wx-is-active', !frozen);
      });
    });
  }

  function initFreezeAction(){
    // Card detail screen: the ".action" whose label reads "Freeze" controls the card in the same phone
    $all('.actions .action').forEach(function(act){
      if(act.classList.contains('wx-act')) return;
      if(!/^\s*(un)?freeze\s*$/i.test(act.textContent||'')) return;
      var phone=act.closest('.phone'); var card=phone && $one('.card[data-wx-last4]', phone);
      var l4=card && card.getAttribute('data-wx-last4');
      if(!l4){ var num=phone && $one('.card .num', phone); l4=num && last4(num.textContent); }
      if(!l4) return;
      if(!(l4 in state)) state[l4]={ frozen:false };
      var label=null; act.childNodes.forEach(function(n){ if(n.nodeType===3 && n.textContent.trim()) label=n; });
      if(!label){ label=document.createTextNode('Freeze'); act.appendChild(label); }
      act.classList.add('wx-act'); act.setAttribute('data-wx-last4', l4);
      act.setAttribute('role','button'); act.setAttribute('tabindex','0');
      function go(){ setFrozen(l4, !isFrozen(l4)); }
      act.addEventListener('click', go); onKeyActivate(act, go);
      listeners.push(function(k, frozen){ if(k!==l4) return;
        label.textContent = frozen ? 'Unfreeze' : 'Freeze';
        act.classList.toggle('is-on', frozen); act.setAttribute('aria-pressed', String(frozen));
        act.setAttribute('aria-label', (frozen?'Unfreeze':'Freeze')+' card '+mask(l4)+' – example, visual only'); });
    });
  }

  /* ---------------- 3. Security activity (clearly fake example data) ---------------- */
  var ICONS = {
    signin:'<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    ice:'<svg viewBox="0 0 24 24"><path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1L19.1 4.9"/></svg>',
    unlock:'<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 017.7-1.5"/></svg>',
    key:'<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2"/></svg>',
    finger:'<svg viewBox="0 0 24 24"><path d="M12 11c0 3-1 6-3 8M8 6.5A6 6 0 0118 11c0 2-.3 4-1 6M6 10a6 6 0 00.5 2.5M12 11v1"/></svg>',
    device:'<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18h3"/></svg>',
    limit:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h7"/></svg>'
  };
  var SAMPLE_ACTIVITY = [
    { k:'', icon:'signin', t:'Signed in on this phone', s:'Example Phone · by you', time:'2h ago' },
    { k:'ice',  icon:'ice',    t:'Card frozen', s:'Card •••• 0007 · by you', time:'Yesterday' },
    { k:'key',  icon:'key',    t:'Password changed', s:'From this phone · example', time:'3 days ago' },
    { k:'',     icon:'finger', t:'Fingerprint unlock turned on', s:'Example Phone', time:'1 week ago' },
    { k:'',     icon:'limit',  t:'Monthly limit updated', s:'Card •••• 1881 · $1,000 example', time:'2 weeks ago' },
    { k:'',     icon:'device', t:'Trusted device added', s:'Example Tablet · Darwin NT', time:'3 weeks ago' }
  ];
  function activityRow(a){
    var row=el('div','list-row wx-act-row'+(a.k?' wx-k-'+a.k:''));
    var ic=el('div','wx-ic'); ic.setAttribute('aria-hidden','true'); var s=svg(ICONS[a.icon]||ICONS.unlock); if(s) ic.appendChild(s);
    var g=el('div','grow'); var t=el('div','t'); t.appendChild(document.createTextNode(a.t));
    if(a.tag) t.appendChild(el('span','status wx-st-warn',a.tag));
    g.appendChild(t); g.appendChild(el('div','s',a.s));
    row.appendChild(ic); row.appendChild(g); row.appendChild(el('span','wx-act-time',a.time));
    return row;
  }
  function findSecurityPhone(){
    var sec=document.getElementById('s-privacy') || document.getElementById('s-security');
    if(!sec){ $all('section.screen').some(function(s){ var h=$one('h2',s); if(h && /security/i.test(h.textContent)){ sec=s; return true; } return false; }); }
    return sec ? ($one('.phone',sec) || sec) : null;
  }
  function initActivity(){
    var box=$one('[data-wx-activity], .wx-activity');
    if(!box){
      var host=findSecurityPhone(); if(!host) return;
      var label=el('div','section-label','Security activity · example'); label.style.marginTop='14px';
      box=el('div','glass pad wx-tight wx-activity'); box.setAttribute('data-wx-activity','');
      // place after the existing "Activity log" panel if present, else at the end of the phone
      var anchor=null;
      $all('.section-label',host).forEach(function(l){ if(/activity/i.test(l.textContent)) anchor=l.nextElementSibling; });
      if(anchor && anchor.parentNode){ anchor.parentNode.insertBefore(label, anchor.nextSibling); label.parentNode.insertBefore(box, label.nextSibling); }
      else { host.appendChild(label); host.appendChild(box); }
    }
    box.setAttribute('aria-label','Security activity, example data only');
    if(!box.querySelector('.wx-act-row')) SAMPLE_ACTIVITY.forEach(function(a){ box.appendChild(activityRow(a)); });
    if(!$one('.wx-act-note',box)) box.appendChild(el('div','wx-act-note','Example activity for the design preview – not real account data'));

    // gentle reveal on scroll
    if(!reduced() && 'IntersectionObserver' in window){
      box.classList.add('wx-reveal');
      var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ box.classList.add('wx-in'); io.disconnect(); } }); },{threshold:.15});
      io.observe(box);
    }
    // freezing a card in the preview adds an example entry at the top
    listeners.push(function(l4, frozen, quiet){
      if(quiet) return;
      var row=activityRow({ k:frozen?'ice':'', icon:frozen?'ice':'unlock', t:frozen?'Card frozen':'Card unfrozen', s:'Card '+mask(l4)+' · by you · example', time:'Just now' });
      row.classList.add('wx-new');
      box.insertBefore(row, box.firstChild);
      var rows=$all('.wx-act-row',box); for(var i=8;i<rows.length;i++) rows[i].remove();
    });
  }

  function init(){
    safe('flip', initFlipCards);
    safe('ice', initIce);
    safe('toggles', initRowToggles);
    safe('freeze-action', initFreezeAction);
    safe('activity', initActivity);
    // paint the initial state without animation or log entries
    Object.keys(state).forEach(function(l4){ setFrozen(l4, state[l4].frozen, true); });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
