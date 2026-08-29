type LyricCardProps = {
  art: string | null;
  lines: string[];
  title: string;
  artist: string;
  size: "s" | "m" | "l";
};

const FONT: Record<LyricCardProps["size"], number> = { s: 20, m: 26, l: 32 };

export function LyricCard({ art, lines, title, artist, size }: LyricCardProps) {
  return (
    <div className="genius-card">
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="genius-card-art" src={art} alt="" />
      ) : (
        <div className="genius-card-art fallback" />
      )}
      <div className="genius-card-shade" />
      <div className="genius-card-body">
        <div className="genius-card-lyrics" style={{ fontSize: FONT[size] }}>
          {lines.map((line, index) => (
            <p key={`${index}-${line}`}>{line}</p>
          ))}
        </div>
        <div className="genius-card-meta">
          <div className="genius-card-title">{title}</div>
          <div className="genius-card-artist">{artist}</div>
        </div>
      </div>
    </div>
  );
}
