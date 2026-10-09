import { useRef } from "react";
import { ImageUp } from "lucide-react";
import { useTranslation } from "react-i18next";

/** "✦ From a picture": picks an image file (A1). Pasting works too, where offered. */
export function PictureButton({
  busy,
  onPicture,
}: {
  busy: boolean;
  onPicture: (picture: File) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPicture(file);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="inline-flex items-center gap-1 rounded-sm px-2 py-1 font-semibold text-accent-text hover:bg-surface-3 disabled:opacity-60"
      >
        <ImageUp aria-hidden="true" className="size-4" />
        {t(busy ? "ai.readingPicture" : "ai.fromPicture")}
      </button>
    </>
  );
}
