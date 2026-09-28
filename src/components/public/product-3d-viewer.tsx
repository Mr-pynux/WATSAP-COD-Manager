"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Package,
  Pause,
  Play,
  RotateCw,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { youtubeEmbed, youtubeId } from "@/lib/url";
import Zoom from 'react-medium-image-zoom';
import 'react-medium-image-zoom/dist/styles.css';

interface MediaItem {
  type: "image" | "video";
  src: string;
}

interface Product3DViewerProps {
  name: string;
  images: string[];
  videoUrl?: string | null;
  /** fullscreen inspection opened from outside (e.g. gallery tile click) */
  openIndex?: number | null;
  onOpenIndexChange?: (v: number | null) => void;
  /** visual variant: dark studio stage (hero) */
  className?: string;
}

const PX_PER_FRAME = 90;
const TILT_MAX_X = 10;
const TILT_MAX_Y = 14;

export function Product3DViewer({
  name,
  images,
  videoUrl,
  openIndex = null,
  onOpenIndexChange,
  className,
}: Product3DViewerProps) {
  const media = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = images.map((src) => ({ type: "image", src }));
    if (videoUrl) items.push({ type: "video", src: videoUrl });
    return items;
  }, [images, videoUrl]);

  const [localIndex, setLocalIndex] = useState(0);
  const [dragRotY, setDragRotY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [interacted, setInteracted] = useState(false);
  const [auto, setAuto] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, startIndex: 0, active: false });

  // displayed index: pinned to openIndex while the fullscreen inspection is open,
  // otherwise the locally-navigated index (clamped when media shrinks)
  const index =
    openIndex != null && openIndex >= 0 && openIndex < media.length
      ? openIndex
      : Math.min(localIndex, Math.max(0, media.length - 1));

  /** route index changes to the right owner (dialog state vs local state). */
  const setView = useCallback(
    (target: number) => {
      const clamped = ((target % media.length) + media.length) % media.length;
      if (openIndex != null) onOpenIndexChange?.(clamped);
      else setLocalIndex(clamped);
    },
    [media.length, openIndex, onOpenIndexChange]
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      setInteracted(true);
      setView(index + dir);
    },
    [index, setView]
  );

  // optional auto-rotate
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setView(index + 1), 800);
    return () => clearInterval(t);
  }, [auto, index, setView]);

  const isVideo = media[index]?.type === "video";
  const current = media[index];
  const ytVideoId = isVideo ? youtubeId(current?.src ?? "") : null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isVideo) return; // don't hijack the video controls
    drag.current = { startX: e.clientX, startIndex: index, active: true };
    setDragging(true);
    setInteracted(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current.active) {
      const dx = e.clientX - drag.current.startX;
      const frames = Math.round(dx / PX_PER_FRAME);
      setDragRotY(Math.max(-40, Math.min(40, (dx / PX_PER_FRAME) * 24)));
      setView(drag.current.startIndex - frames);
    } else {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: -ny * TILT_MAX_X, y: nx * TILT_MAX_Y });
    }
  };

  const endDrag = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    setDragRotY(0);
  };

  const onStageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  };

  const stageInner = (
    <>
      {/* golden studio glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 38%, rgba(240,192,0,0.22), transparent 70%)",
        }}
      />
      {/* floating product + reflection (outer wrapper floats, inner tilts) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative w-full h-full"
          style={{
            transform: `rotateY(${dragRotY}deg)`,
            transition: dragging ? "none" : "transform 240ms ease-out",
          }}
        >
          {isVideo ? (
            ytVideoId ? (
              <iframe
                key={current?.src}
                src={youtubeEmbed(ytVideoId)}
                title="فيديو المنتج"
                className="absolute inset-0 w-full h-full rounded-xl"
                style={{ border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <video
                key={current?.src}
                src={current?.src}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-contain rounded-xl bg-stone-100"
              />
            )
          ) : (
            <>
              {media.map((m, i) =>
                m.type === "image" ? (
                  <div
                    key={m.src}
                    aria-hidden={i !== index}
                    className={cn(
                      "absolute inset-0 w-full h-full",
                      "transition-opacity duration-200",
                      i === index ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
                    )}
                  >
                    <Zoom>
                      <img
                        src={m.src}
                        alt={i === index ? `${name} — وجه ${i + 1}` : ""}
                        draggable={false}
                        className="w-full h-full object-contain select-none bg-stone-100"
                        style={{ aspectRatio: "4/5" }}
                      />
                    </Zoom>
                  </div>
                ) : null
              )}
            </>
          )}
        </div>
      </div>
    </>
  );

  if (media.length === 0) {
    return (
      <div
        className={cn(
          "aspect-square md:aspect-[4/3] rounded-3xl bg-stone-950 flex items-center justify-center border border-stone-800",
          className
        )}
      >
        <div className="text-center text-stone-500 space-y-3">
          <Package className="h-12 w-12 mx-auto" />
          <p className="text-sm">ما كايناش صور — زيدهم من لوحة التحكم</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 min-w-0", className)}>
      {/* ── 3D stage ─────────────────────────────── */}
      <div
        ref={stageRef}
        role="region"
        aria-label={`فحص ${name} بتقنية 360 درجة`}
        tabIndex={0}
        onKeyDown={onStageKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={() => {
          endDrag();
          setTilt({ x: 0, y: 0 });
        }}
        style={{ perspective: "1100px", touchAction: "pan-y" }}
        className={cn(
          "relative aspect-[4/5] md:aspect-[4/5] rounded-3xl overflow-hidden",
          "bg-gradient-to-b from-stone-900 via-stone-950 to-black",
          "border border-stone-800 ring-1 ring-white/5",
          "outline-none focus-visible:ring-2 focus-visible:ring-brand/70",
          dragging ? "cursor-grabbing" : "cursor-grab",
          "group"
        )}
      >
        {stageInner}

        {/* 360° hint chip (until first interaction) */}
        {!interacted && (
          <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
            <span className="flex items-center gap-1.5 bg-brand text-stone-950 text-xs font-extrabold rounded-full px-3 py-1.5 shadow-lg shadow-brand/25">
              <RotateCw className="h-3.5 w-3.5" />
              دَوِّر المنتج — فحص 360°
            </span>
          </div>
        )}

        {/* corner actions */}
        <div className="absolute top-3 start-3 flex gap-1.5">
          <span className="bg-white/10 backdrop-blur text-brand text-[11px] font-bold rounded-full px-2.5 py-1 flex items-center gap-1 ltr-num">
            {index + 1}/{media.length}
          </span>
        </div>
        <div className="absolute top-3 end-3 flex gap-1.5 opacity-90">
          <button
            type="button"
            onClick={() => setAuto((a) => !a)}
            aria-label={auto ? "وقف الدوران التلقائي" : "دوران تلقائي"}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-colors"
          >
            {auto ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => onOpenIndexChange?.(index)}
            aria-label="فحص بحجم كبير"
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        {/* desktop arrows */}
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="الوجه التالي"
          className="hidden md:flex absolute end-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur text-white items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="الوجه السابق"
          className="hidden md:flex absolute start-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur text-white items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      {/* ── thumbnails ───────────────────────────── */}
      {media.length > 1 && (
        <div className="flex gap-2 overflow-x-auto nice-scroll pb-1 max-w-full min-w-0" dir="ltr">
          {media.map((m, i) => (
            <button
              key={m.src}
              type="button"
              onClick={() => {
                setView(i);
                setInteracted(true);
              }}
              aria-label={m.type === "video" ? "فيديو المنتج" : `صورة ${i + 1}`}
              aria-pressed={i === index}
              className={cn(
                "relative h-14 w-14 shrink-0 rounded-xl overflow-hidden border-2 bg-stone-900 transition-all",
                i === index
                  ? "border-brand scale-105"
                  : "border-stone-700 opacity-70 hover:opacity-100"
              )}
            >
              {m.type === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-stone-900 text-brand">
                  <Play className="h-5 w-5 fill-brand" />
                </span>
              ) : (
                <img src={m.src} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── fullscreen 3D inspection dialog ──────── */}
      <Dialog
        open={openIndex != null}
        onOpenChange={(o) => {
          if (!o) onOpenIndexChange?.(null);
        }}
      >
        <DialogContent
          className="max-w-3xl p-0 overflow-hidden bg-stone-950 border-stone-800"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">فحص المنتج {name}</DialogTitle>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={() => {
              endDrag();
              setTilt({ x: 0, y: 0 });
            }}
            style={{ perspective: "1200px", touchAction: "pan-y" }}
            className={cn(
              "relative aspect-video md:aspect-[16/10] cursor-grab active:cursor-grabbing",
              dragging && "cursor-grabbing"
            )}
          >
            {stageInner}
            <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none">
              <span className="bg-white/10 backdrop-blur text-white/80 text-xs font-semibold rounded-full px-3 py-1">
                اسحب باش تدور المنتج
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
