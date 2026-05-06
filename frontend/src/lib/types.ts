export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  order: number;
  active: boolean;
}

export interface ProductImage {
  id: string;
  collectionId: string;
  fileName: string;
  thumbnails: {
    "120x120": string;
    "400x400": string;
    "800x800": string;
  };
  url: string;
}

export type StockStatus =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "made_to_order";

export interface ProductAttributes {
  [key: string]: string | number | boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  price_label: string;
  stock_status: StockStatus;
  featured: boolean;
  attributes: ProductAttributes | null;
  images: ProductImage[];
  active: boolean;
  created: string;
  updated: string;
}

export interface ProductWithCategory extends Product {
  expand: {
    category: Category;
  };
}

export const STOCK_LABELS: Record<StockStatus, string> = {
  in_stock: "Disponible",
  low_stock: "Poco stock",
  out_of_stock: "Agotado",
  made_to_order: "A pedido",
};

export const STOCK_COLORS: Record<StockStatus, string> = {
  in_stock: "bg-emerald-600",
  low_stock: "bg-amber-500",
  out_of_stock: "bg-gray-400",
  made_to_order: "bg-blue-600",
};
