function buildListEditorParams(options, clearable = false) {
    return buildSearchableListEditorParams(options, {
        clearable,
        placeholder: "Select an option",
        searchPlaceholder: "Search records",
    });
}

function populateLookupSelect(select, options, placeholder) {
    const optionMarkup = [`<option value="">${placeholder}</option>`]
        .concat(options.map(option => `<option value="${option.value}">${option.label}</option>`))
        .join("");

    select.innerHTML = optionMarkup;
    refreshSearchableSelect(select);
}

Promise.all([loadDivisions(), loadPositions()])
    .then(() => {
        const employeeViewFields = [
            { label: "Employee ID", field: "employee_id" },
            { label: "First Name", field: "first_name" },
            { label: "Last Name", field: "last_name" },
            {
                label: "Position",
                field: "position",
                format: ({ value }) => formatPositionReference(value),
            },
            {
                label: "Division",
                field: "division",
                format: ({ value }) => formatDivisionReference(value),
            },
        ];

        const employeeRowEditor = createTableRowEditor({
            primaryKey: "id",
            editableFields: [
                "employee_id",
                "first_name",
                "last_name",
                "position",
                "division",
            ],
            viewFields: employeeViewFields,
            getViewTitle: rowData => `Employee Record: ${rowData.first_name} ${rowData.last_name}`,
            getViewSubtitle: rowData => `Employee No. ${rowData.employee_id}`,
            patchUrlBase: "/api/employees/",
            deleteUrlBase: "/api/employees/",
            deleteConfirmMessage: "Delete this employee?",
            bulkDeleteConfirmMessage: "Delete the selected employees?",
            serializeFieldValue: ({ field, value }) => {
                if (field === "division") {
                    return resolveDivisionReference(value);
                }

                if (field === "position") {
                    return resolvePositionReference(value);
                }

                return value === "" ? null : value;
            },
        });

        const employeeFactory = new tableFactory({
            el: "#employees-table",
            api: {
                list: "/api/employees/",
                detail: "/api/employees/",
            },
            primaryKey: "id",
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
                    title: "Employee ID",
                    field: "employee_id",
                    editable: cell => employeeRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: "input",
                    headerSort: true,
                    width: 160,
                },
                {
                    title: "First Name",
                    field: "first_name",
                    editable: cell => employeeRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: "input",
                    headerSort: true,
                },
                {
                    title: "Last Name",
                    field: "last_name",
                    editable: cell => employeeRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: "input",
                    headerSort: true,
                },
                {
                    title: "Position",
                    field: "position",
                    editable: cell => employeeRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: () => buildListEditorParams(positionState.options, false),
                    formatter: cell => formatPositionReference(cell.getValue()),
                    headerSort: true,
                },
                {
                    title: "Division",
                    field: "division",
                    editable: cell => employeeRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: () => buildListEditorParams(divisionState.options, false),
                    formatter: cell => formatDivisionReference(cell.getValue()),
                    headerSort: true,
                },
                employeeRowEditor.buildActionsColumn({ width: 190 }),
            ],
        });

        const employeeTable = employeeFactory.create();
        employeeRowEditor.attachTable(employeeTable);
        bindTableSearchInput("table-search", employeeFactory);
        bindBulkEditActionButtons(employeeRowEditor, {
            editAllButton: document.getElementById("edit-all-employees-btn"),
            saveAllButton: document.getElementById("save-all-employees-btn"),
            cancelAllButton: document.getElementById("cancel-all-employees-btn"),
        });
        bindSelectionActionButton(
            employeeTable,
            document.getElementById("delete-selected-employees-btn")
        );
        const employeeModalElement = document.getElementById("addEmployeeModal");
        const employeeModal = new bootstrap.Modal(employeeModalElement);
        const employeeForm = document.getElementById("add-employee-form");
        const divisionSelect = document.getElementById("add-division");
        const positionSelect = document.getElementById("add-position");

        initializeSearchableSelects(employeeModalElement, {
            selector: "select",
            searchPlaceholder: "Search records",
        });

        document.getElementById("add-employee-btn").addEventListener("click", () => {
            if (!divisionState.options.length || !positionState.options.length) {
                alert("Division and position lookups are not available. Please refresh and try again.");
                return;
            }

            employeeForm.reset();
            populateLookupSelect(positionSelect, positionState.options, "Select position");
            populateLookupSelect(divisionSelect, divisionState.options, "Select division");
            employeeModal.show();
        });

        document.getElementById("delete-selected-employees-btn").addEventListener("click", () => {
            employeeRowEditor.deleteSelectedRows({
                emptySelectionMessage: "Select at least one employee to delete.",
            });
        });

        employeeForm.addEventListener("submit", async event => {
            event.preventDefault();

            const payload = {
                employee_id: document.getElementById("add-employee-id").value.trim(),
                first_name: document.getElementById("add-first-name").value.trim(),
                last_name: document.getElementById("add-last-name").value.trim(),
                position: resolvePositionReference(positionSelect.value),
                division: resolveDivisionReference(divisionSelect.value),
            };

            if (!payload.employee_id || !payload.first_name || !payload.last_name || !payload.position || !payload.division) {
                alert("Please complete all required fields.");
                return;
            }

            try {
                const response = await fetch("/api/employees/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrftoken,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(await readApiError(response, "Failed to add employee"));
                }

                employeeModal.hide();
                employeeForm.reset();
                employeeRowEditor.reset();
                employeeTable.replaceData();
            } catch (err) {
                alert(err.message);
            }
        });
    })
    .catch(err => {
        console.error("Failed to initialize employee table lookups:", err);
        alert("Failed to initialize employee information page.");
    });
