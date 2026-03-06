import { BasePage } from "./BasePage.js";
import {
  MAX_QTY,
  incrementCartItem,
  decrementCartItem,
  setCartItemQuantity,
  removeFromCart
} from "../services/Cart.js";
import { Toast } from "../services/Toast.js";
import { formatPrice } from "../services/Text.js";
import API from "../services/API.js";
import { loadItems } from "../services/Items.js";

export class CartPage extends BasePage {
  constructor() {
    super();
    this.onStoreChange = () => this.render();
    this.isCheckoutProcessing = false;
  }

  async connectedCallback() {
    await this.loadInfrastructure("/components/CartPage.css", "cart-page-template");

    this.setupEventListeners();
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener("appcartchange", this.onStoreChange);
    window.removeEventListener("appitemschange", this.onStoreChange);
  }

  setupEventListeners() {
    window.addEventListener("appcartchange", this.onStoreChange);
    window.addEventListener("appitemschange", this.onStoreChange);

    this.root.addEventListener("click", async (e) => {
      
      if (e.target.closest("#checkout-btn")) {
        const user = app.store.user;

        if (!user) {
            Toast.show("Você precisa estar logado para comprar!", "info");
            app.router.go("/login");
            return;
        }

        this.isCheckoutProcessing = true;
        this.render();
        
        try {
            await API.placeOrder();

            app.store.cart = [];
            app.store.searchQuery = "";
            app.store.selectedCategory = "";
            
            app.store.items = []; 
            loadItems(); 

            this.isCheckoutProcessing = false; 

            Toast.show("Pedido finalizado com sucesso!", "success");
            app.router.go("/success");

        } catch (error) {
            console.error("Falha ao processar pagamento:", error);
            
            if (error.data && error.data.error) {
                Toast.show(error.data.error, "error");
            } else {
                Toast.show("Erro ao processar compra. Tente novamente.", "error");
            }
            
            this.isCheckoutProcessing = false;
            this.render();
        }
        return;
      }

      if (e.target.closest("a[data-link]")) return;

      const row = e.target.closest(".cart-row");
      if (!row) return;

      const id = String(row.dataset.id);
      
      if (e.target.closest(".plus")) return incrementCartItem(id);
      if (e.target.closest(".minus")) return decrementCartItem(id);
      
      if (e.target.closest(".trash")) {
        const item = app.store.items.find(i => String(i.id) === id);
        const itemName = item ? item.name : "Item";
        
        removeFromCart(id);
        Toast.show(`${itemName} removido do carrinho.`, "info");
        return;
      }
    });

    this.root.addEventListener("input", (e) => {
      if (e.target.classList.contains("qty-input")) {
          e.target.value = e.target.value.replace(/\D/g, "");
      }
    });

    this.root.addEventListener("focusout", (e) => {
        if (e.target.classList.contains("qty-input")) {
            this.handleQuantityUpdate(e.target);
        }
    });
    
    this.root.addEventListener("keydown", (e) => {
      const input = e.target.closest(".qty-input");
      if (!input) return;
      
      if (e.key === "Enter") {
          e.preventDefault();
      }
      if (e.key === "Escape") {
          e.preventDefault();
          input.value = input.dataset.prev;
          input.blur();
      }
    });
  }

  handleQuantityUpdate(input) {
    const id = String(input.closest(".cart-row").dataset.id);
    let qty = parseInt(input.value);
    
    const product = app.store.items.find(i => String(i.id) === id);
    const stockLimit = product ? product.stock : MAX_QTY;
    const realMax = Math.min(stockLimit, MAX_QTY);

    if (isNaN(qty) || qty < 1) {
      qty = Number(input.dataset.prev);
    } else if (qty > realMax) {
      qty = realMax;        
    }

    if (qty !== Number(input.dataset.prev)) {
        input.value = qty;
        setCartItemQuantity(id, qty);
    } else {
      input.value = qty;
    }
  }

  render() {
    if (!this.cssLoaded) return;

    const list = this.root.querySelector("#cart-items");
    const empty = this.root.querySelector("#cart-empty");
    const checkoutBtn = this.root.querySelector("#checkout-btn");
    const summary = this.root.querySelector(".summary"); 
    
    const cart = app.store.cart ?? [];
    
    if (cart.length === 0) {
      list.innerHTML = "";
      empty.hidden = false;
      if (summary) summary.style.display = 'none'; 
      if (checkoutBtn) checkoutBtn.disabled = true;
      this.updateDisplayTotals(0);
      return;
    }

    if (!app.store.items || app.store.items === "ERROR" || app.store.items.length === 0) {
      this.renderSkeletons(cart.length, list, empty, summary, checkoutBtn);
      return;
    }

    const items = app.store.items;
    const cartItemsData = cart.map(cartEntry => {
      const product = items.find(i => String(i.id) === String(cartEntry.itemId));
      return product ? { ...product, quantity: cartEntry.quantity } : null;
    }).filter(Boolean);

    if (cartItemsData.length === 0) {
      list.innerHTML = "";
      empty.hidden = false;
      if (summary) summary.style.display = 'none'; 
      if (checkoutBtn) checkoutBtn.disabled = true;
      this.updateDisplayTotals(0);
      return;
    }

    const hasIssues = cartItemsData.some(item => 
        item.deleted || item.quantity > item.stock
    );

    empty.hidden = true;
    if (summary) summary.style.display = 'block';
    
    if (checkoutBtn) {
        if (this.isCheckoutProcessing) {
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = "Processando...";
            checkoutBtn.style.opacity = "0.5";
            checkoutBtn.style.cursor = "not-allowed";
        } else {
            checkoutBtn.disabled = hasIssues;
            checkoutBtn.title = hasIssues 
                ? "Remova os itens indisponíveis para continuar" 
                : "";
            checkoutBtn.textContent = "Finalizar Compra";
            checkoutBtn.style.opacity = hasIssues ? "0.5" : "1";
            checkoutBtn.style.cursor = hasIssues ? "not-allowed" : "pointer";
        }
    }

    list.innerHTML = cartItemsData.map(item => this.createCartRowHTML(item)).join("");
    
    const total = cartItemsData.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    this.updateDisplayTotals(total);
  }

  renderSkeletons(count, list, empty, summary, checkoutBtn) {
    empty.hidden = true;
    if (summary) summary.style.display = 'block';
    if (checkoutBtn) checkoutBtn.disabled = true;

    list.innerHTML = Array(count).fill(0).map(() => `
        <li class="cart-row skeleton-cart-item" style="display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px; border-bottom: 1px solid var(--border-light); pointer-events: none;">
            
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div class="skeleton" style="width: 50px; height: 50px; border-radius: 8px;"></div>
                <div>
                    <div class="skeleton" style="width: 120px; height: 16px; margin-bottom: 6px;"></div>
                    <div class="skeleton" style="width: 80px; height: 12px;"></div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: center; flex: 1;">
                <div class="skeleton" style="width: 90px; height: 32px; border-radius: 6px;"></div>
            </div>

            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 16px; flex: 1;">
                <div class="skeleton" style="width: 70px; height: 16px;"></div>
                <div class="skeleton" style="width: 24px; height: 24px; border-radius: 4px;"></div>
            </div>

        </li>
    `).join("");

    this.updateDisplayTotals(0);
    
    const totalEl = this.root.querySelector("#total");
    if (totalEl) totalEl.textContent = "₽ ...";
  }

  createCartRowHTML(item) {
    const lineTotal = item.price * item.quantity;
    const realLimit = Math.min(item.stock, MAX_QTY);
    
    const isDeleted = item.deleted === true; 
    const isExcess = !isDeleted && item.quantity > item.stock;

    const isUnavailable = isDeleted || isExcess;

    let warningText = "";
    if (isDeleted) {
        warningText = '<span style="color: red; font-weight: bold; font-size: 12px;">Produto Indisponível</span>';
    } else if (isExcess) {
        if (item.stock === 0) {
            warningText = '<span style="color: #ef4444; font-weight: bold; font-size: 11px;">Produto Esgotado</span>';
        } else {
            warningText = `<span style="color: #c2410c; font-weight: bold; font-size: 11px;">Apenas ${item.stock} un. disponíveis!</span>`;
        }
    } else {
        warningText = `<div class="sub">₽ ${formatPrice(item.price)} un.</div>`;
    }

    return `
      <li class="cart-row ${isUnavailable ? 'unavailable' : ''}" data-id="${item.id}" style="${isUnavailable ? 'opacity: 0.8; background: #fff1f2; border: 1px solid #fca5a5;' : ''}">
        <div class="row-left">
            <a href="/item/${item.id}" data-link class="thumb item-link">
                <img src="${item.image}" alt="${item.name}" onerror="this.onerror=null; this.src='/images/missingno.png';" style="${isUnavailable ? 'filter: grayscale(1);' : ''}">
            </a>
            <div class="meta">
                <span class="name">${item.name}</span>
                ${warningText}
            </div>
        </div>
        
        <div class="row-middle">
            ${isDeleted 
                ? '<span style="font-size: 12px; color: #999;">Indisponível</span>' 
                : `
                <div class="qty">
                    <button class="qty-btn minus" type="button" aria-label="Diminuir quantidade de ${item.name}" ${item.quantity <= 1 ? "disabled" : ""}>−</button>
                    
                    <input class="qty-input" type="text" aria-label="Quantidade de ${item.name}" value="${item.quantity}" data-prev="${item.quantity}" style="${isExcess ? 'color: red; font-weight: bold;' : ''}"/>
                    
                    <button class="qty-btn plus" type="button" aria-label="Aumentar quantidade de ${item.name}" ${item.quantity >= realLimit ? "disabled" : ""}>+</button>
                </div>
                
                <div class="stock-info" style="font-size: 10px; color: ${isExcess ? 'red' : '#6b7280'}; text-align: center; margin-top: 4px;">
                    ${item.stock === 0 ? 'Sem estoque' : `Restam: ${item.stock}`}
                </div>
                `
            }
        </div>

        <div class="row-right">
          <div class="line-total">₽ ${formatPrice(lineTotal)}</div>
          <button class="trash" type="button" aria-label="Remover ${item.name} do carrinho" title="Remover item" style="color: red;">🗑️</button>
        </div>
      </li>
    `;
  }

  updateDisplayTotals(subtotal) {
    const sub = this.root.querySelector("#subtotal");
    const tot = this.root.querySelector("#total");
    if (sub) sub.textContent = `₽ ${formatPrice(subtotal)}`;
    if (tot) tot.textContent = `₽ ${formatPrice(subtotal)}`;
  }
}

customElements.define("cart-page", CartPage);