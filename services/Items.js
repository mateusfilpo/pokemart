import API from "./API.js";

export async function loadItems() {
    if (app.store.items && app.store.items !== "ERROR" && app.store.items.length > 0) return;

    try {
        const data = await API.fetchItems();
        
        const itemsMapped = Array.isArray(data) 
            ? data.map(item => ({ 
                ...item, 
                stock: item.stock ?? 10,
                category: item.categoryName
            })) 
            : [];
        
        app.store.items = itemsMapped;
        localStorage.setItem("pokemart-items", JSON.stringify(itemsMapped));
    } catch (apiError) {
        console.warn("API indisponível. Tentando usar cache local...", apiError);
        const localItems = localStorage.getItem("pokemart-items");
        if (localItems) {
            app.store.items = JSON.parse(localItems);
        } else {
            app.store.items = "ERROR";
        }
    }
}

export async function updateItemStock(id, newStock) {
    const items = app.store.items;
    const itemIndex = items.findIndex(i => String(i.id) === String(id));

    if (itemIndex > -1) {
        items[itemIndex].stock = newStock;
        app.store.items = [...items]; 
        localStorage.setItem("pokemart-items", JSON.stringify(app.store.items));
    }
}

export async function getItemById(id) {
    if (!id) return null;
    await loadItems();
    return app.store.items.find(item => String(item.id) === String(id)) ?? null;
}

export function getCategoriesWithCount() {
    const items = app.store.items ?? [];
    if (items.length === 0 || items === "ERROR") return [];

    const categoryMap = items.reduce((acc, item) => {
        const catName = item.category || "Outros"; 
        acc[catName] = (acc[catName] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(categoryMap).map(([name, count]) => ({ 
        name, 
        count 
    }));
}