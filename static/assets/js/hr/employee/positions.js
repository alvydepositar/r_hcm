const positionRowEditor = createTableRowEditor({
    primaryKey: "position_id",
    editableFields: [
        "position_name",
        "description",
    ],
    patchUrlBase: "/api/positions/",
    deleteUrlBase: "/api/positions/",
    deleteConfirmMessage: "Delete this position?",
    bulkDeleteConfirmMessage: "Delete the selected positions?",
});

const positionFactory = new tableFactory({
    el: "#positions-table",
    api: {
        list: "/api/positions/",
        detail: "/api/positions/",
    },
    primaryKey: "position_id",
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
            title: "ID",
            field: "position_id",
            hozAlign: "center",
            headerSort: true,
            width: 120,
        },
        {
            title: "Position Name",
            field: "position_name",
            editable: cell => positionRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Description",
            field: "description",
            editable: cell => positionRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        positionRowEditor.buildActionsColumn(),
    ],
});

const positionTable = positionFactory.create();
positionRowEditor.attachTable(positionTable);
bindTableSearchInput("table-search", positionFactory);
bindBulkEditActionButtons(positionRowEditor, {
    editAllButton: document.getElementById("edit-all-positions-btn"),
    saveAllButton: document.getElementById("save-all-positions-btn"),
    cancelAllButton: document.getElementById("cancel-all-positions-btn"),
});
bindSelectionActionButton(
    positionTable,
    document.getElementById("delete-selected-positions-btn")
);
const positionModalElement = document.getElementById("addPositionModal");
const positionModal = new bootstrap.Modal(positionModalElement);
const positionForm = document.getElementById("add-position-form");

document.getElementById("add-position-btn").addEventListener("click", () => {
    positionForm.reset();
    positionModal.show();
});

document.getElementById("delete-selected-positions-btn").addEventListener("click", () => {
    positionRowEditor.deleteSelectedRows({
        emptySelectionMessage: "Select at least one position to delete.",
    });
});

positionForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
        position_name: document.getElementById("add-position-name").value.trim(),
        description: document.getElementById("add-description").value.trim(),
    };

    if (!payload.position_name || !payload.description) {
        alert("Please complete all required fields.");
        return;
    }

    try {
        const response = await fetch("/api/positions/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to add position"));
        }

        positionModal.hide();
        positionForm.reset();
        positionRowEditor.reset();
        positionTable.replaceData();
    } catch (err) {
        alert(err.message);
    }
});
