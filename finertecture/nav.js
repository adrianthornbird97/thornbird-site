/* Finertecture phone menu: below 860px the header nav becomes a full-width panel behind a hamburger. No dependencies. */
(function(){
  var header=document.querySelector('header.nav'),toggle=header&&header.querySelector('.nav-toggle'),
      menu=document.getElementById('fin-menu'),mq=window.matchMedia('(max-width:860px)');
  if(!toggle||!menu)return;
  function setMenu(open){header.classList.toggle('menu-open',open);toggle.setAttribute('aria-expanded',open?'true':'false');toggle.setAttribute('aria-label',open?'Close menu':'Open menu')}
  toggle.addEventListener('click',function(){setMenu(toggle.getAttribute('aria-expanded')!=='true')});
  menu.addEventListener('click',function(e){if(e.target.closest('a'))setMenu(false)});
  document.addEventListener('click',function(e){if(header.classList.contains('menu-open')&&!header.contains(e.target))setMenu(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&header.classList.contains('menu-open')){setMenu(false);toggle.focus()}});
  function sync(){if(!mq.matches)setMenu(false)}
  (mq.addEventListener?mq.addEventListener('change',sync):mq.addListener(sync));
})();
