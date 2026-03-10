function createEditingState() {
    return {
        mode: null,
        rowId: null,
        originalRows: new Map(),
    };
}

const editingRows = {
    division: createEditingState(),
    employee: createEditingState(),
};

const approverEditableFields = [
    "division_id",
    "employee_id",
    "immediate_supervisor",
    "alt_supervisor",
    "division_chief",
    "alt_division_chief",
    "hr_approver",
    "alt_hr_approver",
];

function getApproverViewFields(type) {
    return [
        {
            label: type === "division" ? "Division" : "Employee",
            field: getTargetField(type),
            format: ({ value }) => type === "division"
                ? formatDivisionReference(value)
                : formatEmployeeReference(value),
        },
        {
            label: "Immediate Supervisor",
            field: "immediate_supervisor",
            format: ({ value }) => formatEmployeeReference(value),
        },
        {
            label: "Alt Supervisor",
            field: "alt_supervisor",
            format: ({ value }) => formatEmployeeReference(value),
        },
        {
            label: "Division Chief",
            field: "division_chief",
            format: ({ value }) => formatEmployeeReference(value),
        },
        {
            label: "Alt Division Chief",
            field: "alt_division_chief",
            format: ({ value }) => formatEmployeeReference(value),
        },
        {
            label: "HR Approver",
            field: "hr_approver",
            format: ({ value }) => formatEmployeeReference(value),
        },
        {
            label: "Alt HR Approver",
            field: "alt_hr_approver",
            format: ({ value }) => formatEmployeeReference(value),
        },
    ];
}

function viewApproverRow(type, row) {
    showTableRowView({
        title: rowData => type === "division"
            ? `Division Approvers: ${formatDivisionReference(rowData.division_id)}`
            : `Employee Approvers: ${formatEmployeeReference(rowData.employee_id)}`,
        subtitle: type === "division"
            ? "Configured Division Approval Chain"
            : "Configured Employee Approval Chain",
        rowData: row.getData(),
        fields: getApproverViewFields(type),
        onDelete: () => deleteApprover(row, type),
        editLabel: "Edit Row",
        deleteLabel: "Delete Row",
        editConfig: {
            editableFields: [
                getTargetField(type),
                ...approverEditableFields.filter(field => !["division_id", "employee_id"].includes(field)),
            ],
            getFieldDefinition: field => getTableByType(type)?.getColumn(field)?.getDefinition() || null,
            onStartEdit: () => {
                const state = getEditingState(type);
                if (state.mode) {
                    alert("Save or cancel the current edits before editing from the modal.");
                    return false;
                }

                return true;
            },
            onSave: async ({ originalData, draftData }) => {
                const payload = buildApproverPayloadFromData(type, originalData, draftData);
                if (!Object.keys(payload).length) {
                    return cloneRowData(row.getData());
                }

                const updated = await patchApprover(row.getData().approver_id, payload);
                await Promise.resolve(row.update(updated));
                return cloneRowData(row.getData());
            },
        },
    });
}

const editAllRowsButton = document.getElementById("edit-all-rows-btn");
const saveAllRowsButton = document.getElementById("save-all-rows-btn");
const cancelAllRowsButton = document.getElementById("cancel-all-rows-btn");
const deleteSelectedApproversButton = document.getElementById("delete-selected-approvers-btn");

let divisionTable;
let employeeTable;

function getEditingState(type) {
    return editingRows[type];
}

function getTableByType(type) {
    return type === "division" ? divisionTable : employeeTable;
}

function getTargetField(type) {
    return type === "division" ? "division_id" : "employee_id";
}

function findApproverRow(table, rowId) {
    if (!table) {
        return null;
    }

    try {
        const directRow = table.getRow(rowId);
        if (directRow) {
            return directRow;
        }
    } catch (err) {
        console.warn("Approver row lookup fallback triggered:", err);
    }

    return table.getRows("active").find(row => String(row.getData().approver_id) === String(rowId)) || null;
}

function getActiveApproverType() {
    return document.querySelector("#approverTabs .nav-link.active")?.dataset.tableKey || "division";
}

function cloneRowData(rowData) {
    return JSON.parse(JSON.stringify(rowData));
}

function waitForEditorCommit() {
    return new Promise(resolve => {
        window.setTimeout(resolve, 0);
    });
}

async function flushPendingEditor(table) {
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === "function") {
        activeElement.blur();
    }

    await waitForEditorCommit();
    await waitForEditorCommit();

    if (table && typeof table.redraw === "function") {
        table.redraw(true);
        await waitForEditorCommit();
    }
}

function normalizeApproverFieldValue(field, value) {
    if (field === "division_id") {
        return resolveDivisionReference(value);
    }

    if (approverEditableFields.includes(field)) {
        return resolveEmployeeReference(value);
    }

    return value;
}

function clearEditingState(type) {
    const state = getEditingState(type);
    state.mode = null;
    state.rowId = null;
    state.originalRows = new Map();
}

function syncBulkEditButtons() {
    const activeType = getActiveApproverType();
    const state = getEditingState(activeType);
    const isBulkEditing = state.mode === "all";
    const isSingleEditing = state.mode === "single";

    editAllRowsButton.classList.toggle("d-none", isBulkEditing);
    editAllRowsButton.disabled = isSingleEditing;
    saveAllRowsButton.classList.toggle("d-none", !isBulkEditing);
    cancelAllRowsButton.classList.toggle("d-none", !isBulkEditing);
}

function syncDeleteSelectedApproversButton() {
    const table = getTableByType(getActiveApproverType());
    const hasSelection = table ? table.getSelectedRows().length > 0 : false;
    deleteSelectedApproversButton.classList.toggle("d-none", !hasSelection);
}

function isEditingRow(type, rowData) {
    const state = getEditingState(type);

    if (state.mode === "all") {
        return state.originalRows.has(rowData.approver_id);
    }

    return state.mode === "single" && state.rowId === rowData.approver_id;
}

function getOriginalRowData(type, rowId) {
    return getEditingState(type).originalRows.get(rowId) || null;
}

function buildApproverPayload(type, row) {
    const rowData = row.getData();
    const originalData = getOriginalRowData(type, rowData.approver_id);

    if (!originalData) {
        return {};
    }

    return buildApproverPayloadFromData(type, originalData, rowData);
}

function buildApproverPayloadFromData(type, originalData, rowData) {
    const payload = {};
    const relevantFields = [
        getTargetField(type),
        ...approverEditableFields.filter(field => !["division_id", "employee_id"].includes(field)),
    ];

    relevantFields.forEach(field => {
        const originalValue = normalizeApproverFieldValue(field, originalData[field] ?? null);
        const currentValue = normalizeApproverFieldValue(field, rowData[field] ?? null);

        if (String(originalValue ?? "") !== String(currentValue ?? "")) {
            payload[field] = currentValue;
        }
    });

    return payload;
}

function hasPendingRowChanges(type, row) {
    return Object.keys(buildApproverPayload(type, row)).length > 0;
}

function redrawApproverTable(type) {
    const table = getTableByType(type);
    if (!table) {
        return;
    }

    table.redraw(true);

    if (getActiveApproverType() === type) {
        syncBulkEditButtons();
    }
}

function exitEditMode(type) {
    clearEditingState(type);
    redrawApproverTable(type);
}

function enterEditMode(type, row) {
    const state = getEditingState(type);
    const rowData = row.getData();

    if (state.mode === "all") {
        alert("Save or cancel all rows before editing a single row.");
        return;
    }

    if (state.mode === "single" && state.rowId && state.rowId !== rowData.approver_id) {
        const currentRow = findApproverRow(row.getTable(), state.rowId);
        if (currentRow && hasPendingRowChanges(type, currentRow)) {
            alert("Save or cancel the current row before editing another one.");
            return;
        }
    }

    state.mode = "single";
    state.rowId = rowData.approver_id;
    state.originalRows = new Map([
        [rowData.approver_id, cloneRowData(rowData)],
    ]);

    redrawApproverTable(type);
    row.getCell(getTargetField(type))?.edit();
}

function enterBulkEditMode(type) {
    const table = getTableByType(type);
    const state = getEditingState(type);

    if (!table) {
        return;
    }

    if (state.mode === "single") {
        const currentRow = findApproverRow(table, state.rowId);
        if (currentRow && hasPendingRowChanges(type, currentRow)) {
            alert("Save or cancel the current row before editing all rows.");
            return;
        }
    }

    const rows = table.getRows("active");
    if (!rows.length) {
        return;
    }

    state.mode = "all";
    state.rowId = null;
    state.originalRows = new Map(
        rows.map(row => [row.getData().approver_id, cloneRowData(row.getData())])
    );

    redrawApproverTable(type);
}

async function cancelRowEdit(type, row) {
    const originalData = getOriginalRowData(type, row.getData().approver_id);

    if (!originalData) {
        exitEditMode(type);
        return;
    }

    await flushPendingEditor(row.getTable());
    await Promise.resolve(row.update(cloneRowData(originalData)));
    exitEditMode(type);
}

async function saveRowEdit(type, row) {
    if (getEditingState(type).mode !== "single") {
        return;
    }

    await flushPendingEditor(row.getTable());

    const payload = buildApproverPayload(type, row);
    if (!Object.keys(payload).length) {
        exitEditMode(type);
        return;
    }

    try {
        const updated = await patchApprover(row.getData().approver_id, payload);
        await Promise.resolve(row.update(updated));
        exitEditMode(type);
    } catch (err) {
        alert(err.message);
    }
}

async function cancelAllRowEdits(type) {
    const table = getTableByType(type);
    const state = getEditingState(type);

    if (!table || state.mode !== "all") {
        return;
    }

    await flushPendingEditor(table);

    const restoreJobs = Array.from(state.originalRows.entries()).map(([rowId, originalData]) => {
        const row = findApproverRow(table, rowId);
        return row ? Promise.resolve(row.update(cloneRowData(originalData))) : Promise.resolve();
    });

    await Promise.all(restoreJobs);
    exitEditMode(type);
}

async function saveAllRowEdits(type) {
    const table = getTableByType(type);
    const state = getEditingState(type);

    if (!table || state.mode !== "all") {
        return;
    }

    await flushPendingEditor(table);

    const failedMessages = [];

    for (const [rowId] of state.originalRows.entries()) {
        const row = findApproverRow(table, rowId);
        if (!row) {
            continue;
        }

        const payload = buildApproverPayload(type, row);
        if (!Object.keys(payload).length) {
            state.originalRows.set(rowId, cloneRowData(row.getData()));
            continue;
        }

        try {
            const updated = await patchApprover(rowId, payload);
            await Promise.resolve(row.update(updated));
            state.originalRows.set(rowId, cloneRowData(row.getData()));
        } catch (err) {
            failedMessages.push(`Row ${rowId}: ${err.message}`);
        }
    }

    if (failedMessages.length) {
        redrawApproverTable(type);
        alert(failedMessages.join("\n"));
        return;
    }

    exitEditMode(type);
}

function getEmployeeEditorParams(clearable = true) {
    return buildSearchableListEditorParams(employeeState.options, {
        clearable,
        placeholder: "Select employee",
        searchPlaceholder: "Search employees",
        searchCategory: "person",
    });
}

function getDivisionEditorParams() {
    return buildSearchableListEditorParams(divisionState.options, {
        clearable: false,
        placeholder: "Select division",
        searchPlaceholder: "Search divisions",
    });
}

function approverColumns(type) {
    return [
        {
            formatter: "rowSelection",
            titleFormatter: "rowSelection",
            hozAlign: "left",
            headerSort: false,
            width: 50,
        },
        {
            title: type === "division" ? "Division" : "Employee",
            field: getTargetField(type),
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => type === "division"
                ? formatDivisionReference(cell.getValue())
                : formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => type === "division"
                ? getDivisionEditorParams()
                : getEmployeeEditorParams(false),
            headerSort: true,
            width: 300,
        },
        {
            title: "Immediate Supervisor",
            field: "immediate_supervisor",
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => getEmployeeEditorParams(true),
        },
        {
            title: "Alt Supervisor",
            field: "alt_supervisor",
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => getEmployeeEditorParams(true),
        },
        {
            title: "Division Chief",
            field: "division_chief",
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => getEmployeeEditorParams(true),
        },
        {
            title: "Alt Division Chief",
            field: "alt_division_chief",
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => getEmployeeEditorParams(true),
        },
        {
            title: "HR Approver",
            field: "hr_approver",
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => getEmployeeEditorParams(true),
        },
        {
            title: "Alt HR Approver",
            field: "alt_hr_approver",
            editable: cell => isEditingRow(type, cell.getRow().getData()),
            formatter: cell => formatEmployeeReference(cell.getValue()),
            editor: searchableDropdownEditor,
            editorParams: () => getEmployeeEditorParams(true),
        },
        {
            title: "Actions",
            headerSort: false,
            width: 190,
            hozAlign: "center",
            formatter: cell => {
                const state = getEditingState(type);
                const editing = isEditingRow(type, cell.getRow().getData());
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

                if (state.mode === "all") {
                    return `
                        <div class="d-flex gap-1 justify-content-center align-items-center hcm-table-actions">
                            ${iconButton("approver-view", "btn-outline-secondary", "ti ti-eye", "View")}
                            <span class="badge text-bg-light align-self-center">Editing</span>
                            ${iconButton("approver-delete", "btn-danger", "ti ti-trash", "Delete")}
                        </div>
                    `;
                }

                return `
                    <div class="d-flex gap-1 justify-content-center align-items-center hcm-table-actions">
                        ${iconButton("approver-view", "btn-outline-secondary", "ti ti-eye", "View")}
                        ${editing
                            ? iconButton("approver-save", "btn-success", "ti ti-device-floppy", "Save")
                            : iconButton("approver-edit", "btn-primary", "ti ti-pencil", "Edit")}
                        ${editing ? iconButton("approver-cancel", "btn-secondary", "ti ti-x", "Cancel") : ""}
                        ${iconButton("approver-delete", "btn-danger", "ti ti-trash", "Delete")}
                    </div>
                `;
            },
            cellClick: (e, cell) => {
                const button = e.target.closest("button");
                if (!button) {
                    return;
                }

                const row = cell.getRow();

                if (button.classList.contains("approver-view")) {
                    viewApproverRow(type, row);
                    return;
                }

                if (button.classList.contains("approver-edit")) {
                    enterEditMode(type, row);
                    return;
                }

                if (button.classList.contains("approver-save")) {
                    window.setTimeout(() => {
                        saveRowEdit(type, row);
                    }, 0);
                    return;
                }

                if (button.classList.contains("approver-cancel")) {
                    window.setTimeout(() => {
                        cancelRowEdit(type, row).catch(err => alert(err.message));
                    }, 0);
                    return;
                }

                if (button.classList.contains("approver-delete")) {
                    deleteApprover(row, type);
                }
            },
        },
    ];
}

function populateSelectOptions(select, options, placeholder) {
    if (!select) {
        return;
    }

    const currentValue = select.value;
    const optionHtml = [`<option value="">${placeholder}</option>`]
        .concat(options.map(option => `<option value="${option.value}">${option.label}</option>`))
        .join("");

    select.innerHTML = optionHtml;
    if (currentValue && options.some(option => String(option.value) === String(currentValue))) {
        select.value = currentValue;
    }

    refreshSearchableSelect(select);
}

function populateApproverModalOptions() {
    populateSelectOptions(
        document.getElementById("add-division"),
        divisionState.options,
        "Select Division"
    );

    const employeeSelectIds = [
        "add-employee",
        "add-immediate-supervisor",
        "add-alt-supervisor",
        "add-division-chief",
        "add-alt-division-chief",
        "add-hr-approver",
        "add-alt-hr-approver",
    ];

    employeeSelectIds.forEach(selectId => {
        populateSelectOptions(
            document.getElementById(selectId),
            employeeState.options,
            "Select Employee"
        );
    });
}

function getErrorMessage(response) {
    return response.json()
        .then(data => {
            if (typeof data === "string") {
                return data;
            }

            if (Array.isArray(data)) {
                return data.join(", ");
            }

            return Object.entries(data)
                .map(([field, messages]) => `${field}: ${[].concat(messages).join(", ")}`)
                .join(" | ");
        })
        .catch(() => "Request failed");
}

function parseOptionalInt(value) {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function patchApprover(id, payload) {
    return fetch(`/api/approvers/${id}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken,
        },
        body: JSON.stringify(payload),
    }).then(res => {
        if (res.ok) {
            return res.json();
        }

        return getErrorMessage(res).then(message => {
            throw new Error(message || "Failed to save");
        });
    });
}

async function performApproverDelete(row, type, { skipConfirm = false } = {}) {
    const data = row.getData();
    if (!skipConfirm) {
        const confirmed = await showSystemConfirm("Delete this approver?", {
            title: "Delete Approver?",
            confirmLabel: "Delete",
            tone: "danger",
        });

        if (!confirmed) {
            return;
        }
    }

    const res = await fetch(`/api/approvers/${data.approver_id}/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": csrftoken },
    });

    if (!res.ok) {
        throw new Error(await getErrorMessage(res));
    }

    const state = getEditingState(type);
    if (state.mode === "single" && state.rowId === data.approver_id) {
        clearEditingState(type);
    }

    if (state.mode === "all") {
        state.originalRows.delete(data.approver_id);
        if (!state.originalRows.size) {
            clearEditingState(type);
        }
    }

    await Promise.resolve(row.delete());
    redrawApproverTable(type);
}

function deleteApprover(row, type) {
    performApproverDelete(row, type).catch(err => alert(err.message));
}

async function deleteSelectedApprovers() {
    const type = getActiveApproverType();
    const table = getTableByType(type);
    const state = getEditingState(type);

    if (!table) {
        return;
    }

    if (state.mode) {
        alert("Save or cancel the current edits before deleting selected rows.");
        return;
    }

    const rows = table.getSelectedRows();
    if (!rows.length) {
        alert("Select at least one approver to delete.");
        return;
    }

    const confirmed = await showSystemConfirm(
        `Delete ${rows.length} selected approver${rows.length === 1 ? "" : "s"}?`,
        {
            title: "Delete Selected Approvers?",
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
            await performApproverDelete(row, type, { skipConfirm: true });
        } catch (err) {
            failedMessages.push(`Row ${row.getData().approver_id}: ${err.message}`);
        }
    }

    if (failedMessages.length) {
        alert(failedMessages.join("\n"));
    }
}

function reloadTables() {
    clearEditingState("division");
    clearEditingState("employee");

    if (divisionTable) {
        divisionTable.replaceData();
    }

    if (employeeTable) {
        employeeTable.replaceData();
    }

    syncBulkEditButtons();
    syncDeleteSelectedApproversButton();
}

const approverModalElement = document.getElementById("addApproverModal");
const approverForm = document.getElementById("add-approver-form");
const modal = new bootstrap.Modal(approverModalElement);

Promise.all([loadEmployees(), loadDivisions()])
    .then(() => {
        populateApproverModalOptions();

        [
            "add-employee",
            "add-immediate-supervisor",
            "add-alt-supervisor",
            "add-division-chief",
            "add-alt-division-chief",
            "add-hr-approver",
            "add-alt-hr-approver",
        ].forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.dataset.searchCategory = "person";
            }
        });

        initializeSearchableSelects(approverModalElement, {
            selector: "select",
            searchPlaceholder: "Search records",
        });

        const divisionApproverTable = new tableFactory({
            el: "#division-approvers-table",
            api: {
                list: "/api/approvers/",
                detail: "/api/approvers/",
            },
            primaryKey: "approver_id",
            autoSaveEdits: false,
            ajaxResponse: (url, params, response) =>
                response.filter(record => record.approval_type === "division"),
            columns: approverColumns("division"),
        });

        const employeeApproverTable = new tableFactory({
            el: "#employee-approvers-table",
            api: {
                list: "/api/approvers/",
                detail: "/api/approvers/",
            },
            primaryKey: "approver_id",
            autoSaveEdits: false,
            ajaxResponse: (url, params, response) =>
                response.filter(record => record.approval_type === "employee"),
            columns: approverColumns("employee"),
        });

        divisionTable = divisionApproverTable.create();
        employeeTable = employeeApproverTable.create();

        if (typeof divisionTable.on === "function") {
            divisionTable.on("rowSelectionChanged", syncDeleteSelectedApproversButton);
        }

        if (typeof employeeTable.on === "function") {
            employeeTable.on("rowSelectionChanged", syncDeleteSelectedApproversButton);
        }

        new tabSearch("table-search", {
            "division-tab": divisionApproverTable,
            "employee-tab": employeeApproverTable,
        });

        syncBulkEditButtons();
        syncDeleteSelectedApproversButton();
    })
    .catch(err => {
        console.error("Failed to load initial data:", err);
        alert("Failed to load employees or divisions. Approver tables may not function correctly.");
    });

editAllRowsButton.addEventListener("click", () => {
    enterBulkEditMode(getActiveApproverType());
});

saveAllRowsButton.addEventListener("click", () => {
    window.setTimeout(() => {
        saveAllRowEdits(getActiveApproverType()).catch(err => alert(err.message));
    }, 0);
});

cancelAllRowsButton.addEventListener("click", () => {
    window.setTimeout(() => {
        cancelAllRowEdits(getActiveApproverType()).catch(err => alert(err.message));
    }, 0);
});

deleteSelectedApproversButton.addEventListener("click", () => {
    window.setTimeout(() => {
        deleteSelectedApprovers().catch(err => alert(err.message));
    }, 0);
});

document.querySelectorAll("#approverTabs [data-bs-toggle='tab']").forEach(tab => {
    tab.addEventListener("shown.bs.tab", () => {
        syncBulkEditButtons();
        syncDeleteSelectedApproversButton();
    });
});

document.getElementById("add-approver-btn")
    .addEventListener("click", () => {
        approverForm.reset();
        populateApproverModalOptions();
        modal.show();
    });

approverForm
    .addEventListener("submit", e => {
        e.preventDefault();

        const payload = {
            approval_type: document.getElementById("add-approver-type").value,
            division_id: parseOptionalInt(document.getElementById("add-division").value),
            employee_id: parseOptionalInt(document.getElementById("add-employee").value),
            immediate_supervisor: parseOptionalInt(document.getElementById("add-immediate-supervisor").value),
            alt_supervisor: parseOptionalInt(document.getElementById("add-alt-supervisor").value),
            division_chief: parseOptionalInt(document.getElementById("add-division-chief").value),
            alt_division_chief: parseOptionalInt(document.getElementById("add-alt-division-chief").value),
            hr_approver: parseOptionalInt(document.getElementById("add-hr-approver").value),
            alt_hr_approver: parseOptionalInt(document.getElementById("add-alt-hr-approver").value),
        };

        if (!payload.approval_type || !payload.immediate_supervisor || !payload.division_chief || !payload.hr_approver) {
            alert("Please complete all required fields.");
            return;
        }

        fetch("/api/approvers/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        })
            .then(res => {
                if (res.ok) {
                    return res.json();
                }

                return getErrorMessage(res).then(message => {
                    throw new Error(message || "Failed to create");
                });
            })
            .then(() => {
                modal.hide();
                approverForm.reset();
                populateApproverModalOptions();
                reloadTables();
            })
            .catch(err => alert(err.message));
    });
