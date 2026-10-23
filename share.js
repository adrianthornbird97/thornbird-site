/* Shared Share buttons for thornbird97.com and /finertecture/.
   Include with <script src="/share.js" defer data-theme="thornbird|finertecture"></script>.
   1. Adds a "Share" button to the page footer that shares this page (no ?query, no #hash).
   2. Any <button data-share-url="…" [data-share-title="…"] [data-share-text="…"] [data-share-image="…png"]>
      becomes a share button for that URL. With data-share-image the popover also offers
      Telegram and "Download image", and on mobile the image file itself is shared when supported.
   data-share-item names the item for analytics (default 'page'). Every share fires track('share',{channel,page_path,item})
   and shared URLs carry utm_source=<channel>&utm_medium=share&utm_campaign=<item>.
   Native share sheet when available, otherwise a popover (WhatsApp, LinkedIn, X, Facebook, Email, Copy link). */
(function(){
  var me=document.currentScript, theme=(me&&me.dataset.theme)||'thornbird', n=0, openW=null;
  var ICON='<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  /* Analytics: no provider is loaded yet. track() uses gtag (GA4) or GoatCounter if one is added later, else does nothing. */
  /* track(name, params[, done]): done() runs once the hit is sent (or after 1s), so callers can navigate safely. */
  function track(name,params,done){var fired=false,cb=function(){if(!fired){fired=true;done&&done()}};try{
    if(name==='share'||name==='share_complete')params=Object.assign({method:params.channel,content_type:params.item,item_id:params.page_path},params);
    params=Object.assign({transport_type:'beacon'},params); /* beacon survives iOS backgrounding/navigation */
    if(typeof window.gtag==='function'){if(done){params=Object.assign({},params,{event_callback:cb,event_timeout:1000});setTimeout(cb,1100)}window.gtag('event',name,params);return}
    else if(window.goatcounter&&typeof window.goatcounter.count==='function')
      window.goatcounter.count({path:name+'/'+params.item+'/'+params.channel,title:params.page_path,event:true});
  }catch(e){}cb()}
  window.shareTrack=track;
  function utm(u,ch,item){try{var x=new URL(u);x.searchParams.set('utm_source',ch);x.searchParams.set('utm_medium','share');x.searchParams.set('utm_campaign',item);return x.href}catch(e){return u}}
  function abs(u){try{return new URL(u,location.href).href}catch(e){return u}}
  function pageData(){var d=document.querySelector('meta[name="description"]');return{title:document.title,text:d?d.content:document.title,url:location.origin+location.pathname}}
  function btnData(b){var p=pageData(),ds=b.dataset;
    p.item='page';if(!ds.shareUrl)return p;
    var t=ds.shareTitle||p.title;return{title:t,text:ds.shareText||t,url:abs(ds.shareUrl),image:ds.shareImage?abs(ds.shareImage):null,item:ds.shareItem||'page'}}
  function enhance(btn,wrap){
    var id='sh-pop-'+(++n);
    btn.setAttribute('aria-haspopup','true');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls',id);
    if(!btn.getAttribute('aria-label'))btn.setAttribute('aria-label','Share');
    var pop=document.createElement('div');pop.className='sh-pop';pop.id=id;pop.setAttribute('role','dialog');pop.setAttribute('aria-label',btn.getAttribute('aria-label'));pop.hidden=true;
    pop.innerHTML='<ul></ul><p class="sh-msg" role="status" aria-live="polite"></p>';wrap.appendChild(pop);
    var ul=pop.firstChild,msg=pop.lastChild;
    function build(s){
      var U=function(ch){return encodeURIComponent(utm(s.url,ch,s.item))},t=encodeURIComponent(s.title);
      var L=[['WhatsApp','https://wa.me/?text='+encodeURIComponent(s.text+' ')+U('whatsapp')]];
      if(s.image)L.push(['Telegram','https://t.me/share/url?url='+U('telegram')+'&text='+encodeURIComponent(s.text)]);
      L.push(['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+U('linkedin')],
             ['X','https://twitter.com/intent/tweet?url='+U('x')+'&text='+encodeURIComponent(s.text)],
             ['Facebook','https://www.facebook.com/sharer/sharer.php?u='+U('facebook')],
             ['Email','mailto:?subject='+t+'&body='+encodeURIComponent(s.text+'\n\n')+U('email')]);
      var h=L.map(function(l){return '<li><a data-net="'+l[0]+'" href="'+l[1]+'"'+(l[0]=='Email'?'':' target="_blank" rel="noopener"')+'>'+l[0]+'</a></li>'}).join('');
      if(s.image)h+='<li><a data-net="Download" href="'+s.image+'" download="'+s.image.split('/').pop()+'">Download image</a></li>';
      ul.innerHTML=h+'<li><button type="button" class="sh-copy" data-net="Copy">Copy link</button></li>';
      ul.querySelector('.sh-copy').onclick=function(){copy(utm(s.url,'copy',s.item));ev('copy',s)};
      [].forEach.call(ul.querySelectorAll('a[data-net]'),function(a){a.addEventListener('click',function(){var ch=a.dataset.net.toLowerCase();ev(ch,s);
        if(ch==='download'){var f=s.image.split('/').pop();track('file_download',{file_name:f,file_extension:f.split('.').pop(),link_url:s.image,link_text:'Download image',content_type:s.item,page_path:location.pathname})}})});
    }
    function copy(u){
      var ok=function(){msg.textContent='Link copied'},bad=function(){msg.textContent='Copy failed: '+u};
      function fb(){var ta=document.createElement('textarea');ta.value=u;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')?ok():bad()}catch(e){bad()}ta.remove()}
      if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(u).then(ok,fb);else fb();
    }
    var W={open:function(s){if(openW&&openW!==W)openW.close();build(s);msg.textContent='';pop.hidden=false;btn.setAttribute('aria-expanded','true');place();openW=W;var a=pop.querySelector('a');if(a)a.focus()},
           close:function(f){pop.hidden=true;btn.setAttribute('aria-expanded','false');if(openW===W)openW=null;if(f)btn.focus()},pop:pop,wrap:wrap};
    function ev(ch,s,x){track('share',Object.assign({channel:ch,page_path:location.pathname,item:s.item},x||{}))}
    function done(ch,s){track('share_complete',{channel:ch,page_path:location.pathname,item:s.item})}
    function place(){ /* open downwards when there is no room above (e.g. a top bar); keep inside the viewport */
      pop.classList.remove('sh-down','sh-right','sh-left');var r=pop.getBoundingClientRect();
      if(r.top<8)pop.classList.add('sh-down');r=pop.getBoundingClientRect();
      if(r.right>innerWidth-8)pop.classList.add('sh-right');else if(r.left<8)pop.classList.add('sh-left')}
    /* Native share: the 'share' event fires the moment the sheet is opened (iOS may freeze the page while the
       sheet is up, so waiting for the promise loses the hit); 'share_complete' follows if it resolves.
       The image file is prefetched so navigator.share() runs inside the tap (keeps iOS user activation). */
    var fileP=null;
    function prefetch(){var s=btnData(btn);if(fileP||!s.image||!navigator.canShare||!window.File||!window.fetch)return;
      fileP=fetch(s.image).then(function(r){return r.blob()}).then(function(b){return new File([b],s.image.split('/').pop(),{type:b.type||'image/png'})}).catch(function(){return null});
      fileP.then(function(f){fileP.file=f})}
    function nativeShare(s){
      var base={title:s.title,text:s.text,url:utm(s.url,'native',s.item)},f=fileP&&fileP.file,ch='native',d=base;
      if(f){var fd={title:s.title,text:s.text+' '+utm(s.url,'native-file',s.item),files:[f]};try{if(navigator.canShare(fd)){d=fd;ch='native-file'}}catch(e){}}
      ev(ch,s,{share_status:'opened'});
      return navigator.share(d).then(function(){done(ch,s)},function(e){
        if(e&&e.name==='AbortError')return;
        if(ch==='native-file'){ch='native';return navigator.share(base).then(function(){done('native',s)},function(){})}});
    }
    if(btn.dataset.shareImage&&navigator.share){var pf=function(){prefetch()};btn.addEventListener('pointerenter',pf,{once:true});btn.addEventListener('touchstart',pf,{once:true,passive:true});
      if('IntersectionObserver' in window){var io=new IntersectionObserver(function(es){if(es.some(function(x){return x.isIntersecting})){prefetch();io.disconnect()}});io.observe(btn)}else prefetch()}
    btn.addEventListener('click',function(e){e.preventDefault();var s=btnData(btn);
      if(navigator.share&&(!navigator.canShare||navigator.canShare({title:s.title,text:s.text,url:s.url}))){Promise.resolve(nativeShare(s)).catch(function(){});return}
      pop.hidden?W.open(s):W.close()});
    (window.__shW=window.__shW||[]).push(W);
  }
  function init(){
    var foot=document.querySelector('footer');
    if(foot){var w=document.createElement('div');w.className='sh sh-'+theme;
      w.innerHTML='<button type="button" class="sh-btn" aria-label="Share this page">'+ICON+'<span>Share</span></button>';
      foot.insertBefore(w,foot.firstChild);enhance(w.firstChild,w)}
    [].forEach.call(document.querySelectorAll('button[data-share-url]'),function(b){
      var w=document.createElement('span');w.className='sh sh-inline sh-'+theme;b.parentNode.insertBefore(w,b);w.appendChild(b);
      if(!b.querySelector('svg'))b.insertAdjacentHTML('afterbegin',ICON);enhance(b,w)});
    /* Any element with data-ga-event="name" (and optional data-ga-params='{"k":"v"}') sends that GA4 event on click. */
    document.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('[data-ga-event]');if(!el)return;
      var p={};try{p=JSON.parse(el.dataset.gaParams||'{}')}catch(x){}p.page_path=location.pathname;
      var href=el.tagName==='A'&&el.getAttribute('href'),plain=href&&!el.target&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.button===0;
      if(plain){e.preventDefault();track(el.dataset.gaEvent,p,function(){location.href=el.href})}else track(el.dataset.gaEvent,p)},true);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&openW)openW.close(true)});
    document.addEventListener('click',function(e){if(openW&&!openW.wrap.contains(e.target))openW.close()});
  }
  var css=document.createElement('style');css.textContent=
  '.sh{position:relative;display:flex;justify-content:center;margin:0 auto 22px}.sh.sh-inline{display:inline-flex;margin:0}'+
  '.sh-inline>.btn{display:inline-flex;align-items:center;gap:8px}.sh-btn,.sh-inline>button:not(.btn){display:inline-flex;align-items:center;gap:8px;cursor:pointer;font:inherit;font-weight:600;font-size:14px;line-height:1;padding:9px 18px;border-radius:999px;border:1.5px solid currentColor;background:transparent}'+
  '.sh-pop{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);z-index:50;min-width:210px;background:#fff;color:#1c2630;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:8px;text-align:left}'+
  '.sh-pop.sh-down{bottom:auto;top:calc(100% + 10px)}.sh-pop.sh-right{left:auto;right:0;transform:none}.sh-pop.sh-left{left:0;transform:none}'+
  '.sh-pop ul{list-style:none;margin:0;padding:0}.sh-pop li a,.sh-pop li button{display:block;width:100%;text-align:left;padding:9px 12px;border-radius:8px;font:inherit;font-size:14.5px;color:#1c2630!important;text-decoration:none;background:none;border:0;cursor:pointer}'+
  '.sh-msg{margin:4px 12px;font-size:13px;font-weight:600}.sh-msg:empty{display:none}'+
  '.sh-thornbird .sh-btn{color:#d4a24c}.sh-thornbird .sh-btn:hover{background:#d4a24c;color:#0f2a3f}.sh-thornbird .sh-pop a:hover,.sh-thornbird .sh-pop button:hover,.sh-thornbird .sh-pop :focus-visible{background:#fbf3e3;outline:none}.sh-thornbird .sh-msg{color:#1f5a4a}'+
  '.sh-finertecture .sh-btn{color:#23538E}.sh-finertecture .sh-btn:hover{background:#23538E;color:#fff}.sh-finertecture .sh-pop,.sh-finertecture .sh-pop li a,.sh-finertecture .sh-pop li button{color:#0F1F38!important}.sh-finertecture .sh-pop a:hover,.sh-finertecture .sh-pop button:hover,.sh-finertecture .sh-pop :focus-visible{background:#EEF0F2;outline:none}.sh-finertecture .sh-msg{color:#23538E}';
  document.head.appendChild(css);
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
