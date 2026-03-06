import { BasePage } from "./BasePage.js";
import { MAX_QTY } from "../services/Cart.js";
import { getItemById } from "../services/Items.js";
import { addToCart } from "../services/Cart.js";
import { formatPrice } from "../services/Text.js";

export class ItemDetailsPage extends BasePage {
  constructor() {
    super();
    this.onCartChange = () => {
        const id = this.dataset.itemId;
        if (id) {
            getItemById(id).then(item => {
                if (item) this.renderItemData(item);
            });
        }
    };
  }

  async connectedCallback() {
    await this.loadInfrastructure("/components/ItemDetailsPage.css", "item-details-page-template");

    this.renderSkeleton();

    try {
      const id = this.dataset.itemId;
      const item = id ? await getItemById(id) : null;

      if (item) {
          this.renderItemData(item);
      } else {
          this.renderNotFound();
      }
      
      window.addEventListener("appcartchange", this.onCartChange);
    } catch (error) {
      console.error("Erro na página de detalhes:", error);
      
      if (error.data && error.data.error) {
          this.renderError(error.data.error);
      } else {
          this.renderError("Ocorreu um erro ao carregar o item. Tente novamente.");
      }
    }
  }

  disconnectedCallback() {
    window.removeEventListener("appcartchange", this.onCartChange);
  }

  renderSkeleton() {
    const card = this.root.querySelector(".card");
    if (card) {
        card.classList.add("skeleton-card");
        
        this.originalCardContent = card.innerHTML; 
        
        card.innerHTML = `
            <div class="skeleton-icon skeleton"></div>
            <div class="skeleton-name skeleton"></div>
            <div class="skeleton-text skeleton"></div>
            <div class="skeleton-text skeleton" style="width: 200px"></div>
            <div class="skeleton-footer">
                <div class="skeleton-price skeleton"></div>
                <div class="skeleton-button skeleton"></div>
            </div>
        `;
    }
  }

  renderItemData(item) {
    const $ = (selector) => this.root.querySelector(selector);
    const card = $(".card");
    
    const updateButtonState = () => {
        const cartEntry = (app.store.cart ?? []).find(ci => String(ci.itemId) === String(item.id));
        const currentQty = cartEntry ? cartEntry.quantity : 0;
        
        const isSoldOut = item.stock === 0;
        const isStockLimitReached = currentQty >= item.stock;
        const isMaxQtyReached = currentQty >= MAX_QTY;
        
        const addBtn = $("#add-btn");
        
        if (addBtn) {
            addBtn.disabled = isSoldOut || isStockLimitReached || isMaxQtyReached;

            if (isSoldOut) {
                addBtn.textContent = "Esgotado";
                addBtn.title = "Este item não está mais disponível";
                $("#item-image").style.filter = "grayscale(1)";
            } else if (isStockLimitReached) {
                addBtn.textContent = "Estoque Máx.";
                addBtn.title = `Você já pegou todo o estoque disponível (${item.stock})`;
            } else if (isMaxQtyReached) {
                addBtn.textContent = "Limite Atingido";
                addBtn.title = `Limite de ${MAX_QTY} unidades por treinador`;
            } else {
                addBtn.textContent = "Adicionar";
                addBtn.title = "";
                $("#item-image").style.filter = "none";
            }
        }
        
        const priceEl = $("#item-price");
        if (priceEl && !isSoldOut) {
             const stockMsg = item.stock < 5 ? ` <span style="font-size: 0.8em; color: #eab308">(${item.stock} rest.)</span>` : '';
             priceEl.innerHTML = `₽ ${formatPrice(item.price)}${stockMsg}`;
        }
    };

    if (card && card.classList.contains("skeleton-card") && this.originalCardContent) {
        card.innerHTML = this.originalCardContent;
        card.classList.remove("skeleton-card");
        
        $("#add-btn").onclick = (e) => {
            e.stopPropagation();
            if (item.stock > 0) {
                addToCart(item.id); 
            }
        };

        $(".back-link").onclick = (e) => {
            e.preventDefault();
            if (document.referrer.includes(window.location.host) || history.length > 1) {
                history.back();
            } else {
                window.app.router.go("/");
            }
        };
    }
    
    $("#item-image").src = item.image;
    $("#item-image").alt = item.name;
    $("#item-image").onerror = function() {
        this.onerror = null;
        this.src = '/images/missingno.png';
    };
    $("#item-name").textContent = item.name;
    $("#item-desc").textContent = item.description;
    $("#item-price").textContent = `₽ ${formatPrice(item.price)}`;

    updateButtonState();
  }

  renderNotFound() {
      const container = this.root.querySelector(".details") || this.root;
      container.innerHTML = `
          <div class="error-msg">
              <p>Item não encontrado no banco de dados do PokéMart.</p>
              <a href="/" data-link>Voltar para a loja</a>
          </div>
      `;
  }

  renderError(msg) {
      const container = this.root.querySelector(".details") || this.root;
      container.innerHTML = `
          <div class="error-msg">
              <p>${msg}</p>
              <a href="/" data-link style="margin-top: 15px; display: inline-block;">Voltar para a loja</a>
          </div>
      `;
  }
}

customElements.define("item-details-page", ItemDetailsPage);