const timeRuleRowEditor = createTableRowEditor({
    primaryKey: "time_rule_id",
    editableFields: [
        "time_rule_name",
        "earliest_in",
        "latest_in",
        "earliest_out",
        "latest_out",
        "lunch_start",
        "lunch_end",
        "lunch_grace_period",
    ],
    patchUrlBase: "/api/time_rules/",
    deleteUrlBase: "/api/time_rules/",
    deleteConfirmMessage: "Delete this time rule?",
    bulkDeleteConfirmMessage: "Delete the selected time rules?",
});

const timeRuleFactory = new tableFactory({
    el: "#time-rules-table",
    api: {
        list: "/api/time_rules/",
        detail: "/api/time_rules/",
    },
    primaryKey: "time_rule_id",
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
            field: "time_rule_id",
            hozAlign: "center",
            headerSort: true,
            width: 110,
        },
        {
            title: "Time Rule Name",
            field: "time_rule_name",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
            widthGrow: 2,
        },
        {
            title: "Earliest In",
            field: "earliest_in",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Latest In",
            field: "latest_in",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Earliest Out",
            field: "earliest_out",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Latest Out",
            field: "latest_out",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Lunch Start",
            field: "lunch_start",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Lunch End",
            field: "lunch_end",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
        },
        {
            title: "Lunch Grace Period (min)",
            field: "lunch_grace_period",
            editable: cell => timeRuleRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            headerSort: true,
            width: 200,
        },
        timeRuleRowEditor.buildActionsColumn({ width: 190 }),
    ],
});

const timeRuleTable = timeRuleFactory.create();
timeRuleRowEditor.attachTable(timeRuleTable);
bindTableSearchInput("table-search", timeRuleFactory);
bindBulkEditActionButtons(timeRuleRowEditor, {
    editAllButton: document.getElementById("edit-all-time-rules-btn"),
    saveAllButton: document.getElementById("save-all-time-rules-btn"),
    cancelAllButton: document.getElementById("cancel-all-time-rules-btn"),
});
bindSelectionActionButton(
    timeRuleTable,
    document.getElementById("delete-selected-time-rules-btn")
);
const timeRuleModalElement = document.getElementById("addTimeRuleModal");
const timeRuleModal = new bootstrap.Modal(timeRuleModalElement);
const timeRuleForm = document.getElementById("add-time-rule-form");

document.getElementById("add-time-rule-btn").addEventListener("click", () => {
    timeRuleForm.reset();
    timeRuleModal.show();
});

document.getElementById("delete-selected-time-rules-btn").addEventListener("click", () => {
    timeRuleRowEditor.deleteSelectedRows({
        emptySelectionMessage: "Select at least one time rule to delete.",
    });
});

timeRuleForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = {
        time_rule_name: document.getElementById("add-time-rule-name").value.trim(),
        earliest_in: document.getElementById("add-earliest-in").value.trim(),
        latest_in: document.getElementById("add-latest-in").value.trim(),
        earliest_out: document.getElementById("add-earliest-out").value.trim(),
        latest_out: document.getElementById("add-latest-out").value.trim(),
        lunch_start: document.getElementById("add-lunch-start").value.trim(),
        lunch_end: document.getElementById("add-lunch-end").value.trim(),
        lunch_grace_period: document.getElementById("add-lunch-grace-period").value.trim(),
    };

    const requiredValues = Object.values(payload);
    if (requiredValues.some(value => !value)) {
        alert("Please complete all required fields.");
        return;
    }

    try {
        const response = await fetch("/api/time_rules/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to add time rule"));
        }

        timeRuleModal.hide();
        timeRuleForm.reset();
        timeRuleRowEditor.reset();
        timeRuleTable.replaceData();
    } catch (err) {
        alert(err.message);
    }
});
