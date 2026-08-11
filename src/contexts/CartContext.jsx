import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [saleId, setSaleId] = useState(null);
  const [saleLocalId, setSaleLocalId] = useState(null);
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);
  // Maps product_id -> custom_price for the selected corporate customer.
  // Empty for walk-in/individual customers, so standard pricing applies.
  const [corporatePricing, setCorporatePricing] = useState({});
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [subtotal, setSubtotal] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [total, setTotal] = useState(0);

  // Recalculate totals whenever items or discount change.
  useEffect(() => {
    const newSubtotal = items.reduce(
      (sum, item) => sum + (item.line_total || 0),
      0,
    );
    const newTotal = Math.max(0, newSubtotal - discountAmount);
    setSubtotal(newSubtotal);
    setTotal(newTotal);
  }, [items, discountAmount]);

  const addItem = (item) => {
    setItems((prev) => [...prev, item]);
  };

  const updateItem = (itemId, quantity) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              line_total: parseFloat((quantity * item.unit_price).toFixed(2)),
            }
          : item,
      ),
    );
  };

  const removeItem = (itemId) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const applyDiscount = (amount) => {
    setDiscountAmount((prev) => Math.min(parseFloat(prev || 0) + amount, subtotal));
  };

  const resetCart = () => {
    setSaleId(null);
    setSaleLocalId(null);
    setItems([]);
    setCustomer(null);
    setCorporatePricing({});
    setPaymentMethod("cash");
    setSubtotal(0);
    setDiscountAmount(0);
    setTotal(0);
  };

  return (
    <CartContext.Provider
      value={{
        saleId,
        setSaleId,
        saleLocalId,
        setSaleLocalId,
        items,
        setItems,
        customer,
        setCustomer,
        corporatePricing,
        setCorporatePricing,
        paymentMethod,
        setPaymentMethod,
        subtotal,
        discountAmount,
        setDiscountAmount,
        total,
        addItem,
        updateItem,
        removeItem,
        applyDiscount,
        resetCart,
      }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
