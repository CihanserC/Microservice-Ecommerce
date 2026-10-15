// Simülasyon saati. Diyagram animasyonları ve adımlar arası beklemeler bu saatle ilerler:
// - Hız (rate): saat gerçek zamandan rate kat hızlı akar. Hız değişince yoldaki paket de
//   o anda hızlanır/yavaşlar; yeni adımı beklemek gerekmez.
// - Durdurma: saat durur, paket olduğu yerde kalır; devam edilince kaldığı yerden sürer.

let rate = 1;
let paused = false;
let virtualAtMark = 0;               // son değişiklik anındaki simülasyon zamanı
let realAtMark = performance.now();  // son değişiklik anındaki gerçek zaman
const listeners = new Set();
let resumeWaiters = [];

/** Simülasyon zamanı (ms, 1× hıza göre). */
export function now() {
  return paused ? virtualAtMark : virtualAtMark + (performance.now() - realAtMark) * rate;
}

function mark() {
  virtualAtMark = now();
  realAtMark = performance.now();
}

/** Saatin hızı; 1 = gerçek zaman. Çok büyük değer "anında" demektir. */
export function setRate(value) {
  mark();
  rate = Math.max(0.01, value);
}

export const isPaused = () => paused;

export function setPaused(value) {
  if (value === paused) return;
  mark();
  paused = value;
  if (!paused) {
    resumeWaiters.forEach(resolve => resolve());
    resumeWaiters = [];
  }
  listeners.forEach(fn => fn(paused));
}

export function onPauseChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Durdurulmuşsa devam edilene kadar bekler. */
export function untilResumed() {
  return paused ? new Promise(resolve => resumeWaiters.push(resolve)) : Promise.resolve();
}

/** Simülasyon saatiyle ms kadar bekler; hız değişikliği ve durdurma beklemeyi de etkiler. */
export function wait(ms) {
  if (ms <= 0) return Promise.resolve();
  const end = now() + ms;
  return new Promise(resolve => {
    const tick = () => {
      const left = end - now();
      if (left <= 0) return resolve();
      setTimeout(tick, paused ? 50 : Math.min(50, left / rate));
    };
    tick();
  });
}
