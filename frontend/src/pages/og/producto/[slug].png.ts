import type { APIRoute } from "astro";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { getProductBySlug } from "../../../lib/pocketbase";

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
const SURFACE = "#f3f0eb";
const WHITE = "#ffffff";

function buildMarkup(opts: {
  productName: string;
  categoryLabel: string | null;
  priceLabel: string;
  productImage: string | null;
}): unknown {
  const { productName, categoryLabel, priceLabel, productImage } = opts;

  return {
    type: "div",
    props: {
      style: {
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "row",
        background: BRAND,
        padding: 60,
        fontFamily: "DM Sans",
        position: "relative",
      },
      children: [
        // Capa decorativa: blob accent en esquina inferior izquierda
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              bottom: -200,
              left: -150,
              width: 500,
              height: 500,
              borderRadius: 999,
              background: ACCENT,
              opacity: 0.18,
              filter: "blur(80px)",
              display: "flex",
            },
          },
        },
        // Columna izquierda: texto
        {
          type: "div",
          props: {
            style: {
              flex: 1,
              display: "flex",
              flexDirection: "column",
              color: WHITE,
              paddingRight: 40,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 20,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 4,
                    color: ACCENT,
                    display: "flex",
                  },
                  children: "Print All · Aguilares, Tuc",
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    fontFamily: "Archivo Black",
                    fontSize: 76,
                    lineHeight: 1.02,
                    marginTop: 28,
                    letterSpacing: -2,
                    display: "flex",
                  },
                  children: productName,
                },
              },
              categoryLabel
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 26,
                        color: "rgba(255,255,255,0.55)",
                        marginTop: 22,
                        display: "flex",
                      },
                      children: categoryLabel,
                    },
                  }
                : null,
              { type: "div", props: { style: { flexGrow: 1, display: "flex" } } },
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          fontFamily: "Archivo Black",
                          fontSize: 60,
                          color: WHITE,
                          display: "flex",
                        },
                        children: priceLabel,
                      },
                    },
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 20,
                          color: "rgba(255,255,255,0.45)",
                          marginTop: 10,
                          display: "flex",
                        },
                        children: "printall.jmlabs.app",
                      },
                    },
                  ],
                },
              },
            ].filter(Boolean),
          },
        },
        // Columna derecha: imagen (o placeholder)
        {
          type: "div",
          props: {
            style: {
              width: 510,
              height: 510,
              borderRadius: 32,
              overflow: "hidden",
              background: SURFACE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              border: "4px solid rgba(255,255,255,0.08)",
            },
            children: productImage
              ? {
                  type: "img",
                  props: {
                    src: productImage,
                    width: 510,
                    height: 510,
                    style: { objectFit: "cover", display: "flex" },
                  },
                }
              : {
                  type: "div",
                  props: {
                    style: {
                      fontSize: 120,
                      color: "rgba(31,31,43,0.3)",
                      display: "flex",
                    },
                    children: "📦",
                  },
                },
          },
        },
      ],
    },
  };
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug;
  if (!slug) return new Response("Not found", { status: 404 });

  const product = await getProductBySlug(slug);
  if (!product) return new Response("Not found", { status: 404 });

  const category = product.expand?.category;
  const productImage = product.images?.[0]?.thumbnails?.["800x800"] ?? null;
  const priceLabel =
    product.price > 0
      ? `$${product.price.toLocaleString("es-AR")}`
      : "Consultar";
  const categoryLabel = category
    ? `${category.icon ?? ""} ${category.name}`.trim()
    : null;

  const markup = buildMarkup({
    productName: product.name,
    categoryLabel,
    priceLabel,
    productImage,
  });

  const fonts = await loadFonts();

  try {
    const svg = await satori(markup as never, {
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
    console.error("[og:producto] failed to render:", err);
    return new Response("OG render failed", { status: 500 });
  }
};
