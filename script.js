/** A birthday journey: local artwork, bounded particles, and touch-first controls. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const scenes = [...document.querySelectorAll('.scene')];
  const steps = [...document.querySelectorAll('.step-dot')];
  const photos = [...document.querySelectorAll('.polaroid-item')];
  const wishes = [...document.querySelectorAll('.wish-note')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const timers = new Set();
  const labels = ['Your surprise', 'Make a wish', 'Something sweet', 'From the heart', 'Our memories', 'Three little wishes', 'Happy birthday'];
  const initialCakePrompt = $('cake-prompt').innerHTML;
  const initialSlicePrompt = $('slice-prompt').innerHTML;
  const wishLabels = wishes.map(note => note.querySelector('.wish-accessible').textContent);
  let current = 0, unlocked = 0;
  let started = false, candleBlown = false, cakeSliced = false, letterOpened = false, hugged = false;
  let wantsMusic = false, musicChosen = false, audioRequest = 0;
  let photoIndex = 0, modalOpener = null, modalOpen = false;
  const revealedWishes = new Set();
  const viewedPhotos = new Set();
  let postscriptOpened = false;

  function later(callback, delay) {
    const timer = setTimeout(() => { timers.delete(timer); callback(); }, reducedMotion.matches ? 0 : delay);
    timers.add(timer);
    return timer;
  }
  function cancelSceneWork() { timers.forEach(clearTimeout); timers.clear(); }
  function show(el, visible) { el.classList.toggle('hidden', !visible); }
  function focus(el) {
    if (!el) return;
    if (el.matches('h1, h2')) el.tabIndex = -1;
    el.focus({ preventScroll: true });
  }
  function focusReveal(el) {
    focus(el);
    // Scroll only the scene, never the header or the whole page.
    const rect = el.getBoundingClientRect();
    const scene = scenes[current];
    const viewport = scene.getBoundingClientRect();
    if (rect.bottom > viewport.bottom - 20) {
      scene.scrollBy({ top: rect.bottom - viewport.bottom + 28, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }

  /* Two canvases share one loop. Stars use perspective projection; sparks have depth. */
  const effects = (() => {
    const background = $('starfield'), foreground = $('celebration-canvas');
    const bg = background.getContext('2d'), fg = foreground.getContext('2d');
    if (!bg || !fg) return { burst() {}, clear() {} };
    const colors = ['#ffd890', '#ffa6c7', '#f9eaff', '#b49af4'];
    let width = 1, height = 1, dpr = 1, frameId = 0, previous = 0;
    let stars = [], sparks = [], pointer = { x: 0, y: 0 };
    function makeStar() {
      return { x: (Math.random() - .5) * width * 2.5, y: (Math.random() - .5) * height * 2.5,
        z: 160 + Math.random() * 1000, phase: Math.random() * Math.PI * 2,
        radius: .5 + Math.random(), color: colors[Math.floor(Math.random() * colors.length)] };
    }
    function resize() {
      width = innerWidth; height = innerHeight; dpr = Math.min(devicePixelRatio || 1, 1.5);
      for (const canvas of [background, foreground]) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
      bg.setTransform(dpr, 0, 0, dpr, 0, 0); fg.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = Array.from({ length: width < 600 ? 52 : 100 }, makeStar);
      draw(0, 0);
    }
    function draw(dt, time) {
      bg.clearRect(0, 0, width, height); fg.clearRect(0, 0, width, height);
      for (const star of stars) {
        star.z -= dt * 9;
        if (star.z < 130) Object.assign(star, makeStar(), { z: 1160 });
        const scale = 500 / star.z;
        const x = width / 2 + star.x * scale + pointer.x * scale * 10;
        const y = height / 2 + star.y * scale + pointer.y * scale * 10;
        if (x < -6 || y < -6 || x > width + 6 || y > height + 6) continue;
        const radius = Math.min(2.5, star.radius * scale);
        bg.globalAlpha = .3 + (Math.sin(time * .0007 + star.phase) + 1) * .22; bg.fillStyle = star.color;
        bg.beginPath(); bg.arc(x, y, radius, 0, Math.PI * 2); bg.fill();
        if (radius > 1.3) { bg.globalAlpha = .09; bg.beginPath(); bg.arc(x, y, radius * 3, 0, Math.PI * 2); bg.fill(); }
      }
      sparks = sparks.filter(spark => spark.life > 0);
      for (const spark of sparks) {
        spark.life -= dt; spark.x += spark.vx * dt; spark.y += spark.vy * dt;
        spark.vy += (spark.heart ? -18 : 100) * dt; spark.rotation += dt * spark.spin;
        fg.save(); fg.translate(spark.x, spark.y); fg.rotate(spark.rotation);
        fg.globalAlpha = Math.max(0, Math.min(1, spark.life / .7)); fg.fillStyle = spark.color;
        const size = spark.size;
        if (spark.heart) {
          fg.beginPath(); fg.moveTo(0, size / 2);
          fg.bezierCurveTo(-size * 2, -size / 2, -size / 2, -size * 1.8, 0, -size / 2);
          fg.bezierCurveTo(size / 2, -size * 1.8, size * 2, -size / 2, 0, size / 2); fg.fill();
        } else {
          fg.scale(Math.max(.2, Math.abs(Math.cos(spark.rotation))), 1);
          fg.fillRect(-size / 2, -size, size, size * 1.5);
        }
        fg.restore();
      }
    }
    function frame(time) {
      frameId = 0;
      if (document.hidden || reducedMotion.matches) return;
      const elapsed = time - previous;
      if (elapsed >= (width < 600 ? 32 : 16)) { draw(Math.min(elapsed / 1000, .05), time); previous = time; }
      frameId = requestAnimationFrame(frame);
    }
    function resume() {
      cancelAnimationFrame(frameId); frameId = 0; previous = performance.now();
      if (!document.hidden && !reducedMotion.matches) frameId = requestAnimationFrame(frame);
      else { sparks = []; draw(0, 0); }
    }
    function burst(x = width / 2, y = height * .58, count = 65, heart = false) {
      if (document.hidden || reducedMotion.matches) return;
      const amount = Math.min(count, width < 600 ? 85 : 130);
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2, speed = 60 + Math.random() * (heart ? 130 : 250);
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 70,
          size: (heart ? 5 : 3) + Math.random() * 4, life: 1.2 + Math.random() * 1.2,
          rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * (heart ? 1 : 8), color: colors[i % colors.length], heart });
      }
      sparks = sparks.slice(-220);
    }
    addEventListener('resize', resize, { passive: true });
    addEventListener('pointermove', event => {
      if (!finePointer.matches || reducedMotion.matches) return;
      pointer = { x: event.clientX / width - .5, y: event.clientY / height - .5 };
    }, { passive: true });
    document.addEventListener('visibilitychange', resume); reducedMotion.addEventListener('change', resume);
    resize(); resume();
    return { burst, clear() { sparks = []; fg.clearRect(0, 0, width, height); } };
  })();
  function celebrate(hearts = false) { effects.burst(innerWidth / 2, innerHeight * .57, hearts ? 28 : 85, hearts); }

  /* Music follows actual playback and the visitor's sound preference. */
  const music = $('bg-music');
  const musicPlaylist = [
    'assets/audio/happy-birthday.mp3',
    'assets/audio/happy-birthday.mp3',
    'assets/audio/happy-birthday.mp3',
    'assets/audio/Funny2.mp3',
    'assets/audio/Funny1.mp3'
  ];
  let musicTrackIndex = 0;
  music.volume = .18;
  function selectMusicTrack(index) {
    audioRequest++;
    musicTrackIndex = index;
    music.src = musicPlaylist[index];
    music.load();
  }
  function syncMusic() {
    const playing = !music.paused && !music.ended;
    $('music-toggle').classList.toggle('playing', playing);
    $('music-toggle').setAttribute('aria-pressed', String(playing));
    $('music-toggle').setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
    $('music-label').textContent = playing ? 'Sound on' : 'Sound off';
  }
  async function playMusic() {
    const request = ++audioRequest;
    try {
      await music.play();
      if (request === audioRequest && (!wantsMusic || document.hidden)) music.pause();
      if (request === audioRequest) $('audio-status').textContent = '';
    } catch {
      if (request === audioRequest && wantsMusic && !document.hidden) $('audio-status').textContent = 'Music couldn’t start. You can try the sound button again.';
    }
    syncMusic();
  }
  function toggleMusic() {
    musicChosen = true; wantsMusic = music.paused;
    if (wantsMusic) playMusic();
    else { audioRequest++; music.pause(); syncMusic(); }
  }
  music.addEventListener('play', syncMusic); music.addEventListener('pause', syncMusic);
  music.addEventListener('ended', () => {
    selectMusicTrack((musicTrackIndex + 1) % musicPlaylist.length);
    if (wantsMusic && !document.hidden) playMusic();
    else syncMusic();
  });
  music.addEventListener('error', () => { $('audio-status').textContent = 'The music is unavailable. All your surprises still work.'; syncMusic(); });
  document.addEventListener('visibilitychange', () => {
    document.body.classList.toggle('page-paused', document.hidden);
    if (document.hidden) { audioRequest++; music.pause(); }
    else if (wantsMusic) playMusic();
  });

  function updateProgress() {
    $('journey-label').textContent = `${String(current + 1).padStart(2, '0')} / 07 · ${labels[current]}`;
    steps.forEach((step, i) => {
      step.disabled = i > unlocked; step.classList.toggle('active', i === current); step.classList.toggle('visited', i < unlocked);
      if (i === current) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
    });
  }
  function renderCake() {
    $('wish-cake').classList.toggle('blown', candleBlown);
    $('wish-cake').disabled = candleBlown; $('btn-blow').disabled = candleBlown;
    show($('btn-blow'), !candleBlown); show($('btn-to-slice'), candleBlown);
    show($('candle-hint'), !candleBlown);
    $('cake-prompt').innerHTML = candleBlown ? 'Your wish is on its way to the stars. ✦<br />Now, let’s make this birthday a little sweeter.' : initialCakePrompt;
    $('cut-stage').classList.remove('cutting'); $('cut-stage').classList.toggle('sliced', cakeSliced);
    $('cut-stage').setAttribute('aria-busy', 'false');
    $('cut-stage').disabled = cakeSliced; $('btn-cut-action').disabled = cakeSliced;
    $('btn-cut-action').textContent = 'Cut My Birthday Cake 🍰';
    show($('btn-cut-action'), !cakeSliced); show($('btn-to-letter'), cakeSliced);
    show($('btn-recut'), cakeSliced);
    show($('slice-caption'), !cakeSliced); show($('cake-surprise'), cakeSliced);
    $('slice-prompt').innerHTML = cakeSliced ? 'A sweet slice for the sweetest person.<br />Happy birthday, my best friend!' : initialSlicePrompt;
  }
  function renderLetter() {
    show($('envelope-phase'), !letterOpened); $('envelope-phase').inert = letterOpened;
    $('letter-phase').classList.toggle('visible', letterOpened); $('letter-phase').inert = !letterOpened;
    $('letter-phase').setAttribute('aria-hidden', String(!letterOpened));
    $('letter-phase').querySelector('.letter-card-wrap').classList.toggle('shown', letterOpened);
    $('senv-flap').classList.toggle('opened', letterOpened); $('wax-seal').classList.toggle('hidden-seal', letterOpened);
    $('wax-seal').disabled = letterOpened;
    $('scene-letter').setAttribute('aria-labelledby', letterOpened ? 'letter-heading' : 'envelope-heading');
  }
  function goToScene(index, unlock = false) {
    if (index < 0 || index >= scenes.length || (!unlock && index > unlocked)) return;
    if (index >= 4 && !postscriptOpened) {
      explainJourneyLock('letter-gate-message', $('secret-postscript').querySelector('summary')); return;
    }
    if (index >= 5 && viewedPhotos.size < photos.length) {
      explainJourneyLock('photo-gate-message', photos.find((photo, i) => !viewedPhotos.has(i))); return;
    }
    if (index === 6 && revealedWishes.size < wishes.length) { explainWishLock(); return; }
    if (modalOpen) closePhoto(false);
    cancelSceneWork(); effects.clear();
    if (unlock) unlocked = Math.max(unlocked, index);
    current = index;
    // Complete interrupted reveals when returning, without running stale callbacks.
    renderCake(); renderLetter();
    if (index === 0) { $('btn-start').disabled = false; $('gift-box').disabled = false; }
    scenes.forEach((scene, i) => {
      scene.classList.toggle('scene--active', i === index); scene.inert = i !== index; scene.setAttribute('aria-hidden', String(i !== index));
    });
    scenes[index].scrollTop = 0; updateProgress();
    focus(index === 3 && letterOpened ? $('letter-heading') : scenes[index].querySelector('h1, h2'));
    if (index === 6) {
      later(() => celebrate(), 300); later(() => celebrate(true), 1250);
      later(() => { effects.burst(innerWidth * .22, innerHeight * .4, 50); effects.burst(innerWidth * .78, innerHeight * .35, 50); }, 2350);
    }
  }
  function startSurprise() {
    if ($('btn-start').disabled) return;
    if (started) { goToScene(1, true); return; }
    started = true; $('btn-start').disabled = true; $('gift-box').disabled = true;
    $('gift-box').classList.add('opened'); $('gift-hint').textContent = 'A little magic, coming right up…';
    if (!musicChosen) wantsMusic = true;
    if (wantsMusic) playMusic();
    celebrate(true); later(() => goToScene(1, true), 1100);
  }
  function blowCandle() {
    if (candleBlown) return;
    candleBlown = true; $('wish-cake').classList.add('blown'); $('wish-cake').disabled = true; $('btn-blow').disabled = true;
    $('cake-prompt').innerHTML = 'Your wish is on its way to the stars. ✦<br />Now, let’s make this birthday a little sweeter.';
    later(() => { renderCake(); celebrate(); focusReveal($('btn-to-slice')); }, 700);
  }
  function sliceCake() {
    if (cakeSliced) return;
    cakeSliced = true; $('cut-stage').disabled = true; $('btn-cut-action').disabled = true;
    $('btn-cut-action').textContent = 'Cutting your slice…'; $('cut-stage').classList.add('cutting');
    $('cut-stage').setAttribute('aria-busy', 'true');
    $('slice-prompt').textContent = 'Two little cuts… then a slice just for you.';
    later(() => $('cut-stage').classList.add('sliced'), 1350);
    later(() => { renderCake(); celebrate(); focusReveal($('btn-to-letter')); }, 2400);
  }
  function openLetter() {
    if (letterOpened) return;
    letterOpened = true; $('wax-seal').disabled = true;
    $('senv-flap').classList.add('opened'); $('wax-seal').classList.add('hidden-seal'); celebrate(true);
    later(() => { renderLetter(); scenes[current].scrollTop = 0; focus($('letter-heading')); }, 950);
  }

  function updateLetterGate() {
    $('btn-to-gallery').setAttribute('aria-disabled', String(!postscriptOpened));
    $('btn-to-gallery').classList.toggle('action-ready', postscriptOpened);
    show($('letter-lock'), !postscriptOpened);
    $('letter-gate-message').classList.remove('gate-reminder');
    $('letter-gate-message').textContent = postscriptOpened
      ? 'P.S. opened! Our memories are ready for you. 📸'
      : 'Open the P.S. above to unlock our memories.';
  }
  function updatePhotoGate() {
    const ready = viewedPhotos.size === photos.length;
    show($('modal-wishes-action'), ready);
    $('btn-modal-to-wishes').disabled = !ready;
    $('btn-to-wishes').setAttribute('aria-disabled', String(!ready));
    $('btn-to-wishes').classList.toggle('action-ready', ready);
    show($('photo-lock'), !ready);
    $('photo-gate-message').classList.remove('gate-reminder');
    $('photo-gate-message').textContent = ready
      ? 'Every memory opened! Your three wishes are ready. ✦'
      : `Open every photo to unlock your three wishes. ${viewedPhotos.size} of ${photos.length} viewed.`;
    photos.forEach((photo, i) => {
      const viewed = viewedPhotos.has(i);
      photo.classList.toggle('photo-viewed', viewed);
      photo.setAttribute('aria-label', `${photo.dataset.caption}. ${viewed ? 'Viewed. Open again.' : 'Open this memory.'}`);
    });
  }
  function explainJourneyLock(messageId, nextItem) {
    $(messageId).classList.add('gate-reminder');
    focus(nextItem);
    nextItem.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }

  /* Lightbox: native controls, focus containment, swipe, arrows, and return focus. */
  function renderPhoto() {
    const photo = photos[photoIndex];
    show($('modal-img'), true); show($('modal-image-fallback'), false);
    $('modal-img').alt = photo.querySelector('img').alt; $('modal-img').src = photo.dataset.src;
    $('modal-caption').textContent = photo.dataset.caption; $('modal-desc').textContent = photo.dataset.desc;
    $('modal-counter').textContent = `${photoIndex + 1} / ${photos.length}`;
    // Count each memory once, including those reached with arrows or a swipe.
    viewedPhotos.add(photoIndex); updatePhotoGate();
  }
  function openPhoto(index) {
    // Safari does not focus buttons on touch. Save the actual photo, not activeElement.
    photoIndex = index; modalOpener = photos[index]; modalOpen = true; renderPhoto();
    $('photo-modal').inert = false; $('photo-modal').classList.add('active'); $('photo-modal').setAttribute('aria-hidden', 'false');
    $('app-container').inert = true; document.querySelector('.top-nav').inert = true; focus($('modal-close'));
  }
  function closePhoto(restore = true) {
    modalOpen = false; $('app-container').inert = false; document.querySelector('.top-nav').inert = false;
    if (restore) focus(modalOpener || photos[photoIndex]);
    $('photo-modal').classList.remove('active'); $('photo-modal').setAttribute('aria-hidden', 'true'); $('photo-modal').inert = true;
  }
  function movePhoto(direction) { photoIndex = (photoIndex + direction + photos.length) % photos.length; renderPhoto(); }
  $('modal-img').addEventListener('error', () => { show($('modal-img'), false); show($('modal-image-fallback'), true); });
  let touchStart = null;
  const photoSurface = document.querySelector('.modal-img-wrap');
  photoSurface.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  photoSurface.addEventListener('touchend', event => {
    if (!touchStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - touchStart.x, dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) movePhoto(dx < 0 ? 1 : -1);
    touchStart = null;
  }, { passive: true });
  photoSurface.addEventListener('touchcancel', () => { touchStart = null; }, { passive: true });
  document.addEventListener('keydown', event => {
    if (!modalOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); closePhoto(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); movePhoto(-1); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); movePhoto(1); }
    else if (event.key === 'Tab') {
      const controls = [...$('photo-modal').querySelectorAll('button:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); focus(last); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); focus(first); }
    }
  });

  function updateWishGate() {
    const ready = revealedWishes.size === wishes.length;
    $('btn-to-finale').setAttribute('aria-disabled', String(!ready));
    $('btn-to-finale').classList.toggle('action-ready', ready);
    show($('finale-lock'), !ready);
    $('wish-gate-message').classList.remove('gate-reminder');
    $('wish-gate-message').textContent = ready
      ? 'All three wishes are open! Tap One Last Surprise to continue. ✦'
      : `Open all three cards above to unlock your last surprise. ${revealedWishes.size} of 3 opened.`;
  }
  function explainWishLock() {
    const unopened = wishes.filter((note, i) => !revealedWishes.has(i));
    const names = unopened.map(note => note.querySelector('.wish-note-front > span:not(.wish-symbol)').textContent);
    $('wish-gate-message').textContent = `Tap to open ${names.join(', ')} above first. Your last surprise will unlock after all three cards are open.`;
    $('wish-gate-message').classList.add('gate-reminder');
    unopened.forEach(note => note.classList.add('needs-opening'));
    const message = $('wish-gate-message');
    if (message.getBoundingClientRect().bottom > innerHeight - 16) {
      scenes[current].scrollBy({ top: message.getBoundingClientRect().bottom - innerHeight + 24, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  }
  function revealWish(note, index) {
    if (revealedWishes.has(index)) return;
    revealedWishes.add(index); note.classList.add('revealed'); note.setAttribute('aria-expanded', 'true');
    note.classList.remove('needs-opening');
    note.querySelector('.wish-note-back').removeAttribute('aria-hidden'); note.querySelector('.wish-accessible').textContent = '';
    const rect = note.getBoundingClientRect(); effects.burst(rect.x + rect.width / 2, rect.y + rect.height / 2, 14, true);
    $('wish-progress').textContent = `${revealedWishes.size} of 3 wishes opened. ${revealedWishes.size < 3 ? 'There’s more starlight to find.' : 'Every single one, meant for you.'}`;
    updateWishGate();
    if (revealedWishes.size === 3) {
      show($('wish-bonus'), true); celebrate(true);
      $('wish-bonus').tabIndex = -1; focusReveal($('wish-bonus'));
    }
  }
  function revealHug() {
    if (hugged) { celebrate(true); return; }
    hugged = true; show($('final-secret'), true);
    $('btn-hug').setAttribute('aria-expanded', 'true'); $('btn-hug').textContent = 'One More Hug ♡';
    celebrate(true); later(() => celebrate(true), 650);
    const secret = $('final-secret'); secret.tabIndex = -1; focusReveal(secret);
  }
  function reset() {
    cancelSceneWork(); effects.clear(); started = candleBlown = cakeSliced = letterOpened = hugged = false;
    unlocked = 0; revealedWishes.clear(); viewedPhotos.clear(); postscriptOpened = false;
    $('gift-box').classList.remove('opened'); $('gift-hint').textContent = 'Tap the gift to unwrap it ✦'; $('secret-postscript').open = false;
    wishes.forEach((note, i) => {
      note.classList.remove('revealed', 'needs-opening'); note.setAttribute('aria-expanded', 'false');
      note.querySelector('.wish-note-back').setAttribute('aria-hidden', 'true'); note.querySelector('.wish-accessible').textContent = wishLabels[i];
    });
    show($('wish-bonus'), false); $('wish-progress').textContent = 'Three tiny stars. Three wishes, all yours.';
    updateWishGate(); updateLetterGate(); updatePhotoGate();
    show($('final-secret'), false); $('btn-hug').setAttribute('aria-expanded', 'false'); $('btn-hug').textContent = 'Wait… One More Thing ♡';
    // Replay preserves an explicit sound preference; it doesn't turn muted music back on.
    music.pause(); selectMusicTrack(0); syncMusic();
    goToScene(0, true);
  }

  $('music-toggle').addEventListener('click', toggleMusic);
  $('btn-start').addEventListener('click', startSurprise); $('gift-box').addEventListener('click', startSurprise);
  $('btn-blow').addEventListener('click', blowCandle); $('wish-cake').addEventListener('click', blowCandle);
  $('btn-to-slice').addEventListener('click', () => goToScene(2, true));
  $('btn-cut-action').addEventListener('click', sliceCake); $('cut-stage').addEventListener('click', sliceCake);
  $('btn-recut').addEventListener('click', () => {
    cancelSceneWork(); cakeSliced = false; renderCake(); sliceCake();
  });
  $('btn-to-letter').addEventListener('click', () => goToScene(3, true)); $('wax-seal').addEventListener('click', openLetter);
  $('btn-to-gallery').addEventListener('click', () => goToScene(4, true)); $('btn-to-wishes').addEventListener('click', () => goToScene(5, true));
  $('btn-modal-to-wishes').addEventListener('click', () => goToScene(5, true));
  $('btn-to-finale').addEventListener('click', () => goToScene(6, true)); $('btn-hug').addEventListener('click', revealHug); $('btn-replay').addEventListener('click', reset);
  $('modal-close').addEventListener('click', () => closePhoto()); $('modal-backdrop').addEventListener('click', () => closePhoto());
  $('modal-prev').addEventListener('click', () => movePhoto(-1)); $('modal-next').addEventListener('click', () => movePhoto(1));
  steps.forEach((step, i) => step.addEventListener('click', () => goToScene(i)));
  photos.forEach((photo, i) => photo.addEventListener('click', () => openPhoto(i)));
  wishes.forEach((note, i) => note.addEventListener('click', () => revealWish(note, i)));
  $('secret-postscript').addEventListener('toggle', () => {
    if ($('secret-postscript').open && current === 3) {
      postscriptOpened = true; updateLetterGate(); celebrate(true);
    }
  });
  // Sparkles respond to a deliberate tap, with no touchmove handler to impede scrolling.
  document.addEventListener('click', event => {
    if (modalOpen || !event.target.closest('button, summary') || event.target.closest('[aria-disabled="true"]') || !event.detail) return;
    effects.burst(event.clientX, event.clientY, 8);
  });
  document.querySelectorAll('.depth-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!finePointer.matches || reducedMotion.matches) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--tilt-x', `${(0.5 - (event.clientY - rect.top) / rect.height) * 5}deg`);
      card.style.setProperty('--tilt-y', `${((event.clientX - rect.left) / rect.width - 0.5) * 5}deg`);
    }, { passive: true });
    card.addEventListener('pointerleave', () => { card.style.removeProperty('--tilt-x'); card.style.removeProperty('--tilt-y'); });
  });
  document.querySelectorAll('.polaroid-frame img, .finale-main-img').forEach(img => {
    const fallback = () => { img.classList.add('hidden'); img.parentElement.classList.add('photo-missing'); };
    img.addEventListener('error', fallback); if (img.complete && !img.naturalWidth) fallback();
  });
  updateProgress(); updateWishGate(); updateLetterGate(); updatePhotoGate(); syncMusic();
})();
