class tableFactory {
    constructor(config) {
        Object.assign(this, {
            permissions: { edit: true },
            autoSaveEdits: true,
            debounceDelay: 300,
            paginationSize: 10,
            tableHeight: "500px",
            loaderTitle: "Loading records",
            loaderMessage: "Preparing the latest data for this workspace.",
            loaderErrorTitle: "Table unavailable",
            loaderErrorMessage: "Refresh the page or try again in a moment.",
            ...config
        });
    }

    buildLoaderMarkup(title, message, state = "loading") {
        return `
            <div class="hcm-tabulator-loader hcm-tabulator-loader--${state}" role="${state === "error" ? "alert" : "status"}" aria-live="polite">
                <div class="hcm-tabulator-loader__badge">
                    <span class="hcm-tabulator-loader__orb"></span>
                </div>
                <div class="hcm-tabulator-loader__body">
                    <span class="hcm-tabulator-loader__eyebrow">${state === "error" ? "Connection issue" : "Workspace sync"}</span>
                    <strong class="hcm-tabulator-loader__title">${title}</strong>
                    <span class="hcm-tabulator-loader__message">${message}</span>
                </div>
                <div class="hcm-tabulator-loader__bars" aria-hidden="true">
                    <span class="hcm-tabulator-loader__bar"></span>
                    <span class="hcm-tabulator-loader__bar"></span>
                    <span class="hcm-tabulator-loader__bar"></span>
                </div>
            </div>
        `;
    }

    create() {
        const host = typeof this.el === "string"
            ? document.querySelector(this.el)
            : this.el;

        if (host) {
            host.classList.add("hcm-tabulator-host");
        }

        this.table = new Tabulator(this.el, {
            layout: this.layout || "fitColumns",
            height: this.tableHeight,
            index: this.primaryKey,

            pagination: "local",
            paginationSize: this.paginationSize,

            ajaxURL: this.api.list,
            ajaxLoader: true,
            ajaxLoaderLoading: this.buildLoaderMarkup(this.loaderTitle, this.loaderMessage),
            ajaxLoaderError: this.buildLoaderMarkup(this.loaderErrorTitle, this.loaderErrorMessage, "error"),
            ajaxResponse: this.ajaxResponse,

            placeholder: "No data available",

            columns: this.columns,

            cellEdited: async (cell) => {
                console.log("Edited:", cell.getField(), cell.getValue());

                if (typeof this.onCellEdited === "function") {
                    await this.onCellEdited(cell);
                }

                if (!this.autoSaveEdits) {
                    return;
                }

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

    normalizeCellValue(value) {
        return value === "" ? null : value;
    }

    async getErrorMessage(response) {
        try {
            const data = await response.json();

            if (typeof data === "string") {
                return data;
            }

            if (Array.isArray(data)) {
                return data.join(", ");
            }

            if (data && typeof data === "object") {
                if (data.detail) {
                    return data.detail;
                }

                return Object.entries(data)
                    .map(([field, messages]) => `${field}: ${[].concat(messages).join(", ")}`)
                    .join(" | ");
            }
        } catch (err) {
            console.error("Failed to parse table error response:", err);
        }

        return "Failed to save changes";
    }

    async saveCell(cell) {
        console.log("Cell edited:", cell.getField(), cell.getValue());
        const row = cell.getRow().getData();
        const field = cell.getField();
        const rawValue = cell.getValue();
        const value = typeof this.serializeCellValue === "function"
            ? this.serializeCellValue({ cell, row, value: rawValue })
            : this.normalizeCellValue(rawValue);

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
                throw new Error(await this.getErrorMessage(res));
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

function createTableRowEditor(config) {
    const state = {
        table: null,
        mode: null,
        rowId: null,
        originalRows: new Map(),
        listeners: new Set(),
    };

    const editableFields = config.editableFields || [];
    const initialEditField = config.initialEditField || editableFields[0] || null;

    function notifyStateChange() {
        const snapshot = {
            mode: state.mode,
            rowId: state.rowId,
            isBulkEditing: state.mode === "all",
            isSingleEditing: state.mode === "single",
        };

        state.listeners.forEach(listener => listener(snapshot));
    }

    function cloneRowData(rowData) {
        return JSON.parse(JSON.stringify(rowData));
    }

    function waitForEditorCommit() {
        return new Promise(resolve => {
            window.setTimeout(resolve, 0);
        });
    }

    async function flushPendingEditor() {
        const activeElement = document.activeElement;
        if (activeElement && typeof activeElement.blur === "function") {
            activeElement.blur();
        }

        await waitForEditorCommit();
        await waitForEditorCommit();

        if (state.table && typeof state.table.redraw === "function") {
            state.table.redraw(true);
            await waitForEditorCommit();
        }
    }

    function normalizeFieldValue(field, value, rowData) {
        if (typeof config.serializeFieldValue === "function") {
            return config.serializeFieldValue({ field, value, rowData });
        }

        return value === "" ? null : value;
    }

    function getRowById(rowId) {
        if (!state.table) {
            return null;
        }

        try {
            const directRow = state.table.getRow(rowId);
            if (directRow) {
                return directRow;
            }
        } catch (err) {
            console.warn("Row lookup fallback triggered:", err);
        }

        return state.table.getRows("active").find(row => (
            String(row.getData()[config.primaryKey]) === String(rowId)
        )) || null;
    }

    function redrawTable() {
        if (state.table) {
            state.table.redraw(true);
        }
    }

    function reset() {
        state.mode = null;
        state.rowId = null;
        state.originalRows = new Map();
        redrawTable();
        notifyStateChange();
    }

    function attachTable(table) {
        state.table = table;
        notifyStateChange();
    }

    function onStateChange(listener) {
        if (typeof listener !== "function") {
            return () => {};
        }

        state.listeners.add(listener);
        listener({
            mode: state.mode,
            rowId: state.rowId,
            isBulkEditing: state.mode === "all",
            isSingleEditing: state.mode === "single",
        });

        return () => {
            state.listeners.delete(listener);
        };
    }

    function isEditingRow(rowData) {
        const rowKey = String(rowData?.[config.primaryKey] ?? "");

        if (state.mode === "all") {
            return state.originalRows.has(rowKey);
        }

        return state.mode === "single" && String(state.rowId ?? "") === rowKey;
    }

    function getEditingRow() {
        return state.rowId ? getRowById(state.rowId) : null;
    }

    function getOriginalRowData(rowId) {
        return state.originalRows.get(String(rowId)) || null;
    }

    function buildPayload(row) {
        const rowData = row.getData();
        const payload = {};
        const originalRow = getOriginalRowData(rowData[config.primaryKey]);

        if (!originalRow) {
            return payload;
        }

        editableFields.forEach(field => {
            const originalValue = normalizeFieldValue(field, originalRow[field] ?? null, originalRow);
            const currentValue = normalizeFieldValue(field, rowData[field] ?? null, rowData);

            if (String(originalValue ?? "") !== String(currentValue ?? "")) {
                payload[field] = currentValue;
            }
        });

        return payload;
    }

    function hasPendingChanges(row) {
        return Object.keys(buildPayload(row)).length > 0;
    }

    function hasBlockingPendingChanges() {
        if (state.mode === "single") {
            const editingRow = getEditingRow();
            return editingRow ? hasPendingChanges(editingRow) : false;
        }

        if (state.mode === "all") {
            return Array.from(state.originalRows.keys()).some(rowId => {
                const row = getRowById(rowId);
                return row ? hasPendingChanges(row) : false;
            });
        }

        return false;
    }

    function enterEditMode(row) {
        const rowData = row.getData();

        if (state.mode === "all") {
            alert(config.bulkEditConflictMessage || "Save or cancel all rows before editing a single row.");
            return;
        }

        if (state.rowId && state.rowId !== rowData[config.primaryKey]) {
            const currentRow = getRowById(state.rowId);
            if (currentRow && hasPendingChanges(currentRow)) {
                alert(config.pendingEditMessage || "Save or cancel the current row before editing another one.");
                return;
            }
        }

        state.mode = "single";
        state.rowId = rowData[config.primaryKey];
        state.originalRows = new Map([
            [String(rowData[config.primaryKey]), cloneRowData(rowData)],
        ]);
        redrawTable();
        notifyStateChange();

        if (initialEditField) {
            row.getCell(initialEditField)?.edit();
        }
    }

    function enterBulkEditMode() {
        if (!state.table) {
            return;
        }

        if (state.mode === "all") {
            return;
        }

        if (state.mode === "single") {
            const currentRow = getEditingRow();
            if (currentRow && hasPendingChanges(currentRow)) {
                alert(config.pendingBulkEditMessage || "Save or cancel the current row before editing all rows.");
                return;
            }
        }

        const rows = state.table.getRows("active");
        if (!rows.length) {
            return;
        }

        state.mode = "all";
        state.rowId = null;
        state.originalRows = new Map(
            rows.map(row => [String(row.getData()[config.primaryKey]), cloneRowData(row.getData())])
        );
        redrawTable();
        notifyStateChange();
    }

    async function cancelEdit(row) {
        const originalRow = getOriginalRowData(row.getData()[config.primaryKey]);
        if (!originalRow) {
            reset();
            return;
        }

        await flushPendingEditor();
        await Promise.resolve(row.update(cloneRowData(originalRow)));
        reset();
    }

    async function saveEdit(row) {
        if (state.mode !== "single" || !isEditingRow(row.getData())) {
            return;
        }

        await flushPendingEditor();

        const payload = buildPayload(row);
        if (!Object.keys(payload).length) {
            reset();
            return;
        }

        const rowId = row.getData()[config.primaryKey];

        try {
            const response = await fetch(`${config.patchUrlBase}${rowId}/`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const message = typeof readApiError === "function"
                    ? await readApiError(response, config.saveErrorMessage || "Failed to save changes")
                    : (config.saveErrorMessage || "Failed to save changes");
                throw new Error(message);
            }

            const updated = await response.json();
            await Promise.resolve(row.update(updated));

            if (typeof config.onSaveSuccess === "function") {
                config.onSaveSuccess({ row, updated });
            }

            reset();
        } catch (err) {
            alert(err.message);
        }
    }

    async function cancelAllEdits() {
        if (state.mode !== "all" || !state.table) {
            return;
        }

        await flushPendingEditor();

        const restoreJobs = Array.from(state.originalRows.entries()).map(([rowId, originalRow]) => {
            const row = getRowById(rowId);
            return row ? Promise.resolve(row.update(cloneRowData(originalRow))) : Promise.resolve();
        });

        await Promise.all(restoreJobs);
        reset();
    }

    async function saveAllEdits() {
        if (state.mode !== "all" || !state.table) {
            return;
        }

        await flushPendingEditor();

        const failedMessages = [];

        for (const [rowId] of state.originalRows.entries()) {
            const row = getRowById(rowId);
            if (!row) {
                continue;
            }

            const payload = buildPayload(row);
            if (!Object.keys(payload).length) {
                state.originalRows.set(String(rowId), cloneRowData(row.getData()));
                continue;
            }

            try {
                const response = await fetch(`${config.patchUrlBase}${rowId}/`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrftoken,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const message = typeof readApiError === "function"
                        ? await readApiError(response, config.saveErrorMessage || "Failed to save changes")
                        : (config.saveErrorMessage || "Failed to save changes");
                    throw new Error(message);
                }

                const updated = await response.json();
                await Promise.resolve(row.update(updated));

                if (typeof config.onSaveSuccess === "function") {
                    config.onSaveSuccess({ row, updated });
                }

                state.originalRows.set(String(rowId), cloneRowData(row.getData()));
            } catch (err) {
                failedMessages.push(`Row ${rowId}: ${err.message}`);
            }
        }

        if (failedMessages.length) {
            redrawTable();
            notifyStateChange();
            alert(failedMessages.join("\n"));
            return;
        }

        reset();
    }

    async function performDelete(row) {
        const rowId = row.getData()[config.primaryKey];
        const response = await fetch(`${config.deleteUrlBase}${rowId}/`, {
            method: "DELETE",
            headers: {
                "X-CSRFToken": csrftoken,
            },
        });

        if (!response.ok) {
            const message = typeof readApiError === "function"
                ? await readApiError(response, config.deleteErrorMessage || "Failed to delete")
                : (config.deleteErrorMessage || "Failed to delete");
            throw new Error(message);
        }
    }

    async function deleteRow(row, options = {}) {
        if (!config.deleteUrlBase) {
            return;
        }

        const confirmed = options.skipConfirm || confirm(config.deleteConfirmMessage || "Delete this row?");
        if (!confirmed) {
            return;
        }

        try {
            const rowKey = String(row.getData()[config.primaryKey]);
            const currentMode = state.mode;
            await performDelete(row);

            if (currentMode === "single" && String(state.rowId ?? "") === rowKey) {
                state.mode = null;
                state.rowId = null;
                state.originalRows = new Map();
            } else if (currentMode === "all") {
                state.originalRows.delete(rowKey);
                if (!state.originalRows.size) {
                    state.mode = null;
                    state.rowId = null;
                }
            }

            if (typeof config.onDeleteSuccess === "function") {
                config.onDeleteSuccess({ row });
            }

            await Promise.resolve(row.delete());
            redrawTable();
            notifyStateChange();
        } catch (err) {
            alert(err.message);
        }
    }

    async function deleteSelectedRows(options = {}) {
        if (!config.deleteUrlBase || !state.table) {
            return;
        }

        if (state.mode) {
            alert(config.pendingDeleteMessage || "Save or cancel the current edits before deleting selected rows.");
            return;
        }

        const rows = state.table.getSelectedRows();
        if (!rows.length) {
            alert(options.emptySelectionMessage || "Select at least one row to delete.");
            return;
        }

        const confirmed = confirm(
            options.confirmMessage
                || config.bulkDeleteConfirmMessage
                || `Delete ${rows.length} selected row${rows.length === 1 ? "" : "s"}?`
        );

        if (!confirmed) {
            return;
        }

        const failedMessages = [];

        for (const row of rows) {
            try {
                await performDelete(row);

                if (isEditingRow(row.getData())) {
                    state.rowId = null;
                    state.originalRow = null;
                }

                if (typeof config.onDeleteSuccess === "function") {
                    config.onDeleteSuccess({ row });
                }

                await Promise.resolve(row.delete());
            } catch (err) {
                failedMessages.push(`Row ${row.getData()[config.primaryKey]}: ${err.message}`);
            }
        }

        redrawTable();

        if (failedMessages.length) {
            alert(failedMessages.join("\n"));
        }
    }

    function buildActionsColumn(options = {}) {
        return {
            title: options.title || "Actions",
            headerSort: false,
            width: options.width || (config.deleteUrlBase ? 250 : 170),
            hozAlign: "center",
            formatter: cell => {
                if (state.mode === "all") {
                    return `
                        <div class="d-flex gap-1 justify-content-center">
                            <span class="badge text-bg-light align-self-center">Editing</span>
                            ${config.deleteUrlBase ? '<button class="btn btn-sm btn-danger hcm-row-delete">Delete</button>' : ""}
                        </div>
                    `;
                }

                const editing = isEditingRow(cell.getRow().getData());

                return `
                    <div class="d-flex gap-1 justify-content-center">
                        <button class="btn btn-sm ${editing ? "btn-success hcm-row-save" : "btn-primary hcm-row-edit"}">
                            ${editing ? "Save" : "Edit"}
                        </button>
                        ${editing ? '<button class="btn btn-sm btn-secondary hcm-row-cancel">Cancel</button>' : ""}
                        ${config.deleteUrlBase ? '<button class="btn btn-sm btn-danger hcm-row-delete">Delete</button>' : ""}
                    </div>
                `;
            },
            cellClick: (event, cell) => {
                const button = event.target.closest("button");
                if (!button) {
                    return;
                }

                const row = cell.getRow();

                if (button.classList.contains("hcm-row-edit")) {
                    enterEditMode(row);
                    return;
                }

                if (button.classList.contains("hcm-row-save")) {
                    window.setTimeout(() => {
                        saveEdit(row);
                    }, 0);
                    return;
                }

                if (button.classList.contains("hcm-row-cancel")) {
                    window.setTimeout(() => {
                        cancelEdit(row).catch(err => alert(err.message));
                    }, 0);
                    return;
                }

                if (button.classList.contains("hcm-row-delete")) {
                    window.setTimeout(() => {
                        deleteRow(row);
                    }, 0);
                }
            },
        };
    }

    return {
        attachTable,
        onStateChange,
        reset,
        isEditingRow,
        enterBulkEditMode,
        saveAllEdits,
        cancelAllEdits,
        buildActionsColumn,
        deleteSelectedRows,
        deleteRow,
    };
}

function bindSelectionActionButton(table, button, options = {}) {
    if (!table || !button) {
        return {
            sync() {},
        };
    }

    const hiddenClass = options.hiddenClass || "d-none";

    const sync = () => {
        const hasSelection = table.getSelectedRows().length > 0;
        button.classList.toggle(hiddenClass, !hasSelection);
    };

    sync();

    if (typeof table.on === "function") {
        table.on("rowSelectionChanged", sync);
        table.on("dataProcessed", sync);
    }

    return { sync };
}

function bindBulkEditActionButtons(rowEditor, controls) {
    if (!rowEditor || !controls) {
        return {
            sync() {},
        };
    }

    const {
        editAllButton,
        saveAllButton,
        cancelAllButton,
    } = controls;

    const sync = snapshot => {
        const state = snapshot || {
            isBulkEditing: false,
            isSingleEditing: false,
        };

        if (editAllButton) {
            editAllButton.classList.toggle("d-none", state.isBulkEditing);
            editAllButton.disabled = state.isSingleEditing;
        }

        if (saveAllButton) {
            saveAllButton.classList.toggle("d-none", !state.isBulkEditing);
        }

        if (cancelAllButton) {
            cancelAllButton.classList.toggle("d-none", !state.isBulkEditing);
        }
    };

    rowEditor.onStateChange(sync);

    if (editAllButton) {
        editAllButton.addEventListener("click", () => {
            rowEditor.enterBulkEditMode();
        });
    }

    if (saveAllButton) {
        saveAllButton.addEventListener("click", () => {
            window.setTimeout(() => {
                rowEditor.saveAllEdits().catch(err => alert(err.message));
            }, 0);
        });
    }

    if (cancelAllButton) {
        cancelAllButton.addEventListener("click", () => {
            window.setTimeout(() => {
                rowEditor.cancelAllEdits().catch(err => alert(err.message));
            }, 0);
        });
    }

    return { sync };
}

function bindTableSearchInput(input, factory, delay = 300) {
    const searchInput = typeof input === "string"
        ? document.getElementById(input)
        : input;

    if (!searchInput || !factory) {
        return {
            search() {},
        };
    }

    let timer = null;

    const search = () => {
        factory.applySearch(searchInput.value.trim());
    };

    searchInput.addEventListener("input", () => {
        clearTimeout(timer);
        timer = window.setTimeout(search, delay);
    });

    return { search };
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
