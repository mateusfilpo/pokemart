import API from "./API.js";

export async function loadItems(page = 0, size = 10, forceRefresh = false, append = false) {
    if (!forceRefresh && app.store.items && app.store.items !== "ERROR" && app.store.items.length > 0 && !append && app.store.pagination.currentPage === page) return;

    try {
        const user = app.store.user;
        
        const cat = app.store.selectedCategory || "";
        const search = app.store.searchQuery || "";
        const sort = app.store.sortBy || "price-asc";

        let response;
        if (user && user.role === "ADMIN") {
            response = await API.fetchAdminItems(page, size, cat, search, sort);
        } else {
            response = await API.fetchItems(page, size, cat, search, sort);
        }
        
        if (!append) {
            app.store.categoryStats = await API.fetchCategoryStats(search);
        }

        const itemsArray = Array.isArray(response.data) ? response.data : [];
        const itemsMapped = itemsArray.map(item => ({ 
            ...item, 
            stock: item.stock ?? 10,
            category: item.category
        }));
        
        app.store.pagination = {
            currentPage: response.currentPage,
            totalPages: response.totalPages,
            totalElements: response.totalElements,
            hasNext: response.hasNext
        };

        if (append && app.store.items && app.store.items !== "ERROR") {
            app.store.items = [...app.store.items, ...itemsMapped];
        } else {
            app.store.items = itemsMapped;
        }
        
    } catch (apiError) {
        console.warn("API indisponível.", apiError);
        app.store.items = "ERROR";
    }
}

export async function updateItemStock(id, newStock) {
    const items = app.store.items;
    const itemIndex = items.findIndex(i => String(i.id) === String(id));

    if (itemIndex > -1) {
        items[itemIndex].stock = newStock;
        app.store.items = [...items]; 
    }
}

export async function getItemById(id) {
    if (!id) return null;

    if (app.store.items && app.store.items !== "ERROR") {
        const localItem = app.store.items.find(item => String(item.id) === String(id));
        if (localItem) return localItem;
    }

    try {
        return await API.fetchItemById(id);
    } catch (error) {
        throw error; 
    }
}