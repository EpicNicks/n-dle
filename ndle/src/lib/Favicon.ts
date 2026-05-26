const COLORS = ["#538d4e", "#b59f3b", "#3a3a3c"] as const;

function makeFaviconSvg(bg: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" rx="12" fill="${bg}"/>
    <text x="50" y="73" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
      font-size="62" font-weight="900" fill="white">N</text>
  </svg>`;
}

export function setRandomFavicon() {
  const bg = COLORS[Math.floor(Math.random() * COLORS.length)];
  const svg = makeFaviconSvg(bg);
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;

  const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  const link = existing ?? document.createElement("link");
  link.rel = "icon";
  link.href = url;
  if (!existing) document.head.appendChild(link);
}
