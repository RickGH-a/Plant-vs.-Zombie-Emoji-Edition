/* Perf: Tailwind's CDN watches every DOM mutation. The battle layer creates/changes hundreds of nodes per second,
   so mutations inside #game-layer are hidden from it (all classes used there are safelisted below). */
(function(){var MO=window.MutationObserver;if(!MO)return;
window.MutationObserver=function(cb){var w=function(recs,obs){var L=document.getElementById('game-layer');
if(L){recs=recs.filter(function(r){return !(r.target&&r.target.nodeType===1&&L.contains(r.target));});if(!recs.length)return;}
return cb.call(this,recs,obs);};return new MO(w);};
window.MutationObserver.prototype=MO.prototype;})();
