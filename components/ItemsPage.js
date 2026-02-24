import { BasePage } from "./BasePage.js";
import { MAX_QTY } from "../services/Cart.js";
import { loadItems } from "../services/Items.js";
import { addToCart } from "../services/Cart.js";
import { normalizeText, formatPrice } from "../services/Text.js";

export class ItemsPage extends BasePage {
    constructor() {
       super();
       this.limit = 9;
    }

    async connectedCallback() {
        await this.loadInfrastructure("/components/ItemsPage.css", "items-page-template");

        this.setupEventListeners();
        loadItems(); 
        
        this.render();
    }

    setupEventListeners() {
        this.root.querySelector("#search-input")?.addEventListener("input", (e) => {
            app.store.searchQuery = e.target.value.trim().toLowerCase();
            this.limit = 9;
            this.renderFilteredItems();
        });

        this.root.querySelector("#sort-select")?.addEventListener("change", (e) => {
            app.store.sortBy = e.target.value;
            this.renderFilteredItems();
        });

        this.root.addEventListener("click", (e) => {
            const addBtn = e.target.closest(".add-button");
            if (addBtn) {
                e.preventDefault(); 
                e.stopPropagation();
                addToCart(addBtn.dataset.id);
                return;
            }

            const catBtn = e.target.closest(".cat");
            if (catBtn) {
                app.store.selectedCategory = catBtn.dataset.category ?? "";
                app.store.searchQuery = "";
                const search = this.root.querySelector("#search-input");
                if (search) search.value = "";
                this.limit = 9;
                this.render();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (e.target.id === "load-more-btn") {
                this.limit += 9;
                this.renderFilteredItems();
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
            return;
        }

        this.renderCategories();
        this.renderFilteredItems();
    }

    renderErrorState() {
        const grid = this.root.querySelector("#items-grid");
        if (!grid) return;

        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <h3 style="font-family: var(--font-pixel); font-size: 12px; color: #ef4444;">
                    Erro na PokéMart!
                </h3>
                <p style="color: var(--text-muted); margin: 15px 0;">
                    Não conseguimos conectar ao Centro Pokémon. Verifique sua conexão.
                </p>
                <button id="retry-btn" style="
                    background: var(--primary); 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-weight: bold;
                ">Tentar Novamente</button>
            </div>
        `;

        this.root.querySelector("#retry-btn")?.addEventListener("click", () => {
            location.reload();
        });
    }

    renderSkeletons() {
        const grid = this.root.querySelector("#items-grid");
        if (!grid) return;

        const skeletons = Array(this.limit).fill(0).map(() => `
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
        if (grid) {
            grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
                Nenhum item disponível no momento.
            </p>`;
        }
    }

    renderCategories() {
        const list = this.root.querySelector("#categories-list");
        if (!list) return;

        const items = app.store.items ?? [];
        const categoryCounts = items.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
        }, {});

        const selected = app.store.selectedCategory ?? "";
        this.updateTitle(selected);

        let html = this.createCategoryItemHTML("", "Todos", items.length, selected === "");
        html += Object.entries(categoryCounts)
            .map(([name, count]) => this.createCategoryItemHTML(name, name, count, selected === name))
            .join("");

        list.innerHTML = html;
    }

    renderFilteredItems() {
        const grid = this.root.querySelector("#items-grid");
        const loadMoreContainer = this.root.querySelector("#load-more-container");
        if (!grid) return;

        let filtered = this.applyFilters(app.store.items ?? []);
        this.applySorting(filtered);

        const totalFiltered = filtered.length;
        const itemsToShow = filtered.slice(0, this.limit);

        grid.innerHTML = itemsToShow.map(item => this.createItemCardHTML(item)).join("");
        
        if (loadMoreContainer) {
            loadMoreContainer.innerHTML = (this.limit < totalFiltered) 
                ? `<button id="load-more-btn">Carregar Mais</button>` 
                : "";
        }
    }

    applyFilters(items) {
        const activeItems = items.filter(i => !i.deleted);
        const category = app.store.selectedCategory;
        const query = app.store.searchQuery;

        let result = category ? activeItems.filter(i => i.category === category) : [...activeItems];

        if (query) {
            const normalizedQuery = normalizeText(query);
            result = result.filter(i => 
                normalizeText(i.name).includes(normalizedQuery) || 
                normalizeText(i.description).includes(normalizedQuery)
            );
        }
        return result;
    }

    applySorting(items) {
        const sort = app.store.sortBy;
        const strategy = {
            "price-asc": (a, b) => a.price - b.price,
            "price-desc": (a, b) => b.price - a.price,
            "name-asc": (a, b) => a.name.localeCompare(b.name),
            "name-desc": (a, b) => b.name.localeCompare(a.name)
        };
        if (strategy[sort]) items.sort(strategy[sort]);
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
                        <img src="${item.image}" alt="${item.name}" loading="lazy" style="${isSoldOut ? 'filter: grayscale(1); opacity: 0.6;' : ''}">
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