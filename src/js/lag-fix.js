/* LAG FIX: updateFieldUI() used to rewrite DOM attributes/styles on every 50 ms tick, in every world.
   Each write is a main-document mutation that the Tailwind CDN observer reacts to. Now it only writes when a value changes. */
(function(){
  var c = {};
  function put(key, val, fn){ if (c[key] !== val) { c[key] = val; fn(val); } }
  updateFieldUI = function(){
    var w4 = currentLevel >= 27;
    var panel = document.getElementById('field-resonance');
    if (panel) put('panel', w4 ? 'block' : 'none', function(v){ panel.style.display = v; });
    if (!w4) return;                                   // nothing else to update outside World 4
    var now = Date.now(), cooling = now < fieldCooldownUntil;
    document.querySelectorAll('.field-btn').forEach(function(b, i){
      var d = cooling || (b.id === 'field-grand-btn' && energyBeans < 1);
      put('b' + i, d, function(v){ b.disabled = v; });
    });
    var bar = document.getElementById('field-bar');
    if (bar) {
      var pct = now < fieldActiveUntil ? 100 * (fieldActiveUntil - now) / accFieldMs() : cooling ? 100 * (fieldCooldownUntil - now) / 20000 : 0;
      put('w', Math.round(Math.max(0, pct)), function(v){ bar.style.width = v + '%'; });
      put('bg', now < fieldActiveUntil, function(v){ bar.style.background = v ? '#22d3ee' : '#64748b'; });
    }
    var st = document.getElementById('field-status');
    if (st) {
      var t = null;
      if (now >= fieldActiveUntil && cooling) t = 'Field cooling down · ' + Math.ceil((fieldCooldownUntil - now) / 1000) + 's';
      else if (now >= fieldCooldownUntil) t = 'Ready · Select a fundamental field';
      if (t !== null) put('st', t, function(v){ st.textContent = v; });
    }
  };
})();
