import type { IdfPhoto } from "@/lib/idf-photo-catalog";

type Props = {
  photo: IdfPhoto;
  className?: string;
};

/** Per-image credit line */
export function IdfPhotoCredit({ photo, className = "" }: Props) {
  return (
    <p
      className={`font-mono text-[9px] leading-snug text-dust/90 ${className}`}
      title={photo.credit}
    >
      {photo.commonsUrl ? (
        <>
          <a
            href={photo.commonsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline"
          >
            {photo.creditShort}
          </a>
          <span className="text-dust/50"> · {photo.license}</span>
        </>
      ) : (
        photo.creditShort
      )}
    </p>
  );
}
