"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, ChoiceChip, ReasonNote } from "@/components/ui";
import { routeMetaOf } from "@/lib/nav";
import { IMPROVEMENT_BODY_MAX, IMPROVEMENT_SHOT_MAX_BYTES, shotBytesOf } from "@/lib/domain/improvement";

/**
 * 全画面共通の「改善要望」。
 *
 * 右下の小さなボタンから開き、いまの画面を撮って印を付け、一言添えて送る。
 * どの画面から届いたかは開いているURLから自動で入れる（打たせない）。
 *
 * 差し込むのは AppShell の1箇所だけ。画面ごとに置くと、置き忘れた画面が
 * 「意見を出せない画面」になる。
 */

type Point = { x: number; y: number };

type Shape =
  | { kind: "pen"; color: string; points: Point[] }
  | { kind: "rect"; color: string; from: Point; to: Point }
  | { kind: "arrow"; color: string; from: Point; to: Point }
  | { kind: "mask"; color: string; from: Point; to: Point }
  | { kind: "text"; color: string; at: Point; text: string };

type Tool = Shape["kind"];

/** 撮った画像の長辺の上限。これ以上大きくしても読めるものは増えない。 */
const MAX_EDGE = 1600;

/** 印の色。値は globals.css の --mark-* が正本（画像に焼き込むので明暗で変えない）。 */
const COLOR_KEYS = ["red", "amber", "blue", "ink"] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

const COLOR_LABEL: Record<ColorKey, string> = {
  red: "赤",
  amber: "橙",
  blue: "青",
  ink: "黒",
};

const TOOL_OPTIONS: { value: Tool; label: string }[] = [
  { value: "pen", label: "手書き" },
  { value: "rect", label: "四角" },
  { value: "arrow", label: "矢印" },
  { value: "text", label: "文字" },
  { value: "mask", label: "目隠し" },
];

/**
 * 印の色を CSS から読む。
 * 画面に色の値を書かないための決まり（globals.css が色の正本）。
 */
function cssColor(key: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--mark-${key}`).trim();
  return v || "black";
}

/** 画像を長辺 MAX_EDGE まで縮めて、キャンバスに描ける形にする。 */
function loadImage(dataUrl: string): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.round(img.naturalWidth * scale);
      const height = Math.round(img.naturalHeight * scale);
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ dataUrl: c.toDataURL("image/jpeg", 0.85), width, height });
    };
    img.onerror = () => reject(new Error("image"));
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

/** 上限に収まるまで品質を落として書き出す。 */
function exportCanvas(canvas: HTMLCanvasElement): string | null {
  for (const quality of [0.85, 0.7, 0.55, 0.4, 0.3]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (shotBytesOf(url) <= IMPROVEMENT_SHOT_MAX_BYTES) return url;
  }
  return null;
}

export function FeedbackWidget() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef<Shape | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [tool, setTool] = useState<Tool>("rect");
  const [color, setColor] = useState<ColorKey>("red");
  const [textDraft, setTextDraft] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const screenLabel = routeMetaOf(pathname)?.label ?? "その他の画面";

  /* ───── 窓の開け閉め ───── */

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const reset = () => {
    setShot(null);
    setShapes([]);
    setBody("");
    setTextDraft("");
    setError(null);
    setSent(false);
    baseRef.current = null;
  };

  /* ───── 画像を受け取る ───── */

  const acceptImage = useCallback(async (dataUrl: string) => {
    try {
      const next = await loadImage(dataUrl);
      const img = new Image();
      img.src = next.dataUrl;
      await img.decode();
      baseRef.current = img;
      setShapes([]);
      setShot(next);
    } catch {
      setError("画像を読み込めませんでした。");
    }
  }, []);

  /**
   * いまの画面を撮る。
   *
   * ブラウザの画面共有を使う。撮る対象を選ぶ間はまだ映さないので、
   * 選び終わってからこの窓を閉じ、少し待ってから1コマだけ取り出す。
   * こうしないと、この窓自体が写り込む。
   */
  const capture = async () => {
    setError(null);
    const media = navigator.mediaDevices;
    if (!media?.getDisplayMedia) {
      setError("この端末では画面を撮れません。画像を貼り付けてください。");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await media.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
    } catch {
      setError("画面の共有が許可されませんでした。");
      return;
    }

    document.documentElement.dataset.shooting = "1";
    setOpen(false);
    try {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      // 窓が消えて画面が描き直されるのを待つ
      await new Promise((r) => setTimeout(r, 450));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      video.pause();
      await acceptImage(canvas.toDataURL("image/png"));
    } catch {
      setError("画面を撮れませんでした。もう一度お試しください。");
    } finally {
      for (const track of stream.getTracks()) track.stop();
      delete document.documentElement.dataset.shooting;
      setOpen(true);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const file = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (!file) return;
    e.preventDefault();
    void readFileAsDataUrl(file).then(acceptImage);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void readFileAsDataUrl(file).then(acceptImage);
  };

  /* ───── 印を描く ───── */

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !base || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);

    const unit = Math.max(2, Math.round(canvas.width / 400));
    const all = drawingRef.current ? [...shapes, drawingRef.current] : shapes;
    for (const shape of all) {
      ctx.lineWidth = unit;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      if (shape.kind === "pen") {
        ctx.beginPath();
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.stroke();
      } else if (shape.kind === "rect") {
        ctx.strokeRect(shape.from.x, shape.from.y, shape.to.x - shape.from.x, shape.to.y - shape.from.y);
      } else if (shape.kind === "mask") {
        ctx.fillRect(shape.from.x, shape.from.y, shape.to.x - shape.from.x, shape.to.y - shape.from.y);
      } else if (shape.kind === "arrow") {
        const { from, to } = shape;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const head = unit * 5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - head * Math.cos(angle - 0.4), to.y - head * Math.sin(angle - 0.4));
        ctx.lineTo(to.x - head * Math.cos(angle + 0.4), to.y - head * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      } else {
        const size = unit * 7;
        ctx.font = `700 ${size}px sans-serif`;
        ctx.textBaseline = "top";
        // 濃い場所でも読めるよう、文字の周りを白で縁取る
        ctx.strokeStyle = cssColor("paper");
        ctx.lineWidth = unit;
        ctx.strokeText(shape.text, shape.at.x, shape.at.y);
        ctx.fillText(shape.text, shape.at.x, shape.at.y);
      }
    }
  }, [shapes]);

  useEffect(() => {
    redraw();
  }, [redraw, shot]);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!shot) return;
    const at = pointOf(e);
    const c = cssColor(color);
    if (tool === "text") {
      const text = textDraft.trim();
      if (!text) {
        setError("先に、上の欄へ入れる文字を打ってください。");
        return;
      }
      setError(null);
      setShapes((prev) => [...prev, { kind: "text", color: c, at, text }]);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current =
      tool === "pen" ? { kind: "pen", color: c, points: [at] } : { kind: tool, color: c, from: at, to: at };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const current = drawingRef.current;
    if (!current) return;
    const at = pointOf(e);
    if (current.kind === "pen") current.points.push(at);
    else if (current.kind !== "text") current.to = at;
    redraw();
  };

  const onPointerUp = () => {
    const current = drawingRef.current;
    drawingRef.current = null;
    if (!current) return;
    setShapes((prev) => [...prev, current]);
  };

  const undo = () => setShapes((prev) => prev.slice(0, -1));

  /* ───── 送る ───── */

  const submit = async () => {
    if (busy) return;
    if (!body.trim()) {
      setError("改善したいことを入力してください。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let image: string | null = null;
      if (shot && canvasRef.current) {
        image = exportCanvas(canvasRef.current);
        if (!image) {
          setError("画像が大きすぎます。範囲を狭めて撮り直してください。");
          return;
        }
      }
      const res = await fetch("/api/improvements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: pathname,
          body,
          viewport: `${window.innerWidth}×${window.innerHeight}`,
          shot: image,
        }),
      });
      const json = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "送れませんでした。");
        return;
      }
      setSent(true);
    } catch {
      setError("通信できませんでした。入力内容はこの窓に残っています。");
    } finally {
      setBusy(false);
    }
  };

  /* ───── 見た目 ───── */

  return (
    <div className="feedback-root no-print">
      <div className="feedback-fab">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          改善要望
        </Button>
      </div>

      <dialog ref={dialogRef} className="feedback-dialog" aria-label="改善要望を送る" onClose={close} onPaste={onPaste}>
        <div className="feedback-dialog-body">
          <div className="feedback-dialog-main">
            <p className="m-0 text-note text-ink-muted">この画面について送ります</p>
            <p className="mt-1 mb-3 font-bold">{screenLabel}</p>

            {sent ? (
              <ReasonNote>
                送りました。ありがとうございます。内容は管理者の一覧に届いています。
              </ReasonNote>
            ) : (
              <>
                {error && <ReasonNote>{error}</ReasonNote>}

                <label className="footnote" htmlFor="feedback_body">
                  改善したいこと
                </label>
                <textarea
                  id="feedback_body"
                  className="input min-h-[80px] w-full"
                  autoFocus
                  maxLength={IMPROVEMENT_BODY_MAX}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="例：この一覧から、担当者で絞り込めると助かります。"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={capture} disabled={busy}>
                    この画面を撮る
                  </Button>
                  <Button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
                    画像を選ぶ
                  </Button>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
                  <span className="footnote">画像は貼り付け（Ctrl+V）もできます</span>
                </div>

                {shot && (
                  <div className="mt-3">
                    <div className="feedback-tools">
                      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="書き込む道具">
                        {TOOL_OPTIONS.map((o) => (
                          <ChoiceChip key={o.value} selected={tool === o.value} onClick={() => setTool(o.value)}>
                            {o.label}
                          </ChoiceChip>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        {COLOR_KEYS.map((key) => (
                          <ChoiceChip
                            key={key}
                            selected={color === key}
                            onClick={() => setColor(key)}
                            aria-label={`${COLOR_LABEL[key]}で書く`}
                          >
                            <span className="feedback-swatch" data-mark={key} />
                          </ChoiceChip>
                        ))}
                      </div>
                      <Button type="button" onClick={undo} disabled={shapes.length === 0}>
                        元に戻す
                      </Button>
                    </div>

                    {tool === "text" && (
                      <input
                        type="text"
                        className="input mt-2 w-full"
                        value={textDraft}
                        maxLength={40}
                        onChange={(e) => setTextDraft(e.target.value)}
                        placeholder="入れる文字を打ってから、画像を押します"
                      />
                    )}

                    <canvas
                      ref={canvasRef}
                      className="feedback-canvas mt-2"
                      width={shot.width}
                      height={shot.height}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                    />
                    <p className="footnote">見られたくない部分は「目隠し」で塗りつぶせます。</p>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="feedback-dialog-foot">
            <Button type="button" onClick={close}>
              閉じる
            </Button>
            {!sent && (
              <Button type="button" variant="primary" onClick={submit} disabled={busy || !body.trim()}>
                送る
              </Button>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
