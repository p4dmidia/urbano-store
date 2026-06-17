
export interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  badge?: string;
  isHot?: boolean;
}

export interface NavItem {
  label: string;
  href: string;
}
