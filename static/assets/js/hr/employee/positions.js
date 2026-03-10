Promise.all([loadSalaryGrades()]).then(() => {
    const positionViewFields = [
        { label: "Position ID", field: "position_id" },
        { label: "Position Name", field: "position_name" },
        {
            label: "Standard Salary Grade",
            field: "standard_salary_grade",
            format: ({ rowData }) => rowData.standard_csc_grade ? `SG ${rowData.standard_csc_grade}` : "Not set",
        },
        { label: "Description", field: "description", fullWidth: true },
    ];

    const positionRowEditor = createTableRowEditor({
        primaryKey: "position_id",
        editableFields: [
            "position_name",
            "description",
            "standard_salary_grade",
        ],
        viewFields: positionViewFields,
        getViewTitle: rowData => `Position Record: ${rowData.position_name}`,
        getViewSubtitle: rowData => `Record ID ${rowData.position_id}`,
        patchUrlBase: "/api/positions/",
        deleteUrlBase: "/api/positions/",
        deleteConfirmMessage: "Delete this position?",
        bulkDeleteConfirmMessage: "Delete the selected positions?",
        serializeFieldValue: ({ field, value }) => {
            if (field === "standard_salary_grade") {
                return resolveSalaryGradeReference(value);
            }

            return value === "" ? null : value;
        },
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
                width: 260,
            },
            {
                title: "Standard SG",
                field: "standard_salary_grade",
                editable: cell => positionRowEditor.isEditingRow(cell.getRow().getData()),
                editor: searchableDropdownEditor,
                editorParams: () => buildSearchableListEditorParams(salaryGradeState.options, {
                    clearable: false,
                    placeholder: "Select salary grade",
                    searchPlaceholder: "Search salary grades",
                }),
                formatter: cell => {
                    const rowData = cell.getRow().getData();
                    if (rowData.standard_csc_grade !== null && rowData.standard_csc_grade !== undefined) {
                        return `SG ${rowData.standard_csc_grade}`;
                    }

                    return formatSalaryGradeReference(cell.getValue());
                },
                headerSort: true,
                width: 160,
            },
            {
                title: "Description",
                field: "description",
                editable: cell => positionRowEditor.isEditingRow(cell.getRow().getData()),
                editor: "input",
                headerSort: true,
            },
            positionRowEditor.buildActionsColumn({ width: 190 }),
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
    const standardSalaryGradeSelect = document.getElementById("add-standard-salary-grade");

    initializeSearchableSelects(positionModalElement, {
        selector: "select",
        searchPlaceholder: "Search salary grades",
    });

    document.getElementById("add-position-btn").addEventListener("click", () => {
        positionForm.reset();
        populateLookupSelect(standardSalaryGradeSelect, salaryGradeState.options, "Select salary grade");
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
            standard_salary_grade: resolveSalaryGradeReference(standardSalaryGradeSelect.value),
        };

        if (!payload.position_name || !payload.description || !payload.standard_salary_grade) {
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
            loadPositions();
        } catch (err) {
            alert(err.message);
        }
    });
}).catch(err => {
    console.error("Failed to initialize positions page:", err);
    alert("Failed to initialize the positions page.");
});
