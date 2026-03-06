import { BasePage } from "./BasePage.js";
import { MAX_QTY } from "../services/Cart.js";
import { loadItems } from "../services/Items.js";
import { addToCart } from "../services/Cart.js";
import { formatPrice } from "../services/Text.js";

export class ItemsPage extends BasePage {
    constructor() {
       super();
       this.pageSize = 9;
    }

    async connectedCallback() {
        await this.loadInfrastructure("/components/ItemsPage.css", "items-page-template");

        this.setupEventListeners();
        
        this.render();
        
        await loadItems(0, this.pageSize, true, false); 
    }

    setupEventListeners() {
        let searchTimeout;

        this.root.addEventListener("input", (e) => {
            if (e.target.id === "search-input") {
                const query = e.target.value;
                
                if (query === app.store.searchQuery) return;
                
                clearTimeout(searchTimeout);
                
                searchTimeout = setTimeout(async () => {
                    app.store.items = null; 
                    app.store.searchQuery = query;
                    await loadItems(0, this.pageSize, true, false);
                }, 500);
            }
        });

        this.root.addEventListener("change", (e) => {
            if (e.target.id === "sort-select") {
                app.store.items = null;
                app.store.sortBy = e.target.value;
                loadItems(0, this.pageSize, true, false);
            }
        });

        this.root.addEventListener("click", async (e) => {
            const addBtn = e.target.closest(".add-button");
            if (addBtn) {
                e.preventDefault(); 
                e.stopPropagation();
                addToCart(addBtn.dataset.id);
                return;
            }

            const catBtn = e.target.closest(".cat");
            if (catBtn) {
                const targetCat = catBtn.dataset.category ?? "";
                app.store.selectedCategory = app.store.selectedCategory === targetCat ? "" : targetCat;
                
                
                app.store.items = null;
                
                await loadItems(0, this.pageSize, true, false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (e.target.id === "load-more-btn") {
                const nextPage = app.store.pagination.currentPage + 1;
                const btn = e.target;
                btn.disabled = true;
                btn.textContent = "Buscando...";
                
                await loadItems(nextPage, this.pageSize, false, true);
            }
        });

        window.addEventListener("appitemschange", () => this.render());
        window.addEventListener("appcartchange", () => this.render());
    }

    render() {
        if (!this.cssLoaded || !this.root.querySelector("#items-grid")) return;

        if (app.store.items === "ERROR") {
            this.renderErrorState();
            return;
        }
        
        if (!app.store.items) {
            this.renderSkeletons();
            return;
        }

        if (app.store.items.length === 0) {
            this.renderEmptyState();
            this.renderCategories(); 
            this.syncUIWithStore();
            return;
        }

        this.renderCategories();
        this.renderFilteredItems();
        this.syncUIWithStore(); 
    }

    syncUIWithStore() {
        const searchInput = this.root.querySelector("#search-input");
        const sortSelect = this.root.querySelector("#sort-select");

        if (searchInput && app.store.searchQuery !== undefined) {
            const isFocused = (this.root.activeElement === searchInput) || (document.activeElement === searchInput);
            
            if (!isFocused && searchInput.value !== app.store.searchQuery) {
                searchInput.value = app.store.searchQuery;
            }
        }

        if (sortSelect && app.store.sortBy !== undefined) {
            if (sortSelect.value !== app.store.sortBy) {
                sortSelect.value = app.store.sortBy;
            }
        }
    }

    renderErrorState() {
        const grid = this.root.querySelector("#items-grid");
        if (!grid) return;

        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h3 style="font-family: var(--font-pixel); font-size: 12px; color: #ef4444;">Erro na PokéMart!</h3>
                <p style="color: var(--text-muted); margin: 15px 0;">Não conseguimos conectar ao Centro Pokémon. Verifique sua conexão.</p>
                <button id="retry-btn" style="background: var(--primary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold;">Tentar Novamente</button>
            </div>
        `;

        this.root.querySelector("#retry-btn")?.addEventListener("click", () => {
            location.reload();
        });
    }

    renderSkeletons() {
        const grid = this.root.querySelector("#items-grid");
        if (!grid) return;

        const skeletons = Array(this.pageSize).fill(0).map(() => `
            <div class="skeleton-card">
                <div class="skeleton-img skeleton"></div>
                <div class="skeleton-info">
                    <div class="skeleton-title skeleton"></div>
                    <div class="skeleton-line skeleton"></div>
                    <div class="skeleton-line skeleton short"></div>
                    <div class="skeleton-footer">
                        <div class="skeleton-price skeleton"></div>
                        <div class="skeleton-btn skeleton"></div>
                    </div>
                </div>
            </div>
        `).join("");

        grid.innerHTML = skeletons;
    }

    renderEmptyState() {
        const grid = this.root.querySelector("#items-grid");
        const loadMoreContainer = this.root.querySelector("#load-more-container");
        
        if (grid) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Nenhum item disponível no momento.</p>`;
        }
        if (loadMoreContainer) {
            loadMoreContainer.innerHTML = "";
        }
    }

    renderCategories() {
        const list = this.root.querySelector("#categories-list");
        if (!list) return;

        const selected = app.store.selectedCategory ?? "";
        this.updateTitle(selected);

        const stats = app.store.categoryStats || [];
        
        let totalCount = 0;
        if (stats.length > 0) {
            totalCount = stats.reduce((soma, stat) => soma + stat.count, 0);
        } else {
            totalCount = app.store.pagination.totalElements || 0;
        }

        let html = this.createCategoryItemHTML("", "Todos", totalCount, selected === "");
        
        html += stats
            .map(stat => this.createCategoryItemHTML(stat.category, stat.category, stat.count, selected === stat.category))
            .join("");

        list.innerHTML = html;
    }

    renderFilteredItems() {
        const grid = this.root.querySelector("#items-grid");
        const loadMoreContainer = this.root.querySelector("#load-more-container");
        if (!grid) return;

        const itemsToRender = app.store.items ?? [];

        grid.innerHTML = itemsToRender.map(item => this.createItemCardHTML(item)).join("");
        
        if (loadMoreContainer) {
            const hasNext = app.store.pagination && app.store.pagination.hasNext;
            loadMoreContainer.innerHTML = hasNext 
                ? `<button id="load-more-btn">Carregar Mais</button>` 
                : "";
        }
    }

    createCategoryItemHTML(id, label, count, isActive) {
        return `
            <li>
                <button class="cat ${isActive ? 'active' : ''}" data-category="${id}">
                    <span>${label}</span>
                    <span class="count">${count}</span>
                </button>
            </li>`;
    }

    createItemCardHTML(item) {
        const cartEntry = (app.store.cart ?? []).find(ci => String(ci.itemId) === String(item.id));
        const currentQty = cartEntry ? cartEntry.quantity : 0;
        
        const isSoldOut = item.stock === 0;
        const isStockLimitReached = currentQty >= item.stock;
        const isMaxQtyReached = currentQty >= MAX_QTY;
        const isDisabled = isSoldOut || isStockLimitReached || isMaxQtyReached;

        let btnText = "Adicionar";
        if (isSoldOut) btnText = "Esgotado";
        else if (isStockLimitReached) btnText = "Limite";
        else if (isMaxQtyReached) btnText = "Limite";

        return `
            <a class="item-link" href="/item/${item.id}" data-link>
                <article class="item-card">
                    <div class="item-icon">
                        <img src="${item.image}" alt="${item.name}" loading="lazy" style="${isSoldOut ? 'filter: grayscale(1); opacity: 0.6;' : ''}" onerror="this.onerror=null; this.src='/images/missingno.png';">
                    </div>
                    <div class="item-info">
                        <div class="item-name">${item.name}</div>
                        <div class="item-desc">${item.description}</div>
                        <div class="item-bottom">
                            <div class="item-price">₽ ${formatPrice(item.price)}</div>
                            <button class="add-button" data-id="${item.id}" ${isDisabled ? `disabled` : ''}>
                                ${btnText}
                            </button>
                        </div>
                    </div>
                </article>
            </a>`;
    }

    updateTitle(category) {
        const title = this.root.querySelector("#products-title");
        if (title) title.textContent = category || "Todos os itens";
    }
}

customElements.define("items-page", ItemsPage);