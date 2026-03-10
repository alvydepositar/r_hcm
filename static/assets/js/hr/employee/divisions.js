const divisionViewFields = [
    { label: "Division ID", field: "division_id" },
    { label: "Division Name", field: "division_name" },
    { label: "Abbreviation", field: "division_abbreviation" },
];

const divisionRowEditor = createTableRowEditor({
    primaryKey: "division_id",
    editableFields: [
        "division_name",
        "division_abbreviation",
    ],
    viewFields: divisionViewFields,
    getViewTitle: rowData => `Division Record: ${rowData.division_name}`,
    getViewSubtitle: rowData => `Record ID ${rowData.division_id}`,
    patchUrlBase: "/api/divisions/",
    deleteUrlBase: "/api/divisions/",
    deleteConfirmMessage: "Delete this division?",
    bulkDeleteConfirmMessage: "Delete the selected divisions?",
});

const divisionFactory = new tableFactory({
    el: "#divisions-table",
    api: {
        list: "/api/divisions/",
        detail: "/api/divisions/",
    },
    primaryKey: "division_id",
    autoSaveEdits: false,
    columns: [
        {
            formatter: "rowSelection",
            titleFormatter: "rowSelection",
            hozAlign: "left",
            headerSort: false,
            width: 50,
        },
        {
            title: "Division ID",
            field: "division_id",
            hozAlign: "center",
            headerSort: true,
            width: 140,
        },
        {
            title: "Division Name",
            field: "division_name",
            editable: cell => divisionRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Abbreviation",
            field: "division_abbreviation",
            editable: cell => divisionRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        divisionRowEditor.buildActionsColumn({ width: 190 }),
    ],
});

const divisionTable = divisionFactory.create();
divisionRowEditor.attachTable(divisionTable);
bindTableSearchInput("table-search", divisionFactory);
bindBulkEditActionButtons(divisionRowEditor, {
    editAllButton: document.getElementById("edit-all-divisions-btn"),
    saveAllButton: document.getElementById("save-all-divisions-btn"),
    cancelAllButton: document.getElementById("cancel-all-divisions-btn"),
});
bindSelectionActionButton(
    divisionTable,
    document.getElementById("delete-selected-divisions-btn")
);
const divisionModalElement = document.getElementById("addDivisionModal");
const divisionModal = new bootstrap.Modal(divisionModalElement);
const divisionForm = document.getElementById("add-division-form");

document.getElementById("add-division-btn").addEventListener("click", () => {
    divisionForm.reset();
    divisionModal.show();
});

document.getElementById("delete-selected-divisions-btn").addEventListener("click", () => {
    divisionRowEditor.deleteSelectedRows({
        emptySelectionMessage: "Select at least one division to delete.",
    });
});

divisionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
        division_name: document.getElementById("add-division-name").value.trim(),
        division_abbreviation: document.getElementById("add-abbreviation").value.trim(),
    };

    if (!payload.division_name || !payload.division_abbreviation) {
        alert("Please complete all required fields.");
        return;
    }

    try {
        const response = await fetch("/api/divisions/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to add division"));
        }

        divisionModal.hide();
        divisionForm.reset();
        divisionRowEditor.reset();
        divisionTable.replaceData();
    } catch (err) {
        alert(err.message);
    }
});
