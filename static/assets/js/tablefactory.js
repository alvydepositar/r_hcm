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

let hcmTableRowViewDialog = null;

function getTableRowViewDialog() {
    if (hcmTableRowViewDialog) {
        return hcmTableRowViewDialog;
    }

    const element = document.createElement("div");
    element.className = "modal fade";
    element.id = "hcmTableRowViewModal";
    element.tabIndex = -1;
    element.setAttribute("aria-hidden", "true");
    element.innerHTML = `
        <div class="modal-dialog modal-dialog-centered modal-xl">
            <div class="modal-content hcm-record-sheet-modal">
                <div class="modal-header border-0 pb-0">
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body pt-0">
                    <div class="hcm-record-sheet">
                        <div class="hcm-record-sheet__masthead">
                            <div class="hcm-record-sheet__heading">
                                <div class="hcm-record-sheet__eyebrow">Official Record View</div>
                                <h3 class="hcm-record-sheet__title mb-0">Record Details</h3>
                                <div class="hcm-record-sheet__subtitle"></div>
                            </div>
                        </div>
                        <div class="hcm-record-sheet__section">
                            <div class="hcm-record-sheet__section-title">Form Details</div>
                            <div class="hcm-record-sheet__grid"></div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer border-0 pt-0">
                    <div class="hcm-record-sheet__actions">
                        <button type="button" class="btn btn-outline-primary hcm-record-sheet__action-edit d-none">
                            Edit Record
                        </button>
                        <button type="button" class="btn btn-primary hcm-record-sheet__action-save d-none">
                            Save Changes
                        </button>
                        <button type="button" class="btn btn-outline-secondary hcm-record-sheet__action-cancel d-none">
                            Cancel Edit
                        </button>
                        <button type="button" class="btn btn-outline-danger hcm-record-sheet__action-delete d-none">
                            Delete Record
                        </button>
                        <button type="button" class="btn btn-light hcm-record-sheet__action-close" data-bs-dismiss="modal">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(element);

    hcmTableRowViewDialog = {
        element,
        modal: new bootstrap.Modal(element),
        title: element.querySelector(".hcm-record-sheet__title"),
        subtitle: element.querySelector(".hcm-record-sheet__subtitle"),
        grid: element.querySelector(".hcm-record-sheet__grid"),
        editButton: element.querySelector(".hcm-record-sheet__action-edit"),
        deleteButton: element.querySelector(".hcm-record-sheet__action-delete"),
        saveButton: element.querySelector(".hcm-record-sheet__action-save"),
        cancelButton: element.querySelector(".hcm-record-sheet__action-cancel"),
        closeButton: element.querySelector(".hcm-record-sheet__action-close"),
        enhancedSelects: new Set(),
        state: null,
    };

    element.addEventListener("hidden.bs.modal", () => {
        if (typeof destroySearchableSelect === "function") {
            hcmTableRowViewDialog.enhancedSelects.forEach(select => destroySearchableSelect(select));
        }

        hcmTableRowViewDialog.enhancedSelects.clear();
        hcmTableRowViewDialog.grid.innerHTML = "";
        hcmTableRowViewDialog.state = null;
        hcmTableRowViewDialog.editButton.onclick = null;
        hcmTableRowViewDialog.deleteButton.onclick = null;
        hcmTableRowViewDialog.saveButton.onclick = null;
        hcmTableRowViewDialog.cancelButton.onclick = null;
    });

    return hcmTableRowViewDialog;
}

function stringifyTableViewValue(value) {
    if (value === null || value === undefined || value === "") {
        return "Not set";
    }

    if (Array.isArray(value) || (value && typeof value === "object")) {
        try {
            return JSON.stringify(value, null, 2);
        } catch (err) {
            console.error("Failed to stringify row view value:", err);
            return String(value);
        }
    }

    return String(value);
}

function cloneTableRowViewData(rowData) {
    return JSON.parse(JSON.stringify(rowData || {}));
}

function runTableRowViewAction(dialog, action) {
    if (typeof action !== "function") {
        return;
    }

    const handleHidden = () => {
        action();
    };

    dialog.element.addEventListener("hidden.bs.modal", handleHidden, { once: true });
    dialog.modal.hide();
}

function getTableRowViewFieldKey(fieldConfig) {
    return fieldConfig.editField || fieldConfig.field || null;
}

function resolveTableRowViewRawValue(fieldConfig, rowData) {
    if (typeof fieldConfig.value === "function") {
        return fieldConfig.value(rowData);
    }

    return rowData[fieldConfig.field];
}

function formatTableRowViewDisplayValue(fieldConfig, rowData) {
    const rawValue = resolveTableRowViewRawValue(fieldConfig, rowData);
    return typeof fieldConfig.format === "function"
        ? fieldConfig.format({ rowData, value: rawValue })
        : stringifyTableViewValue(rawValue);
}

function getTableRowViewCellProxy(fieldKey, rowData) {
    return {
        getField: () => fieldKey,
        getValue: () => rowData[fieldKey],
        getRow: () => ({
            getData: () => rowData,
        }),
    };
}

function getTableRowViewPreparedData(dialog, rowData) {
    if (typeof dialog.state?.editConfig?.prepareRowData === "function") {
        return dialog.state.editConfig.prepareRowData(cloneTableRowViewData(rowData));
    }

    return cloneTableRowViewData(rowData);
}

function getTableRowViewFieldDefinition(dialog, fieldKey) {
    if (!fieldKey || typeof dialog.state?.editConfig?.getFieldDefinition !== "function") {
        return null;
    }

    return dialog.state.editConfig.getFieldDefinition(fieldKey, dialog.state.draftData) || null;
}

function isTableRowViewEditable(dialog, fieldConfig) {
    const fieldKey = getTableRowViewFieldKey(fieldConfig);
    if (!fieldKey || dialog.state?.mode !== "edit") {
        return false;
    }

    const editableFields = dialog.state?.editConfig?.editableFields || [];
    if (!editableFields.includes(fieldKey)) {
        return false;
    }

    if (typeof dialog.state?.editConfig?.isFieldEditable === "function") {
        return dialog.state.editConfig.isFieldEditable(fieldKey, dialog.state.draftData) !== false;
    }

    return true;
}

function guessTableRowViewInputType(fieldKey, currentValue) {
    if (/_date$/i.test(fieldKey) || /^\d{4}-\d{2}-\d{2}$/.test(String(currentValue || ""))) {
        return "date";
    }

    if (
        /(time|earliest_|latest_|lunch_)/i.test(fieldKey)
        || /^\d{2}:\d{2}(:\d{2})?$/.test(String(currentValue || ""))
    ) {
        return "time";
    }

    return "text";
}

function applyTableRowViewDerivedData(dialog) {
    if (typeof dialog.state?.editConfig?.prepareRowData !== "function") {
        return;
    }

    dialog.state.draftData = dialog.state.editConfig.prepareRowData(
        cloneTableRowViewData(dialog.state.draftData),
    );
}

function buildTableRowViewEditor(dialog, fieldConfig) {
    const fieldKey = getTableRowViewFieldKey(fieldConfig);
    const fieldDefinition = getTableRowViewFieldDefinition(dialog, fieldKey) || {};
    const editor = fieldDefinition.editor || "input";
    const rawValue = dialog.state.draftData[fieldKey];
    const wrapper = document.createElement("div");
    wrapper.className = "hcm-record-sheet__editor";

    const updateDraft = (value, { rerender = false } = {}) => {
        dialog.state.draftData[fieldKey] = value;

        if (rerender) {
            applyTableRowViewDerivedData(dialog);
            renderTableRowView(dialog);
        }
    };

    if (editor === searchableDropdownEditor) {
        const select = document.createElement("select");
        select.className = "form-select hcm-record-sheet__control";

        const editorParams = typeof fieldDefinition.editorParams === "function"
            ? (fieldDefinition.editorParams(getTableRowViewCellProxy(fieldKey, dialog.state.draftData)) || {})
            : (fieldDefinition.editorParams || {});
        const options = typeof normalizeLookupOptions === "function"
            ? normalizeLookupOptions(editorParams.values || [])
            : (editorParams.values || []);
        const placeholder = editorParams.placeholder || "Select an option";

        const placeholderOption = document.createElement("option");
        placeholderOption.value = "";
        placeholderOption.textContent = placeholder;
        if (!editorParams.clearable) {
            placeholderOption.disabled = true;
            placeholderOption.hidden = true;
        }
        select.appendChild(placeholderOption);

        options.forEach(option => {
            const optionElement = document.createElement("option");
            optionElement.value = String(option.value);
            optionElement.textContent = option.label ?? String(option.value);
            select.appendChild(optionElement);
        });

        select.value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
        wrapper.appendChild(select);

        if (typeof enhanceSearchableSelect === "function") {
            enhanceSearchableSelect(select, {
                placeholder,
                searchPlaceholder: editorParams.searchPlaceholder || "Search options",
                searchable: editorParams.searchable,
                searchCategory: editorParams.searchCategory,
                minSearchOptions: editorParams.minSearchOptions,
                keepOpenOnSelect: true,
            });
            dialog.enhancedSelects.add(select);
        }

        select.addEventListener("change", () => {
            updateDraft(select.value, { rerender: true });
        });

        return wrapper;
    }

    if (editor === "textarea") {
        const textarea = document.createElement("textarea");
        textarea.className = "form-control hcm-record-sheet__control hcm-record-sheet__control--textarea";
        textarea.rows = fieldConfig.fullWidth ? 5 : 3;
        textarea.value = rawValue ?? "";
        textarea.addEventListener("input", () => {
            updateDraft(textarea.value);
        });
        wrapper.appendChild(textarea);
        return wrapper;
    }

    const input = document.createElement("input");
    input.className = "form-control hcm-record-sheet__control";
    input.type = guessTableRowViewInputType(fieldKey, rawValue);
    input.value = rawValue ?? "";

    input.addEventListener("input", () => {
        updateDraft(input.value);
    });

    input.addEventListener("change", () => {
        const shouldRerender = ["date", "time"].includes(input.type);
        updateDraft(input.value, { rerender: shouldRerender });
    });

    wrapper.appendChild(input);
    return wrapper;
}

function updateTableRowViewActions(dialog) {
    const state = dialog.state;
    const isEditMode = state.mode === "edit";

    dialog.editButton.textContent = state.editLabel;
    dialog.deleteButton.textContent = state.deleteLabel;
    dialog.saveButton.textContent = state.saveLabel;
    dialog.cancelButton.textContent = state.cancelLabel;

    dialog.editButton.classList.toggle("d-none", isEditMode || !state.editConfig);
    dialog.deleteButton.classList.toggle("d-none", isEditMode || typeof state.onDelete !== "function");
    dialog.saveButton.classList.toggle("d-none", !isEditMode || !state.editConfig);
    dialog.cancelButton.classList.toggle("d-none", !isEditMode || !state.editConfig);
    dialog.closeButton.classList.toggle("d-none", isEditMode);

    dialog.editButton.disabled = !!state.saving;
    dialog.deleteButton.disabled = !!state.saving;
    dialog.saveButton.disabled = !!state.saving;
    dialog.cancelButton.disabled = !!state.saving;

    dialog.editButton.onclick = null;
    dialog.deleteButton.onclick = null;
    dialog.saveButton.onclick = null;
    dialog.cancelButton.onclick = null;

    if (!isEditMode && state.editConfig) {
        dialog.editButton.onclick = () => {
            if (typeof state.editConfig.onStartEdit === "function" && state.editConfig.onStartEdit() === false) {
                return;
            }

            state.mode = "edit";
            state.draftData = cloneTableRowViewData(state.rowData);
            applyTableRowViewDerivedData(dialog);
            renderTableRowView(dialog);
        };
    }

    if (!isEditMode && typeof state.onDelete === "function") {
        dialog.deleteButton.onclick = () => runTableRowViewAction(dialog, state.onDelete);
    }

    if (isEditMode && state.editConfig) {
        dialog.cancelButton.onclick = () => {
            state.mode = "view";
            state.draftData = cloneTableRowViewData(state.rowData);
            renderTableRowView(dialog);
        };

        dialog.saveButton.onclick = async () => {
            if (state.saving) {
                return;
            }

            state.saving = true;
            updateTableRowViewActions(dialog);

            try {
                const updatedRow = await state.editConfig.onSave({
                    originalData: cloneTableRowViewData(state.rowData),
                    draftData: cloneTableRowViewData(state.draftData),
                });

                state.rowData = cloneTableRowViewData(updatedRow || state.draftData);
                state.draftData = cloneTableRowViewData(state.rowData);
                state.mode = "view";
            } catch (err) {
                alert(err.message || "Failed to save changes");
            } finally {
                state.saving = false;
                renderTableRowView(dialog);
            }
        };
    }
}

function renderTableRowView(dialog) {
    if (!dialog?.state) {
        return;
    }

    if (typeof destroySearchableSelect === "function") {
        dialog.enhancedSelects.forEach(select => destroySearchableSelect(select));
    }
    dialog.enhancedSelects.clear();

    const renderData = dialog.state.mode === "edit"
        ? getTableRowViewPreparedData(dialog, dialog.state.draftData)
        : getTableRowViewPreparedData(dialog, dialog.state.rowData);

    dialog.title.textContent = typeof dialog.state.title === "function"
        ? dialog.state.title(renderData)
        : (dialog.state.title || "Record Details");
    dialog.subtitle.textContent = typeof dialog.state.subtitle === "function"
        ? dialog.state.subtitle(renderData)
        : (dialog.state.subtitle || "");
    dialog.subtitle.classList.toggle("d-none", !dialog.subtitle.textContent.trim());

    dialog.grid.innerHTML = "";

    dialog.state.fields.forEach(fieldConfig => {
        const item = document.createElement("div");
        item.className = `hcm-record-sheet__field${fieldConfig.fullWidth ? " hcm-record-sheet__field--full" : ""}`;

        const label = document.createElement("div");
        label.className = "hcm-record-sheet__label";
        label.textContent = fieldConfig.label;

        item.appendChild(label);

        if (isTableRowViewEditable(dialog, fieldConfig)) {
            item.classList.add("is-editing");
            item.appendChild(buildTableRowViewEditor(dialog, fieldConfig));
        } else {
            const value = document.createElement("div");
            value.className = "hcm-record-sheet__value";
            value.textContent = stringifyTableViewValue(
                formatTableRowViewDisplayValue(fieldConfig, renderData),
            );
            item.appendChild(value);
        }

        dialog.grid.appendChild(item);
    });

    updateTableRowViewActions(dialog);
}

function showTableRowView({
    title,
    subtitle = "",
    rowData,
    fields = [],
    onDelete = null,
    editConfig = null,
    editLabel = "Edit Record",
    deleteLabel = "Delete Record",
    saveLabel = "Save Changes",
    cancelLabel = "Cancel Edit",
}) {
    const dialog = getTableRowViewDialog();
    dialog.state = {
        title,
        subtitle,
        rowData: cloneTableRowViewData(rowData),
        draftData: cloneTableRowViewData(rowData),
        fields,
        onDelete,
        editConfig,
        editLabel,
        deleteLabel,
        saveLabel,
        cancelLabel,
        mode: "view",
        saving: false,
    };

    renderTableRowView(dialog);

    dialog.modal.show();
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
    const modalEditableFields = Array.from(new Set(
        editableFields.concat(
            (config.viewFields || [])
                .map(fieldConfig => fieldConfig.editField)
                .filter(Boolean),
        ),
    ));
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

    function prepareModalRowData(rowData) {
        if (typeof config.prepareModalRowData === "function") {
            return config.prepareModalRowData(cloneRowData(rowData));
        }

        return cloneRowData(rowData);
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

    function getFieldDefinition(fieldKey) {
        if (!state.table || !fieldKey) {
            return null;
        }

        try {
            return state.table.getColumn(fieldKey)?.getDefinition() || null;
        } catch (err) {
            console.warn("Field definition lookup failed:", err);
            return null;
        }
    }

    function buildPayloadFromData(originalRow, currentRow) {
        const payload = {};

        editableFields.forEach(field => {
            const originalValue = normalizeFieldValue(field, originalRow[field] ?? null, originalRow);
            const currentValue = normalizeFieldValue(field, currentRow[field] ?? null, currentRow);

            if (String(originalValue ?? "") !== String(currentValue ?? "")) {
                payload[field] = currentValue;
            }
        });

        return payload;
    }

    function showRowView(row) {
        if (!Array.isArray(config.viewFields) || !config.viewFields.length) {
            return;
        }

        showTableRowView({
            title: typeof config.getViewTitle === "function"
                ? config.getViewTitle(row.getData())
                : (config.viewTitle || "Record Details"),
            subtitle: typeof config.getViewSubtitle === "function"
                ? config.getViewSubtitle(row.getData())
                : (config.viewSubtitle || ""),
            rowData: row.getData(),
            fields: config.viewFields,
            onDelete: config.deleteUrlBase
                ? () => deleteRow(row)
                : null,
            editLabel: "Edit Row",
            deleteLabel: "Delete Row",
            editConfig: modalEditableFields.length
                ? {
                    editableFields: modalEditableFields,
                    getFieldDefinition,
                    prepareRowData: prepareModalRowData,
                    isFieldEditable: (fieldKey, rowData) => {
                        if (typeof config.isModalFieldEditable === "function") {
                            return config.isModalFieldEditable({ field: fieldKey, rowData }) !== false;
                        }

                        return true;
                    },
                    onStartEdit: () => {
                        if (state.mode) {
                            alert(config.pendingModalEditMessage || "Save or cancel the current edits before editing from the modal.");
                            return false;
                        }

                        return true;
                    },
                    onSave: async ({ originalData, draftData }) => {
                        const preparedOriginal = prepareModalRowData(originalData);
                        const preparedDraft = prepareModalRowData(draftData);
                        const payload = buildPayloadFromData(preparedOriginal, preparedDraft);

                        if (!Object.keys(payload).length) {
                            return cloneRowData(row.getData());
                        }

                        return persistRowChanges(row, payload);
                    },
                }
                : null,
        });
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
        const originalRow = getOriginalRowData(rowData[config.primaryKey]);

        if (!originalRow) {
            return {};
        }

        return buildPayloadFromData(originalRow, rowData);
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

        try {
            await persistRowChanges(row, payload);
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

    async function persistRowChanges(row, payload) {
        const rowId = row.getData()[config.primaryKey];
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

        return cloneRowData(row.getData());
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

        const confirmed = options.skipConfirm || await showSystemConfirm(
            config.deleteConfirmMessage || "Delete this row?",
            {
                title: "Delete Record?",
                confirmLabel: "Delete",
                tone: "danger",
            }
        );
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

        const confirmed = await showSystemConfirm(
            options.confirmMessage
                || config.bulkDeleteConfirmMessage
                || `Delete ${rows.length} selected row${rows.length === 1 ? "" : "s"}?`,
            {
                title: "Delete Selected Records?",
                confirmLabel: "Delete",
                tone: "danger",
            }
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
        const hasView = Array.isArray(config.viewFields) && config.viewFields.length > 0;
        const iconButton = (className, variant, icon, label) => `
            <button
                class="btn btn-sm ${variant} hcm-table-action-btn ${className}"
                type="button"
                title="${label}"
                aria-label="${label}"
            >
                <i class="${icon}" aria-hidden="true"></i>
                <span class="visually-hidden">${label}</span>
            </button>
        `;

        return {
            title: options.title || "Actions",
            headerSort: false,
            width: options.width || (config.deleteUrlBase ? (hasView ? 190 : 150) : (hasView ? 150 : 110)),
            hozAlign: "center",
            formatter: cell => {
                if (state.mode === "all") {
                    return `
                        <div class="d-flex gap-1 justify-content-center align-items-center hcm-table-actions">
                            ${hasView ? iconButton("hcm-row-view", "btn-outline-secondary", "ti ti-eye", "View") : ""}
                            <span class="badge text-bg-light align-self-center">Editing</span>
                            ${config.deleteUrlBase ? iconButton("hcm-row-delete", "btn-danger", "ti ti-trash", "Delete") : ""}
                        </div>
                    `;
                }

                const editing = isEditingRow(cell.getRow().getData());

                return `
                    <div class="d-flex gap-1 justify-content-center align-items-center hcm-table-actions">
                        ${hasView ? iconButton("hcm-row-view", "btn-outline-secondary", "ti ti-eye", "View") : ""}
                        ${editing
                            ? iconButton("hcm-row-save", "btn-success", "ti ti-device-floppy", "Save")
                            : iconButton("hcm-row-edit", "btn-primary", "ti ti-pencil", "Edit")}
                        ${editing ? iconButton("hcm-row-cancel", "btn-secondary", "ti ti-x", "Cancel") : ""}
                        ${config.deleteUrlBase ? iconButton("hcm-row-delete", "btn-danger", "ti ti-trash", "Delete") : ""}
                    </div>
                `;
            },
            cellClick: (event, cell) => {
                const button = event.target.closest("button");
                if (!button) {
                    return;
                }

                const row = cell.getRow();

                if (button.classList.contains("hcm-row-view")) {
                    showRowView(row);
                    return;
                }

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
        showRowView,
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
