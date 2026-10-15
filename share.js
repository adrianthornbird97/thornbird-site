/* Shared Share button for thornbird97.com and /finertecture/.
   Include with <script src="/share.js" defer data-theme="thornbird|finertecture"></script>.
   Adds a Share button to the page footer. Uses the native share sheet when available,
   otherwise a small popover (WhatsApp, LinkedIn, X, Facebook, Email, Copy link). */
(function(){
  var me=document.currentScript, theme=(me&&me.dataset.theme)||'thornbird';
  function pageUrl(){return location.origin+location.pathname}  // no ?query, no #hash
  var ICON='<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
  function init(){
    var foot=document.querySelector('footer'); if(!foot)return;
    var wrap=document.createElement('div'); wrap.className='sh sh-'+theme;
    wrap.innerHTML='<button type="button" class="sh-btn" aria-label="Share this page" aria-haspopup="true" aria-expanded="false" aria-controls="sh-pop">'+ICON+'<span>Share</span></button>'+
      '<div class="sh-pop" id="sh-pop" role="dialog" aria-label="Share this page" hidden><ul></ul><p class="sh-msg" role="status" aria-live="polite"></p></div>';
    foot.insertBefore(wrap,foot.firstChild);
    var btn=wrap.querySelector('.sh-btn'), pop=wrap.querySelector('.sh-pop'), ul=pop.querySelector('ul'), msg=pop.querySelector('.sh-msg');
    function data(){var t=document.title, d=document.querySelector('meta[name="description"]');return{title:t,text:d?d.content:t,url:pageUrl()}}
    function build(){
      var s=data(),u=encodeURIComponent(s.url),t=encodeURIComponent(s.title);
      var L=[['WhatsApp','https://wa.me/?text='+encodeURIComponent(s.title+' '+s.url)],
             ['LinkedIn','https://www.linkedin.com/sharing/share-offsite/?url='+u],
             ['X','https://twitter.com/intent/tweet?url='+u+'&text='+t],
             ['Facebook','https://www.facebook.com/sharer/sharer.php?u='+u],
             ['Email','mailto:?subject='+t+'&body='+encodeURIComponent(s.text+'\n\n'+s.url)]];
      ul.innerHTML=L.map(function(l){return '<li><a data-net="'+l[0]+'" href="'+l[1]+'"'+(l[0]=='Email'?'':' target="_blank" rel="noopener"')+'>'+l[0]+'</a></li>'}).join('')+
        '<li><button type="button" class="sh-copy" data-net="Copy">Copy link</button></li>';
      ul.querySelector('.sh-copy').onclick=function(){copy(s.url)};
    }
    function copy(u){
      var ok=function(){msg.textContent='Link copied'}, bad=function(){msg.textContent='Copy failed: '+u};
      if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(u).then(ok,fallback)}else fallback();
      function fallback(){var ta=document.createElement('textarea');ta.value=u;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy')?ok():bad()}catch(e){bad()}ta.remove()}
    }
    function open(){build();msg.textContent='';pop.hidden=false;btn.setAttribute('aria-expanded','true');var a=pop.querySelector('a');if(a)a.focus()}
    function close(f){pop.hidden=true;btn.setAttribute('aria-expanded','false');if(f)btn.focus()}
    btn.addEventListener('click',function(){
      var s=data();
      if(navigator.share&&(!navigator.canShare||navigator.canShare(s))){navigator.share(s).catch(function(){});return}
      pop.hidden?open():close();
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pop.hidden)close(true)});
    document.addEventListener('click',function(e){if(!pop.hidden&&!wrap.contains(e.target))close()});
  }
  var css=document.createElement('style');css.textContent=
  '.sh{position:relative;display:flex;justify-content:center;margin:0 auto 22px}'+
  '.sh-btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;font:inherit;font-weight:600;font-size:14px;line-height:1;padding:9px 18px;border-radius:999px;border:1.5px solid currentColor;background:transparent}'+
  '.sh-pop{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);z-index:50;min-width:210px;background:#fff;color:#262626;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:8px;text-align:left}'+
  '.sh-pop ul{list-style:none;margin:0;padding:0}.sh-pop li a,.sh-pop li button{display:block;width:100%;text-align:left;padding:9px 12px;border-radius:8px;font:inherit;font-size:14.5px;color:#262626!important;text-decoration:none;background:none;border:0;cursor:pointer}'+
  '.sh-msg{margin:4px 12px 4px;font-size:13px;font-weight:600;min-height:0}.sh-msg:empty{display:none}'+
  '.sh-thornbird .sh-btn{color:#d4a24c}.sh-thornbird .sh-btn:hover{background:#d4a24c;color:#0f2a3f}.sh-thornbird .sh-pop a:hover,.sh-thornbird .sh-pop button:hover,.sh-thornbird .sh-pop :focus-visible{background:#fbf3e3;outline:none}.sh-thornbird .sh-msg{color:#1f5a4a}'+
  '.sh-finertecture .sh-btn{color:#006B3F}.sh-finertecture .sh-btn:hover{background:#006B3F;color:#fff}.sh-finertecture .sh-pop a:hover,.sh-finertecture .sh-pop button:hover,.sh-finertecture .sh-pop :focus-visible{background:#eef5f1;outline:none}.sh-finertecture .sh-msg{color:#006B3F}';
  document.head.appendChild(css);
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
