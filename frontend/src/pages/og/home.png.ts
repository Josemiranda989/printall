import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);

type FontConfig = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
};

let fontsCache: FontConfig[] | null = null;

async function loadFonts(): Promise<FontConfig[]> {
  if (fontsCache) return fontsCache;
  const [archivoBlack, dmSansRegular, dmSansBold] = await Promise.all([
    readFile(
      require.resolve(
        "@fontsource/archivo-black/files/archivo-black-latin-400-normal.woff",
      ),
    ),
    readFile(
      require.resolve(
        "@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff",
      ),
    ),
    readFile(
      require.resolve(
        "@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff",
      ),
    ),
  ]);
  fontsCache = [
    { name: "Archivo Black", data: archivoBlack, weight: 400, style: "normal" },
    { name: "DM Sans", data: dmSansRegular, weight: 400, style: "normal" },
    { name: "DM Sans", data: dmSansBold, weight: 700, style: "normal" },
  ];
  return fontsCache;
}

const BRAND = "#1f1f2b";
const ACCENT = "#ea580c";
const WHITE = "#ffffff";

function buildMarkup(): unknown {
  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        background: BRAND,
        padding: 80,
        fontFamily: "DM Sans",
        position: "relative",
      },
      children: [
        // Blob accent superior derecha
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              top: -180,
              right: -120,
              width: 480,
              height: 480,
              borderRadius: 999,
              background: ACCENT,
              opacity: 0.22,
              filter: "blur(80px)",
              display: "flex",
            },
          },
        },
        // Blob accent inferior izquierda
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: -160,
              left: -120,
              width: 380,
              height: 380,
              borderRadius: 999,
              background: ACCENT,
              opacity: 0.14,
              filter: "blur(80px)",
              display: "flex",
            },
          },
        },
        // Eyebrow
        {
          type: "div",
          props: {
            style: {
              fontSize: 22,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 5,
              color: ACCENT,
              display: "flex",
            },
            children: "Print All · Impresión 3D",
          },
        },
        // Headline
        {
          type: "div",
          props: {
            style: {
              fontFamily: "Archivo Black",
              fontSize: 110,
              lineHeight: 0.95,
              marginTop: 32,
              letterSpacing: -3,
              color: WHITE,
              display: "flex",
              flexDirection: "column",
            },
            children: [
              { type: "div", props: { style: { display: "flex" }, children: "Todo lo que" } },
              { type: "div", props: { style: { display: "flex", color: ACCENT }, children: "imaginás," } },
              { type: "div", props: { style: { display: "flex" }, children: "lo imprimimos." } },
            ],
          },
        },
        // Footer line
        {
          type: "div",
          props: {
            style: {
              marginTop: 40,
              fontSize: 24,
              color: "rgba(255,255,255,0.55)",
              display: "flex",
            },
            children: "Aguilares, Tucumán · printall.jmlabs.app",
          },
        },
      ],
    },
  };
}

export const GET: APIRoute = async () => {
  const fonts = await loadFonts();

  try {
    const svg = await satori(buildMarkup() as never, {
      width: 1200,
      height: 630,
      fonts,
    });

    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
    })
      .render()
      .asPng();

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=2592000",
      },
    });
  } catch (err) {
    console.error("[og:home] failed to render:", err);
    return new Response("OG render failed", { status: 500 });
  }
};
