import { CartProvider } from "@/components/CartContext";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
