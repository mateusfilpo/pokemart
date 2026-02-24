import { Toast } from "./Toast.js";

export const MAX_QTY = 10;

const normalizeId = (id) => {
    return id ? String(id) : null; 
};

const normalizeQty = (qty) => {
    const n = Number(qty);
    return Number.isFinite(n) ? Math.floor(n) : null;
};

export function addToCart(itemId, qty = 1) {
    const id = normalizeId(itemId);
    let q = normalizeQty(qty);
    
    if (id === null || q === null || q <= 0) return;

    const product = (app.store.items || []).find(i => String(i.id) === id);
    if (!product) {
        console.error("Tentativa de adicionar item não carregado ou inexistente.");
        return;
    }

    const cart = app.store.cart ?? [];
    const index = cart.findIndex(item => String(item.itemId) === id);

    const currentQty = index > -1 ? cart[index].quantity : 0;

    const realLimit = Math.min(product.stock, MAX_QTY);

    let finalQty = currentQty + q;

    if (finalQty > realLimit) {
        finalQty = realLimit;
        if (realLimit === MAX_QTY && product.stock >= MAX_QTY) {
            Toast.show(`Limite de ${MAX_QTY} unidades por pessoa.`, "info");
        } else {
            Toast.show(`Desculpe, só temos ${product.stock} unidades em estoque.`, "info");
        }
    }

    if (currentQty === finalQty) return;

    if (index > -1) {
        const newCart = [...cart];
        newCart[index] = { ...newCart[index], quantity: finalQty };
        app.store.cart = newCart;
    } else {
        app.store.cart = [...cart, { itemId: id, quantity: finalQty }];
    }
    
    saveCart();

    Toast.show(`${product.name} adicionado ao carrinho!`, "success");
}

export function removeFromCart(itemId) {
    const id = normalizeId(itemId);
    if (id === null) return;

    app.store.cart = (app.store.cart ?? []).filter(
        item => String(item.itemId) !== id
    );
    
    saveCart();
}

export function setCartItemQuantity(itemId, qty) {
    const id = normalizeId(itemId);
    const q = normalizeQty(qty);
    if (id === null || q === null) return;

    if (q <= 0) {
        return removeFromCart(id);
    }

    const product = (app.store.items || []).find(i => String(i.id) === id);
    if (!product) return;

    const realLimit = Math.min(product.stock, MAX_QTY);
    const finalQty = q > realLimit ? realLimit : q;

    app.store.cart = (app.store.cart ?? []).map(item =>
        String(item.itemId) === id ? { ...item, quantity: finalQty } : item
    );
    
    saveCart();
}

export const incrementCartItem = (id) => changeQty(id, 1);
export const decrementCartItem = (id) => changeQty(id, -1);

function changeQty(itemId, delta) {
    const id = normalizeId(itemId);
    const item = (app.store.cart ?? []).find(x => String(x.itemId) === id);
    if (item) {
        setCartItemQuantity(id, item.quantity + delta);
    }
}

export function getCartCount() {
    return (app.store.cart ?? []).reduce((acc, line) => acc + line.quantity, 0);
}

function saveCart() {
    localStorage.setItem("pokemart-cart", JSON.stringify(app.store.cart));
}