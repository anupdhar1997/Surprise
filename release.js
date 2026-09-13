/** Open the birthday journey at the scheduled India time, regardless of the visitor's timezone. */
(() => {
  'use strict';
  const opensAt = Date.parse('2026-09-13T21:00:00+05:30');
  const countdown = document.getElementById('release-countdown');
  const status = document.getElementById('countdown-status');
  const retry = document.getElementById('btn-open-surprise');
  const releaseTime = countdown.querySelector('time');
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric'
  }).format(opensAt);
  const timeLabel = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(opensAt).toUpperCase();
  releaseTime.dateTime = new Date(opensAt).toISOString();
  releaseTime.textContent = `${dateLabel} · ${timeLabel} IST`;
  let timer;
  let opening = false;
  const waitedForRelease = Date.now() < opensAt;
  const fireworksSound = document.getElementById('fireworks-sound');
  let celebrationAudio;
  let celebrationGain;
  let priming = false;
  let soundPrimed = false;
  let celebrationActive = false;
  let visualsFinished = false;
  let soundStarted = false;
  let soundComplete = false;
  let playbackPending = false;
  let playsRemaining = 3;

  function finishSound() {
    soundComplete = true;
    fireworksSound.pause();
    document.removeEventListener('click', unlockSound, true);
    document.removeEventListener('keydown', unlockSound);
    if (celebrationAudio && celebrationAudio.state !== 'closed') celebrationAudio.close().catch(() => {});
  }

  function startCrackerPlayback() {
    if (soundComplete || priming || playbackPending || playsRemaining === 0) return;
    if (!fireworksSound.paused && !fireworksSound.ended) return;
    if (celebrationAudio) {
      celebrationGain.gain.value = .6;
      celebrationAudio.resume().catch(() => {});
    } else {
      // Try normal autoplay too, for browsers that already allow this site audio.
      fireworksSound.volume = .6;
    }
    fireworksSound.currentTime = 0;
    playbackPending = true;
    fireworksSound.play().then(() => {
      soundStarted = true;
      playbackPending = false;
      // If autoplay was blocked, pair the first permitted playback with fresh fireworks.
      if (visualsFinished) celebrateOpening();
    }).catch(() => {
      // Keep the first-tap fallback available even after the initial visuals finish.
      playbackPending = false;
    });
  }

  function prepareSound() {
    if (soundComplete || priming) return;
    if (celebrationActive) { startCrackerPlayback(); return; }
    try {
      if (!celebrationAudio) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        celebrationAudio = new AudioContext();
        celebrationGain = celebrationAudio.createGain();
        celebrationGain.gain.value = 0;
        celebrationAudio.createMediaElementSource(fireworksSound)
          .connect(celebrationGain).connect(celebrationAudio.destination);
      }
      if (soundPrimed && celebrationAudio.state === 'running') return;
      priming = true;
      celebrationGain.gain.value = 0;
      Promise.all([celebrationAudio.resume(), fireworksSound.play()]).then(() => {
        fireworksSound.pause();
        fireworksSound.currentTime = 0;
        celebrationGain.gain.value = .6;
        soundPrimed = true;
      }).catch(() => {
        fireworksSound.pause();
        fireworksSound.currentTime = 0;
      }).finally(() => {
        priming = false;
        if (celebrationActive) startCrackerPlayback();
      });
    } catch {
      // The audio element can still play without Web Audio support.
    }
  }

  function unlockSound(event) {
    if (event.repeat) return;
    if (countdown.hidden) {
      const welcomeCard = event.target.closest && event.target.closest('#scene-welcome.scene--active .welcome-card');
      if (!welcomeCard || soundComplete) return;
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      if (!celebrationActive) celebrateOpening();
      else startCrackerPlayback();
      return;
    }
    prepareSound();
  }
  // A completed click/tap counts as activation on touch devices too.
  document.addEventListener('click', unlockSound, true);
  document.addEventListener('keydown', unlockSound);

  fireworksSound.addEventListener('ended', () => {
    if (!celebrationActive || !soundStarted || soundComplete) return;
    playsRemaining--;
    if (playsRemaining > 0) startCrackerPlayback();
    else finishSound();
  });

  function playCrackers() {
    celebrationActive = true;
    startCrackerPlayback();
  }

  function celebrateOpening() {
    visualsFinished = false;
    const canvas = document.getElementById('release-fireworks');
    const context = canvas.getContext('2d');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const colors = ['#ffd36e', '#ff76ae', '#80dfff', '#bc98ff', '#88efc0'];
    const bursts = [[.22, .3, 0], [.78, .25, .65], [.48, .2, 1.3], [.66, .48, 2],
      [.22, .3, 3], [.78, .25, 3.65], [.48, .2, 4.3], [.66, .48, 5],
      [.22, .3, 6], [.78, .25, 6.65], [.48, .2, 7.3], [.66, .48, 8]];
    const sparks = bursts.flatMap(([x, y, delay]) => Array.from({ length: 65 }, (_, i) => ({
      x, y, delay, angle: Math.PI * 2 * i / 65,
      speed: 65 + Math.random() * 140, color: colors[i % colors.length], size: 1.2 + Math.random() * 1.8
    })));
    let frame;
    const started = performance.now();
    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function finish() {
      cancelAnimationFrame(frame);
      canvas.hidden = true;
      if (context) context.clearRect(0, 0, innerWidth, innerHeight);
      window.removeEventListener('resize', resize);
      visualsFinished = true;
      if (soundStarted || soundComplete) {
        document.removeEventListener('click', unlockSound, true);
        document.removeEventListener('keydown', unlockSound);
      }
    }
    function draw(now) {
      const still = reducedMotion.matches;
      const elapsed = (now - started) / 1000;
      context.clearRect(0, 0, innerWidth, innerHeight);
      for (const spark of sparks) {
        const age = still ? .55 : elapsed - spark.delay;
        if (age < 0 || age > 1.7) continue;
        const distance = spark.speed * age;
        const x = spark.x * innerWidth + Math.cos(spark.angle) * distance;
        const y = spark.y * innerHeight + Math.sin(spark.angle) * distance + age * age * 42;
        context.globalAlpha = Math.max(0, 1 - age / 1.7);
        context.strokeStyle = spark.color; context.lineWidth = spark.size;
        context.beginPath(); context.moveTo(x, y);
        context.lineTo(x - Math.cos(spark.angle) * 7, y - Math.sin(spark.angle) * 7);
        context.stroke();
      }
      context.globalAlpha = 1;
      if (!still && elapsed < 9.8) frame = requestAnimationFrame(draw);
    }
    playCrackers();
    if (context) {
      resize(); canvas.hidden = false;
      window.addEventListener('resize', resize);
      draw(started);
    }
    setTimeout(finish, 10000);
  }

  function openSurprise() {
    if (opening || Date.now() < opensAt) return;
    opening = true;
    clearTimeout(timer);
    retry.classList.add('hidden');
    status.textContent = 'Your birthday surprise is ready. Opening it now…';
    const script = document.createElement('script');
    script.src = 'script.js';
    script.onload = () => {
      document.body.classList.remove('surprise-locked');
      document.querySelector('.top-nav').inert = false;
      document.getElementById('app-container').inert = false;
      countdown.hidden = true;
      const heading = document.getElementById('welcome-title');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('pageshow', updateCountdown);
      if (waitedForRelease) celebrateOpening();
      // Late visitors can still start their celebration by tapping the welcome card.
    };
    script.onerror = () => {
      script.remove();
      opening = false;
      status.textContent = 'Your surprise is ready, but couldn’t load. Tap below to try again.';
      retry.classList.remove('hidden');
    };
    document.body.append(script);
  }

  function updateCountdown() {
    clearTimeout(timer);
    if (opening) return;
    const remaining = Math.max(0, opensAt - Date.now());
    const totalSeconds = Math.ceil(remaining / 1000);
    const values = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor(totalSeconds / 3600) % 24,
      minutes: Math.floor(totalSeconds / 60) % 60,
      seconds: totalSeconds % 60
    };
    for (const [unit, value] of Object.entries(values)) {
      document.getElementById(`countdown-${unit}`).textContent = String(value).padStart(2, '0');
    }
    if (remaining === 0) openSurprise();
    else timer = setTimeout(updateCountdown, remaining % 1000 || 1000);
  }

  function refreshWhenVisible() {
    if (!document.hidden) updateCountdown();
  }
  retry.addEventListener('click', openSurprise);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('pageshow', updateCountdown);
  updateCountdown();
})();
