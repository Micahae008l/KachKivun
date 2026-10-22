import { m } from "framer-motion";
import { IdfPhotoPanel } from "@/components/IdfPhotoPanel";
import { IDF_PHOTO_CATALOG, type IdfPhoto } from "@/lib/idf-photo-catalog";

const ease = [0.16, 1, 0.3, 1] as const;

type Props = {
  /** Catalog ids; omit to show entire catalog */
  photoIds?: string[];
  columns?: 2 | 3 | 4 | 5;
  aspectClassName?: string;
  className?: string;
};

function resolvePhotos(photoIds?: string[]): IdfPhoto[] {
  if (!photoIds?.length) return [...IDF_PHOTO_CATALOG];
  const byId = Object.fromEntries(IDF_PHOTO_CATALOG.map((p) => [p.id, p]));
  return photoIds.map((id) => byId[id]).filter(Boolean) as IdfPhoto[];
}

const colClass: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

/** Responsive grid of IDF photos — each cell has its own credit line. */
export function IdfPhotoGallery({
  photoIds,
  columns = 3,
  aspectClassName = "aspect-[4/3]",
  className = "",
}: Props) {
  const photos = resolvePhotos(photoIds);

  return (
    <div className={`grid gap-1 ${colClass[columns] ?? colClass[3]} ${className}`}>
      {photos.map((photo, i) => (
        <m.div
          key={photo.id}
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-24px" }}
          transition={{ duration: 0.45, delay: i * 0.04, ease }}
        >
          <IdfPhotoPanel
            photo={photo}
            aspectClassName={aspectClassName}
            overlayClassName="from-background/15 via-transparent to-background/40"
            creditPosition="corner"
          />
        </m.div>
      ))}
    </div>
  );
}
