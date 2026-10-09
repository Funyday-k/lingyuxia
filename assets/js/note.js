(() => {
  "use strict";

  const audio = document.getElementById("nailong-audio");
  const player = document.getElementById("sound-player");
  const toggle = document.getElementById("sound-toggle");
  const mute = document.getElementById("sound-mute");
  const close = document.getElementById("sound-close");
  const launcher = document.getElementById("sound-launcher");
  const status = document.getElementById("sound-status");
  let attempt = 0;
  let autoplayPending = true;

  function render() {
    const playing = !audio.paused;
    player.dataset.playing = String(playing);
    toggle.setAttribute("aria-pressed", String(playing));
    toggle.setAttribute("aria-label", playing ? "暂停奶龙笑声" : "播放奶龙笑声");
    mute.setAttribute("aria-pressed", String(audio.muted));
    mute.setAttribute("aria-label", audio.muted ? "取消静音" : "静音");
    status.textContent = playing ? (audio.muted ? "已静音" : "正在播放") : "点击播放";
  }

  async function play() {
    const currentAttempt = ++attempt;
    status.textContent = "正在加载";
    try {
      await audio.play();
      if (currentAttempt !== attempt) return;
      autoplayPending = false;
      render();
    } catch (error) {
      if (currentAttempt !== attempt) return;
      autoplayPending = error.name === "NotAllowedError";
      render();
      status.textContent = error.name === "NotAllowedError" ? "点击播放" : "音频加载失败";
    }
  }

  function pause() {
    ++attempt;
    autoplayPending = false;
    audio.pause();
    render();
  }

  toggle.addEventListener("click", () => {
    if (audio.paused) play();
    else pause();
  });

  mute.addEventListener("click", () => {
    audio.muted = !audio.muted;
    render();
  });

  close.addEventListener("click", () => {
    pause();
    audio.currentTime = 0;
    player.hidden = true;
    launcher.hidden = false;
    launcher.focus();
  });

  launcher.addEventListener("click", () => {
    player.hidden = false;
    launcher.hidden = true;
    toggle.focus();
    render();
  });

  ["play", "pause", "volumechange"].forEach(event => audio.addEventListener(event, render));
  audio.addEventListener("error", () => {
    ++attempt;
    autoplayPending = false;
    render();
    status.textContent = "音频加载失败";
  });

  // A trusted gesture unlocks sound when the browser blocks audible autoplay.
  function unlockAutoplay(event) {
    if (!autoplayPending || event.target.closest(".sound-player, .sound-launcher")) return;
    play();
  }
  document.addEventListener("pointerdown", unlockAutoplay, { passive: true });
  document.addEventListener("keydown", unlockAutoplay);

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const dragons = Array.from(document.querySelectorAll(".dragon"));
  dragons.forEach(dragon => { dragon.dataset.animation = dragon.src; });
  function updateMotion() {
    dragons.forEach(dragon => {
      dragon.src = reducedMotion.matches ? dragon.dataset.still : dragon.dataset.animation;
    });
  }
  reducedMotion.addEventListener("change", updateMotion);
  updateMotion();

  audio.volume = 0.45;
  render();
  play();
})();
