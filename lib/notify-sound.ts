// Reproduce el sonido de notificación (public/notificacion.mp3).
// Los navegadores bloquean el autoplay sin gesto previo del usuario, así que se
// usa un único elemento Audio compartido que se "desbloquea" con la primera
// interacción (click/tap/tecla) sobre la página.

const AUDIO_URL = '/notificacion.mp3';
const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'click', 'keydown'] as const;

let audioEl: HTMLAudioElement | null = null;
let audioUnlocked = false;

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
    audioEl.src = AUDIO_URL;
  }
  return audioEl;
}

function unlockAudio() {
  if (audioUnlocked) return;
  const audio = getAudio();
  const prevVolume = audio.volume;
  audio.volume = 0;
  // Reproduce a volumen 0 y pausa al instante para satisfacer la política de
  // autoplay (dentro del gesto del usuario); a partir de entonces los play()
  // posteriores sí se permiten.
  audio
    .play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = prevVolume;
      audioUnlocked = true;
    })
    .catch(() => {
      audio.volume = prevVolume;
      // Sin gesto válido aún; se reintenta en la siguiente interacción.
    });
}

if (typeof window !== 'undefined') {
  for (const eventName of UNLOCK_EVENTS) {
    window.addEventListener(eventName, unlockAudio, { passive: true, capture: true });
  }
}

export function playNotificationSound() {
  try {
    const audio = getAudio();
    audio.volume = 0.9;
    audio.currentTime = 0;
    audio
      .play()
      .catch(() => {
        // Autoplay bloqueado hasta la primera interacción del usuario.
      });
  } catch {
    // Silencioso: nunca debe romper el flujo de notificaciones.
  }
}