"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CartItem = {
  productId: number;
  name: string;
  pointsCost: number;
  imageUrl: string | null;
  quantity: number;
  inventoryLimit: number | null;
  inventoryAvailable: number | null;
};

type CartContextType = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
};

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "student-rewards-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  function addItem(item: CartItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      const maxQty = item.inventoryLimit !== null ? item.inventoryAvailable ?? 0 : Infinity;
      if (existing) {
        const newQty = Math.min(existing.quantity + item.quantity, maxQty);
        return prev.map((i) => (i.productId === item.productId ? { ...i, quantity: newQty } : i));
      }
      return [...prev, { ...item, quantity: Math.min(item.quantity, maxQty) }];
    });
  }

  function removeItem(productId: number) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function setQuantity(productId: number, quantity: number) {
    setItems((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, quantity } : i))
        .filter((i) => i.quantity > 0)
    );
  }

  function clear() {
    setItems([]);
  }

  const total = items.reduce((sum, i) => sum + i.pointsCost * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, setQuantity, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
