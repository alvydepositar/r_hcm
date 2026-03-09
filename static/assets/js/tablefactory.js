class tableFactory {
    constructor(config) {
        Object.assign(this, {
            permissions: { edit: true },
            debounceDelay: 300,
            ...config
        });
    }

    create() {
        this.table = new Tabulator(this.el, {
            layout: "fitColumns",
            height: "500px",

            pagination: "remote",
            paginationSize: 10,

            ajaxURL: this.api.list,
            ajaxResponse: this.ajaxResponse,

            placeholder: "No data available",

            columns: this.columns,

            cellEdited: async (cell) => {
                console.log("Edited:", cell.getField(), cell.getValue());
                await this.saveCell(cell);
            },

            ajaxError: err => console.error("HCM Table Error:", err),
        });

        return this.table;
    }

    applySearch(value) {
    if (!value) {
            this.table.clearFilter();
            this.setPlaceholder("No data available");
            return;
        }

        this.table.setFilter(this.matchAny, { value });

        setTimeout(() => {
            const hasData = this.table.getDataCount() > 0;
            this.setPlaceholder(
                hasData ? "No data available" : `No matching records for "${value}"`
            );
        }, 0);
    }

    setPlaceholder(text) {
        this.table.options.placeholder = text;
        this.table.redraw(true);
    }

    matchAny(data, params) {
        const search = params.value.toLowerCase();
        return Object.values(data).some(v =>
            String(v).toLowerCase().includes(search)
        );
    }

    async saveCell(cell) {
        console.log("Cell edited:", cell.getField(), cell.getValue());
        const row = cell.getRow().getData();
        const field = cell.getField();
        let value = cell.getValue();  

        if (value === "") value = null;
        else if (!isNaN(value)) value = Number(value);

        try {
            const res = await fetch(`${this.api.detail}${row[this.primaryKey]}/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": this.getCSRFToken()
                },
                body: JSON.stringify({ [field]: value })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "Failed to save changes");
            }

            const data = await res.json();
            cell.getRow().update(data); 

        } catch (err) {
            console.error("Failed to save:", err);
            cell.restoreOldValue();
            alert(err.message);
        }
    }

    getCSRFToken() {
        return document.cookie
            .split("; ")
            .find(r => r.startsWith("csrftoken="))
            ?.split("=")[1];
    }
}

class tabSearch {
    constructor(inputId, tabMap, delay = 300) {
        this.input = document.getElementById(inputId);
        this.tabMap = tabMap;
        this.delay = delay;
        this.timer = null;

        if (!this.input) return;

        this.input.addEventListener("keyup", () => {
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.search(), this.delay);
        });
    }

    getActiveTab() {
        return document.querySelector(".nav-link.active")?.id;
    }

    search() {
        const value = this.input.value.trim();
        const activeTabId = this.getActiveTab();
        const factory = this.tabMap[activeTabId];

        if (factory) {
            factory.applySearch(value);
        }
    }
}