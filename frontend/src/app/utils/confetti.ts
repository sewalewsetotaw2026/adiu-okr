import confetti from "canvas-confetti";

// Brand colors for Kacha HRIS
const BRAND_COLORS = ["#e55400", "#ffda00"];

/**
 * Triggers side cannon confetti effect from both sides of the screen
 * Duration: 3 seconds
 */
export const triggerSideCannons = (): void => {
  const duration = 3 * 1000; // 3 seconds
  const end = Date.now() + duration;

  const frame = () => {
    if (Date.now() > end) return;

    // Left cannon
    confetti({
      particleCount: 2,
      angle: 60,
      spread: 55,
      startVelocity: 60,
      origin: { x: 0, y: 0.5 },
      colors: BRAND_COLORS,
    });

    // Right cannon
    confetti({
      particleCount: 2,
      angle: 120,
      spread: 55,
      startVelocity: 60,
      origin: { x: 1, y: 0.5 },
      colors: BRAND_COLORS,
    });

    requestAnimationFrame(frame);
  };

  frame();
};

/**
 * Triggers fireworks effect with random bursts
 * Duration: 5 seconds
 */
export const triggerFireworks = (): void => {
  const duration = 5 * 1000; // 5 seconds
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

  const randomInRange = (min: number, max: number) =>
    Math.random() * (max - min) + min;

  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: BRAND_COLORS,
    });

    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: BRAND_COLORS,
    });
  }, 250);
};

/**
 * Triggers a quick confetti burst
 * Used for button clicks and interactions
 */
export const triggerQuickBurst = (): void => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: BRAND_COLORS,
  });
};
