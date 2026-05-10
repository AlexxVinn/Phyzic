"use client";

import { initials } from "@/lib/utils";

interface AvatarProps {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}

export default function Avatar({ url, name, size = 32, className = "" }: AvatarProps) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
    background: "var(--surface-3)",
    flexShrink: 0,
  };
  const fallbackStyle: React.CSSProperties = {
    ...style,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "var(--text-muted)",
    fontSize: size * 0.4,
  };

  if (url) {
    return (
      <span className={className} style={{ display: "inline-flex", flexShrink: 0 }}>
        <img
          src={url}
          alt=""
          style={{ ...style, display: "block" }}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.display = "none";
            const next = el.nextElementSibling as HTMLElement | null;
            if (next) next.style.display = "flex";
          }}
        />
        <span style={{ ...fallbackStyle, display: "none" }}>{initials(name)}</span>
      </span>
    );
  }

  return (
    <span className={className} style={fallbackStyle}>
      {initials(name)}
    </span>
  );
}
