import { IdfPhotoCredit } from "@/components/IdfPhotoCredit";
import { IdfPhotoBackdrop } from "@/components/IdfPhotoBackdrop";
import type { IdfPhoto } from "@/lib/idf-photo-catalog";

type Props = {
  photo: IdfPhoto;
  className?: string;
  aspectClassName?: string;
  overlayClassName?: string;
  imgClassName?: string;
  showCredit?: boolean;
  creditPosition?: "bottom" | "corner";
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
};

/** Full-bleed panel with gradient + per-photo credit. */
export function IdfPhotoPanel({
  photo,
  className = "",
  aspectClassName = "min-h-[200px]",
  overlayClassName,
  imgClassName,
  showCredit = true,
  creditPosition = "bottom",
  loading,
  fetchPriority,
}: Props) {
  return (
    <div className={`relative overflow-hidden ${aspectClassName} ${className}`}>
      <IdfPhotoBackdrop
        src={photo.src}
        srcSet={photo.srcSet}
        alt={photo.alt}
        objectPosition={photo.objectPosition}
        overlayClassName={overlayClassName ?? "from-background/30 via-background/50 to-background/85"}
        imgClassName={imgClassName}
        loading={loading}
        fetchPriority={fetchPriority}
      />
      {showCredit ? (
        <div
          className={
            creditPosition === "corner"
              ? "absolute bottom-2 left-2 right-2 z-10 text-left"
              : "absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background/95 to-transparent px-3 pb-2 pt-6 text-left"
          }
        >
          <IdfPhotoCredit photo={photo} />
        </div>
      ) : null}
    </div>
  );
}
