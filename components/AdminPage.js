import { BasePage } from "./BasePage.js";
import { loadItems } from "../services/Items.js";
import { formatPrice } from "../services/Text.js";
import { Toast } from "../services/Toast.js";
import API from "../services/API.js";

export class AdminPage extends BasePage {
    constructor() {
        super();
        this.itemsPerPage = 10;
        this.debounceTimeout = null;
    }

    async connectedCallback() {
        const user = app.store.user;
        if (!user || user.role !== "ADMIN") {
            app.router.go("/");
            return;
        }

        await this.loadInfrastructure("/components/AdminPage.css", "admin-page-template");

        this.setupEventListeners();
        
        this.render(); 
        
        await loadItems(0, this.itemsPerPage, true, false); 
    }

    setupEventListeners() {
        const $ = (s) => this.root.querySelector(s);

        this.root.addEventListener("input", (e) => {
            if (e.target.id === "admin-search") {
                const query = e.target.value.trim();
                if (query === app.store.searchQuery) return;
                
                clearTimeout(this.debounceTimeout);
                this.debounceTimeout = setTimeout(async () => {
                    app.store.items = null;
                    app.store.searchQuery = query;
                    await loadItems(0, this.itemsPerPage, true, false);
                }, 500);
            }
        });

        $("#admin-categories")?.addEventListener("click", async (e) => {
            const btn = e.target.closest(".cat-chip");
            if (btn) {
                const newCat = btn.dataset.category || "";
                
                app.store.selectedCategory = (app.store.selectedCategory === newCat) ? "" : newCat;
                app.store.items = null;
                
                await loadItems(0, this.itemsPerPage, true, false);
            }
        });

        const form = $("#product-form");

        $(".btn-add")?.addEventListener("click", () => {
            this.openModal(); 
        });

        $("#modal-close-btn")?.addEventListener("click", () => this.closeModal());
        $("#btn-cancel")?.addEventListener("click", () => this.closeModal());

        form?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.handleSaveItem();
        });

        this.root.addEventListener("click", async (e) => {
            const btnEdit = e.target.closest(".edit");
            const btnToggle = e.target.closest(".toggle-status");

            if (e.target.id === "product-modal") {
                this.closeModal();
            }

            if (btnEdit) {
                const idStr = String(btnEdit.dataset.id);
                const item = app.store.items.find(i => String(i.id) === idStr);
                if (item) this.openModal(item);
            }

            if (btnToggle) {
                const idStr = String(btnToggle.dataset.id);
                this.handleToggleStatus(idStr);
            }

            if (e.target.closest("#btn-prev-page")) {
                const targetPage = app.store.pagination.currentPage - 1;
                app.store.items = null;
                await loadItems(targetPage, this.itemsPerPage, true, false);
            }
            if (e.target.closest("#btn-next-page")) {
                const targetPage = app.store.pagination.currentPage + 1;
                app.store.items = null;
                await loadItems(targetPage, this.itemsPerPage, true, false);
            }
        });

        this.root.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                const modal = this.root.querySelector("#product-modal");
                if (modal && !modal.hidden) {
                    this.closeModal();
                }
            }
        });

        window.addEventListener("appitemschange", () => this.render());
    }

    openModal(item = null) {
        const $ = (s) => this.root.querySelector(s);
        const modal = $("#product-modal");
        const title = $("#modal-title");
        const editIdInput = $("#edit-id");
        const submitBtn = $("#product-form button[type='submit']");

        if (!modal) return;

        submitBtn.disabled = false;
        submitBtn.textContent = "Salvar Item";

        if (item) {
            title.textContent = "Editar Item";
            editIdInput.value = item.id;
            $("#p-name").value = item.name;
            $("#p-price").value = item.price;
            $("#p-stock").value = item.stock;
            $("#p-category").value = item.category;
            $("#p-image").value = item.image;
            $("#p-desc").value = item.description;
        } else {
            title.textContent = "Novo Item";
            editIdInput.value = "";
            $("#product-form").reset();
            $("#p-image").value = ""; 
        }

        modal.hidden = false;
    }

    closeModal() {
        const modal = this.root.querySelector("#product-modal");
        if (modal) modal.hidden = true;
    }

    async handleSaveItem() {
        const $ = (s) => this.root.querySelector(s);
        const idStr = $("#edit-id").value;
        const stockVal = Number($("#p-stock").value);
        const priceVal = Number($("#p-price").value);
        const submitBtn = $("#product-form button[type='submit']");
        
        const inputImageVal = $("#p-image").value.trim();
        const finalImageVal = inputImageVal !== "" ? inputImageVal : "https://raw.githubusercontent.com/mateusfilpo/pokemart/main/images/missingno.png";

        if (priceVal <= 0) {
            Toast.show("O preço do item deve ser maior que zero.", "error");
            return;
        }

        if (stockVal < 0) {
            Toast.show("O estoque não pode ser negativo.", "error");
            return;
        }

        const itemPayload = {
            name: $("#p-name").value,
            price: priceVal,
            stock: stockVal,
            category: $("#p-category").value,
            image: finalImageVal,
            description: $("#p-desc").value,
            deleted: idStr ? (app.store.items.find(i => String(i.id) === String(idStr))?.deleted || false) : false
        };

        submitBtn.disabled = true;
        submitBtn.textContent = "Salvando...";

        try {
            if (idStr) {
                await API.updateItem(idStr, itemPayload);
                Toast.show("Item atualizado com sucesso!", "success");
            } else {
                await API.createItem(itemPayload);
                Toast.show("Item criado com sucesso!", "success");
            }

            this.closeModal();
            await loadItems(app.store.pagination.currentPage, this.itemsPerPage, true, false);

        } catch (error) {
            if (error.data) {
                if (error.data.errors && error.data.errors.length > 0) {
                    const mensagens = error.data.errors.map(e => e.message).join(" | ");
                    Toast.show(mensagens, "error");
                } else if (error.data.error) {
                    Toast.show(error.data.error, "error");
                } else {
                    Toast.show("Erro ao salvar item no banco de dados.", "error");
                }
            } else {
                Toast.show("Erro inesperado de conexão.", "error");
            }
            
            submitBtn.disabled = false;
            submitBtn.textContent = "Salvar Item";
        }
    }

   async handleToggleStatus(id) {
        const items = app.store.items || [];
        const itemIndex = items.findIndex(i => String(i.id) === String(id));

        if (itemIndex > -1) {
            const item = items[itemIndex];
            const isCurrentlyDeleted = item.deleted === true;
            const newStatus = !isCurrentlyDeleted;

            try {
                await API.toggleStatus(id, newStatus);
                
                item.deleted = newStatus;
                
                if (newStatus) {
                    Toast.show(`Venda de ${item.name} pausada.`, "info"); 
                } else {
                    Toast.show(`${item.name} reativado para venda!`, "success");
                }

                this.render();

            } catch (error) {
                if (error.data && error.data.error) {
                    Toast.show(error.data.error, "error");
                } else {
                    Toast.show("Erro ao alterar status do item.", "error");
                }
            }
        }
    }

    render() {
        if (!this.cssLoaded) return;

        if (!app.store.items) {
            this.renderSkeletons();
            return;
        }

        const items = app.store.items;
        this.updateStats();
        this.renderCategories();
        this.renderTable(items);
        this.syncUIWithStore();
    }

    syncUIWithStore() {
        const searchInput = this.root.querySelector("#admin-search");
        if (searchInput && app.store.searchQuery !== undefined) {
            const isFocused = (this.root.activeElement === searchInput) || (document.activeElement === searchInput);
            if (!isFocused && searchInput.value !== app.store.searchQuery) {
                searchInput.value = app.store.searchQuery;
            }
        }
    }

    renderSkeletons() {
        const tbody = this.root.querySelector("#inventory-list");
        if (!tbody) return;

        tbody.innerHTML = Array(this.itemsPerPage).fill(0).map(() => `
            <tr style="pointer-events: none; border-bottom: 1px solid var(--border-light);">
                <td style="padding: 12px;"><div class="skeleton" style="width: 40px; height: 40px; border-radius: 8px;"></div></td>
                <td style="padding: 12px;"><div class="skeleton" style="width: 140px; height: 16px;"></div></td>
                <td style="padding: 12px;"><div class="skeleton" style="width: 90px; height: 16px;"></div></td>
                <td style="padding: 12px;"><div class="skeleton" style="width: 60px; height: 24px; border-radius: 12px;"></div></td>
                <td style="padding: 12px;"><div class="skeleton" style="width: 30px; height: 16px;"></div></td>
                <td style="padding: 12px;"><div class="skeleton" style="width: 70px; height: 16px;"></div></td>
                <td style="padding: 12px;">
                    <div style="display: flex; gap: 8px;">
                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 6px;"></div>
                        <div class="skeleton" style="width: 32px; height: 32px; border-radius: 6px;"></div>
                    </div>
                </td>
            </tr>
        `).join("");
    }


    renderCategories() {
        const list = this.root.querySelector("#admin-categories");
        if (!list) return;

        const selected = app.store.selectedCategory ?? "";
        const totalCount = app.store.pagination.totalElements || 0;
        
        let html = `
            <button class="cat-chip ${selected === "" ? 'active' : ''}" data-category="">
                Todos <span class="count">${totalCount}</span>
            </button>
        `;

        const stats = app.store.categoryStats || [];
        html += stats.map(stat => `
            <button class="cat-chip ${selected === stat.category ? 'active' : ''}" data-category="${stat.category}">
                ${stat.category} <span class="count">${stat.count}</span>
            </button>
        `).join("");

        list.innerHTML = html;
    }

    updateStats() {        
        const totalItemsEl = this.root.querySelector("#total-items");
        const totalCatsEl = this.root.querySelector("#total-cats");

        if (totalItemsEl) totalItemsEl.textContent = app.store.pagination.totalElements || 0;
        if (totalCatsEl) totalCatsEl.textContent = (app.store.categoryStats || []).length;
    }

    renderTable(items) {
        const tbody = this.root.querySelector("#inventory-list");
        const tableContainer = this.root.querySelector(".table-container");
        if (!tbody || !tableContainer) return;

        if (items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: #6b7280;">Nenhum item encontrado.</td></tr>`;
            this.renderPaginationUI(tableContainer, 1, 1);
            return;
        }
        
        tbody.innerHTML = items.map(item => {
            const isInactive = item.deleted === true;
            const isOutOfStock = item.stock === 0;

            let stockColor = '#111827';
            if (isOutOfStock) stockColor = '#ef4444';
            else if (item.stock < 5) stockColor = '#eab308';

            return `
            <tr class="${isInactive ? 'row-deleted' : ''}">
                <td class="item-img-cell">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/images/missingno.png';">
                </td>
                <td>
                    <div class="item-name-text">${item.name}</div>
                    <div class="item-id-text" style="font-size: 10px;">ID: ${item.id}</div>
                </td>
                <td>
                    <span class="badge-cat">${item.category}</span>
                </td>
                <td>
                    <span class="badge-status ${isInactive ? 'inactive' : 'active'}">
                        ${isInactive ? 'Inativo' : 'Ativo'}
                    </span>
                </td>
                <td>
                    <span style="font-weight: 700; color: ${stockColor}">
                        ${item.stock} un.
                    </span>
                </td>
                <td class="item-price-text">₽ ${formatPrice(item.price)}</td>
                <td class="actions-cell">
                    <button class="btn-icon edit" aria-label="Editar detalhes de ${item.name}" title="Editar" data-id="${item.id}">✎</button>
                    
                    <button 
                        class="btn-icon toggle-status ${isInactive ? 'toggle-off' : 'toggle-on'}" 
                        aria-label="${isInactive ? `Reativar venda de ${item.name}` : `Pausar venda de ${item.name}`}"
                        title="${isInactive ? 'Reativar Venda' : 'Pausar Venda'}" 
                        data-id="${item.id}"
                    >
                        ${isInactive ? '✅' : '⛔'} 
                    </button>
                </td>
            </tr>
        `}).join("");

        const currentPageNumber = app.store.pagination.currentPage + 1;
        const totalPages = app.store.pagination.totalPages === 0 ? 1 : app.store.pagination.totalPages;
        
        this.renderPaginationUI(tableContainer, currentPageNumber, totalPages);
    }

    renderPaginationUI(container, current, total) {
        let pagContainer = this.root.querySelector(".admin-pagination");
        if (!pagContainer) {
            pagContainer = document.createElement("div");
            pagContainer.className = "admin-pagination";
            pagContainer.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--border-light); background: white; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;";
            container.appendChild(pagContainer);
        }

        const isPrevDisabled = current === 1;
        const isNextDisabled = current === total;

        pagContainer.innerHTML = `
            <span style="color: var(--text-muted); font-size: 14px;" aria-live="polite">Página ${current} de ${total}</span>
            <div style="display: flex; gap: 8px;">
                <button id="btn-prev-page" aria-label="Página anterior" ${isPrevDisabled ? 'disabled' : ''} style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-light); background: ${isPrevDisabled ? '#f3f4f6' : 'white'}; color: ${isPrevDisabled ? '#9ca3af' : 'var(--text-main)'}; font-weight: bold; cursor: ${isPrevDisabled ? 'not-allowed' : 'pointer'};">Anterior</button>
                <button id="btn-next-page" aria-label="Próxima página" ${isNextDisabled ? 'disabled' : ''} style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-light); background: ${isNextDisabled ? '#f3f4f6' : 'white'}; color: ${isNextDisabled ? '#9ca3af' : 'var(--text-main)'}; font-weight: bold; cursor: ${isNextDisabled ? 'not-allowed' : 'pointer'};">Próxima</button>
            </div>
        `;
    }
}

customElements.define("admin-page", AdminPage);