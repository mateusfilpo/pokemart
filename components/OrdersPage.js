import { BasePage } from "./BasePage.js";
import { formatPrice } from "../services/Text.js";
import API from "../services/API.js";

export class OrdersPage extends BasePage {
    constructor() {
        super();
        this.orders = [];
        this.errorMsg = null;
    }

    async connectedCallback() {
        const user = app.store.user;
        
        if (!user) {
            app.router.go("/login");
            return;
        }

        await this.loadInfrastructure("/components/OrdersPage.css", "orders-page-template");

        try {
            this.renderSkeletons(3); 
            
            this.orders = await API.getUserOrders(user.id);

            this.setupEventListeners();
            this.render();

        } catch (error) {
            console.error("Erro ao processar OrdersPage:", error);
            
            if (error.data && error.data.error) {
                this.errorMsg = error.data.error;
            } else {
                this.errorMsg = "Não foi possível carregar o teu histórico de pedidos.";
            }
            
            this.render();
        }
    }

    renderSkeletons(count) {
        const listContainer = this.root.querySelector("#orders-list");
        const emptyContainer = this.root.querySelector("#orders-empty");

        if (!listContainer || !emptyContainer) return;

        listContainer.hidden = false;
        emptyContainer.hidden = true;

        const skeletonsToShow = Math.min(count, 3);

        listContainer.innerHTML = Array(skeletonsToShow).fill(0).map(() => `
            <article class="order-card" style="border: 1px solid var(--border-light); border-radius: 12px; margin-bottom: 24px; background: white; pointer-events: none;">
                <header style="padding: 16px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="skeleton" style="width: 100px; height: 16px; margin-bottom: 6px;"></div>
                        <div class="skeleton" style="width: 70px; height: 12px;"></div>
                    </div>
                    <div class="skeleton" style="width: 80px; height: 28px; border-radius: 16px;"></div>
                </header>
                
                <div style="padding: 20px;">
                    <div style="display: flex; gap: 12px;">
                        <div class="skeleton" style="width: 48px; height: 48px; border-radius: 8px;"></div>
                        <div class="skeleton" style="width: 48px; height: 48px; border-radius: 8px;"></div>
                    </div>
                </div>

                <footer style="padding: 16px 20px; background: #f9fafb; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light);">
                    <div class="skeleton" style="width: 80px; height: 14px;"></div>
                    <div class="skeleton" style="width: 90px; height: 20px;"></div>
                </footer>
            </article>
        `).join("");
    }

    setupEventListeners() {
        this.root.addEventListener("click", (e) => {
            const link = e.target.closest("a[data-link]");
            if (link) {
                e.preventDefault();
                app.router.go(link.getAttribute("href"));
            }
        });
    }

    render() {
        if (!this.cssLoaded) return;

        const listContainer = this.root.querySelector("#orders-list");
        const emptyContainer = this.root.querySelector("#orders-empty");

        if (!listContainer || !emptyContainer) return;

        listContainer.innerHTML = "";

        if (this.errorMsg) {
            listContainer.hidden = true;
            emptyContainer.hidden = false;
            emptyContainer.innerHTML = `
                <div style="text-align: center; color: #ef4444; padding: 40px;">
                    <h3>Ops! Ocorreu um problema.</h3>
                    <p>${this.errorMsg}</p>
                    <a href="/" data-link style="display: inline-block; margin-top: 15px;">Voltar à Loja</a>
                </div>
            `;
            return;
        }

        if (!this.orders || this.orders.length === 0) {
            listContainer.hidden = true;
            emptyContainer.hidden = false;
            return;
        }

        listContainer.hidden = false;
        emptyContainer.hidden = true;

        const reversedOrders = [...this.orders].reverse();
        listContainer.innerHTML = reversedOrders.map(order => this.createOrderCardHTML(order)).join("");
    }

    createOrderCardHTML(order) {
        const orderDate = new Date(order.createdAt).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const itemsHtml = order.items.map(item => {
            const product = (app.store.items || []).find(i => String(i.id) === String(item.productId));
            const imageUrl = product ? product.image : "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"; // fallback

            return `
            <div class="order-item">
                <img src="${imageUrl}" alt="${item.name}" loading="lazy" onerror="this.onerror=null; this.src='/images/missingno.png';">
                <div class="item-meta">
                    <span class="item-name">${item.quantity}x ${item.name}</span>
                    <span class="item-price">₽ ${formatPrice(item.price)} un.</span>
                </div>
            </div>
            `;
        }).join("");

        return `
            <article class="order-card" aria-label="Pedido">
                <header class="card-header">
                    <div class="header-info">
                        <span class="order-id">Pedido efetuado em:</span>
                        <span class="order-date">${orderDate}</span>
                    </div>
                    <div class="order-status">Concluído</div>
                </header>
                
                <div class="card-body">
                    <div class="items-grid">
                        ${itemsHtml}
                    </div>
                </div>

                <footer class="card-footer">
                    <span class="footer-label">Total Pago:</span>
                    <span class="footer-total">₽ ${formatPrice(order.totalAmount)}</span> 
                </footer>
            </article>
        `;
    }
}

customElements.define("orders-page", OrdersPage);