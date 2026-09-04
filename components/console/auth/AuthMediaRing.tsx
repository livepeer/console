"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type MediaRingItem = {
  src: string;
  alt: string;
};

const RING = {
  cardWidth: 286,
  cardAspectRatio: 4 / 3,
  radiusX: 620,
  radiusY: 360,
  spinSpeed: 2.5,
  cardTiltDegrees: 5,
  pathTiltDegrees: -18,
  introDurationMs: 1100,
} as const;

export const DEFAULT_MEDIA_RING_ITEMS: MediaRingItem[] = [
  {
    src: "/images/console/explore/stable-video-diffusion.webp",
    alt: "Stable Video Diffusion preview",
  },
  {
    src: "/images/console/explore/img2img-sdxl.webp",
    alt: "Image editing preview",
  },
  {
    src: "/images/console/explore/live-video-to-video.webp",
    alt: "Live video preview",
  },
  {
    src: "/images/console/explore/flux-schnell.webp",
    alt: "Flux Schnell preview",
  },
  { src: "/images/console/daydream.png", alt: "Daydream preview" },
  { src: "/images/console/explore/sdxl-turbo.webp", alt: "SDXL Turbo preview" },
  {
    src: "/images/console/explore/real-esrgan-4x.webp",
    alt: "Image upscale preview",
  },
];

interface AuthMediaRingProps {
  items?: MediaRingItem[];
}

export function AuthMediaRing({
  items = DEFAULT_MEDIA_RING_ITEMS,
}: AuthMediaRingProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const loadedImagesRef = useRef(new Set<number>());
  const rotationRef = useRef(-16);
  const [isReady, setIsReady] = useState(false);

  function markImageReady(index: number) {
    loadedImagesRef.current.add(index);
    if (loadedImagesRef.current.size >= items.length) setIsReady(true);
  }

  useEffect(() => {
    const fallback = window.setTimeout(() => setIsReady(true), 900);
    return () => window.clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const cardHeight = RING.cardWidth * RING.cardAspectRatio;
    const pathTilt = (RING.pathTiltDegrees * Math.PI) / 180;
    let animationFrame = 0;
    let introStartTime = 0;
    let lastTime = 0;

    const render = (rotation: number, introProgress: number) => {
      const root = rootRef.current;
      if (!root || items.length === 0) return;

      const viewportScale = Math.min(
        1.16,
        Math.max(0.7, root.clientWidth / 1120)
      );
      const width = RING.cardWidth * viewportScale;
      const height = cardHeight * viewportScale;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const radians =
          (index / items.length) * Math.PI * 2 + (rotation * Math.PI) / 180;
        const depth = (Math.sin(radians) + 1) / 2;
        const rawX =
          Math.cos(radians) *
          RING.radiusX *
          viewportScale *
          (0.74 + depth * 0.26);
        const rawY =
          Math.sin(radians) *
          RING.radiusY *
          viewportScale *
          (0.88 + depth * 0.12);
        const targetX = rawX * Math.cos(pathTilt) - rawY * Math.sin(pathTilt);
        const targetY = rawX * Math.sin(pathTilt) + rawY * Math.cos(pathTilt);
        const targetScale = 0.7 + depth * 0.32;
        const x = targetX * introProgress;
        const y = targetY * introProgress;
        const scale = 0.42 + (targetScale - 0.42) * introProgress;
        const blur = (1 - depth) * 8 + (1 - introProgress) * 4;
        const image = card.firstElementChild as HTMLElement | null;

        card.style.width = `${width}px`;
        card.style.height = `${height}px`;
        card.style.marginLeft = `${-width / 2}px`;
        card.style.marginTop = `${-height / 2}px`;
        card.style.opacity = `${Math.min(1, introProgress * 1.2)}`;
        card.style.zIndex = `${Math.round(depth * 1000)}`;
        card.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${RING.cardTiltDegrees}deg)`;
        card.style.boxShadow = `0 ${8 + depth * 14}px ${22 + depth * 28}px rgba(0,0,0,${0.04 + depth * 0.08})`;

        if (image) {
          image.style.filter = `blur(${blur}px)`;
          image.style.transform = `scale(${1 + blur * 0.012})`;
        }
      });
    };

    const renderFinalFrame = () => render(rotationRef.current, 1);

    if (prefersReducedMotion) {
      renderFinalFrame();
      window.addEventListener("resize", renderFinalFrame);
      return () => window.removeEventListener("resize", renderFinalFrame);
    }

    const tick = (now: number) => {
      if (!introStartTime) introStartTime = now;
      if (!lastTime) lastTime = now;
      const deltaSeconds = (now - lastTime) / 1000;
      const linearProgress = Math.min(
        1,
        (now - introStartTime) / RING.introDurationMs
      );
      const introProgress = 1 - Math.pow(1 - linearProgress, 3);
      lastTime = now;
      rotationRef.current += RING.spinSpeed * deltaSeconds;
      render(rotationRef.current, introProgress);
      animationFrame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("resize", renderFinalFrame);
    animationFrame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", renderFinalFrame);
    };
  }, [isReady, items]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--foreground)_3%,transparent),transparent_58%)]" />
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-1/2 top-1/2 h-[560px] w-[1360px] max-w-[190vw] -translate-x-1/2 -translate-y-1/2 overflow-visible sm:h-[680px] md:w-[1580px]"
        style={{ perspective: "1000px" }}
      >
        <div ref={rootRef} className="relative h-full w-full overflow-visible">
          {items.map((item, index) => (
            <div
              key={item.src}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              className="absolute left-1/2 top-1/2 aspect-[3/4] overflow-hidden rounded-[14px] bg-muted opacity-0 ring-1 ring-border/40 will-change-transform sm:rounded-[18px] md:rounded-[22px]"
              style={{
                width: RING.cardWidth,
                height: RING.cardWidth * RING.cardAspectRatio,
                marginLeft: -RING.cardWidth / 2,
                marginTop: -(RING.cardWidth * RING.cardAspectRatio) / 2,
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            >
              <img
                src={item.src}
                alt={item.alt}
                draggable={false}
                loading="eager"
                decoding="async"
                onLoad={() => markImageReady(index)}
                onError={() => markImageReady(index)}
                className="block h-full w-full object-cover will-change-transform"
              />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
