export type ProductType = {
    id: number;
    name: string;
    brand: string;
    categories: string[];
    color: string;
    currentStock: number;
    reorderPoint: number;
    minimum: number;
    price: number;
    discountPercentage: number;
    description: string;
    url_img: string;
    sizes: string[];
};

export type Color = { hue: number; sat: number; light: number };

export type ColorsType = {
    primary: Color;
    secondary: Color;
};

export type StoreType = {
    name: string;
    colors: ColorsType;
    products: ProductType[];
};

export type setFilterType = ({ type, size }: { type?: string; size?: string }) => void;

export type LoaderResponse<T> = {
    data: T;
    message: string;
    error: boolean;
};

export type StoreName = {
    id: string;
    name: string;
};
