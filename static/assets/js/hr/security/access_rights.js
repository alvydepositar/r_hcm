Promise.all([loadEmployees()]).then(() => {
    const accessRightBooleanOptions = [
        { value: true, label: "Yes" },
        { value: false, label: "No" },
    ];

    let accessRightsTable = null;

    function normalizeBooleanValue(value) {
        if (value === true || value === "true" || value === 1 || value === "1") {
            return true;
        }

        if (value === false || value === "false" || value === 0 || value === "0") {
            return false;
        }

        return false;
    }

    function formatBooleanValue(value, trueLabel = "Yes", falseLabel = "No") {
        return normalizeBooleanValue(value) ? trueLabel : falseLabel;
    }

    function formatRoleNames(roleNames) {
        if (!Array.isArray(roleNames) || !roleNames.length) {
            return "No assigned roles";
        }

        return roleNames.join(", ");
    }

    function formatLastLogin(value) {
        if (!value) {
            return "Never";
        }

        try {
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
            }).format(new Date(value));
        } catch (err) {
            console.error("Failed to format last login:", err);
            return value;
        }
    }

    function getAssignedEmployeeIds({ excludeUserId = null, includeEmployeeId = null } = {}) {
        const assigned = new Set();
        const rows = accessRightsTable ? accessRightsTable.getData() : [];

        rows.forEach(row => {
            if (excludeUserId !== null && String(row.id) === String(excludeUserId)) {
                return;
            }

            const employeeId = resolveEmployeeReference(row.employee);
            if (employeeId !== null && employeeId !== undefined && employeeId !== "") {
                assigned.add(String(employeeId));
            }
        });

        if (includeEmployeeId !== null && includeEmployeeId !== undefined && includeEmployeeId !== "") {
            assigned.delete(String(includeEmployeeId));
        }

        return assigned;
    }

    function getAvailableEmployeeOptions({ excludeUserId = null, includeEmployeeId = null } = {}) {
        const assigned = getAssignedEmployeeIds({ excludeUserId, includeEmployeeId });

        return employeeState.options.filter(option => (
            !assigned.has(String(option.value))
            || String(option.value) === String(includeEmployeeId)
        ));
    }

    function buildEmployeeEditorParams(cell) {
        const rowData = cell.getRow().getData();
        return buildSearchableListEditorParams(
            getAvailableEmployeeOptions({
                excludeUserId: rowData.id,
                includeEmployeeId: rowData.employee,
            }),
            {
                clearable: true,
                placeholder: "Select employee",
                searchPlaceholder: "Search employees",
                searchCategory: "people",
            }
        );
    }

    const accessRightsViewFields = [
        { label: "User ID", field: "id" },
        { label: "Username", field: "username" },
        {
            label: "Linked Employee",
            field: "employee",
            format: ({ rowData, value }) => rowData.employee_name || formatEmployeeReference(value) || "Not linked",
        },
        { label: "Employee Number", field: "employee_number" },
        { label: "Division", field: "division_name" },
        { label: "Position", field: "position_name" },
        {
            label: "HR Access",
            field: "has_hr_access",
            format: ({ value }) => formatBooleanValue(value),
        },
        {
            label: "Recruitment Access",
            field: "has_recruitment_access",
            format: ({ value }) => formatBooleanValue(value),
        },
        {
            label: "Employee Portal Access",
            field: "has_employee_access",
            format: ({ value }) => formatBooleanValue(value),
        },
        {
            label: "Approver Queue Access",
            field: "has_approver_access",
            format: ({ value }) => formatBooleanValue(value),
        },
        {
            label: "Account Status",
            field: "is_active",
            format: ({ value }) => formatBooleanValue(value, "Active", "Inactive"),
        },
        {
            label: "Assigned Roles",
            field: "role_names",
            format: ({ value }) => formatRoleNames(value),
            fullWidth: true,
        },
        {
            label: "Last Login",
            field: "last_login",
            format: ({ value }) => formatLastLogin(value),
        },
    ];

    const accessRightsRowEditor = createTableRowEditor({
        primaryKey: "id",
        editableFields: [
            "username",
            "employee",
            "has_hr_access",
            "has_recruitment_access",
            "is_active",
        ],
        viewFields: accessRightsViewFields,
        getViewTitle: rowData => `Access Record: ${rowData.username}`,
        getViewSubtitle: rowData => rowData.employee_name
            ? `${rowData.employee_name} (${rowData.employee_number || "No employee number"})`
            : "Unlinked system account",
        patchUrlBase: "/api/access-rights/",
        deleteUrlBase: "/api/access-rights/",
        deleteConfirmMessage: "Delete this user account?",
        bulkDeleteConfirmMessage: "Delete the selected user accounts?",
        serializeFieldValue: ({ field, value }) => {
            if (field === "employee") {
                return resolveEmployeeReference(value);
            }

            if (
                field === "has_hr_access"
                || field === "has_recruitment_access"
                || field === "is_active"
            ) {
                return normalizeBooleanValue(value);
            }

            return value === "" ? null : value;
        },
    });

    const accessRightsFactory = new tableFactory({
        el: "#access-rights-table",
        api: {
            list: "/api/access-rights/",
            detail: "/api/access-rights/",
        },
        primaryKey: "id",
        autoSaveEdits: false,
        tableHeight: "560px",
        columns: [
            {
                formatter: "rowSelection",
                titleFormatter: "rowSelection",
                hozAlign: "left",
                headerSort: false,
                width: 50,
            },
            {
                title: "Username",
                field: "username",
                editable: cell => accessRightsRowEditor.isEditingRow(cell.getRow().getData()),
                editor: "input",
                headerSort: true,
                width: 190,
            },
            {
                title: "Employee",
                field: "employee",
                editable: cell => accessRightsRowEditor.isEditingRow(cell.getRow().getData()),
                editor: searchableDropdownEditor,
                editorParams: buildEmployeeEditorParams,
                formatter: cell => {
                    const rowData = cell.getRow().getData();
                    return rowData.employee_name || formatEmployeeReference(cell.getValue()) || "Not linked";
                },
                headerSort: true,
                width: 220,
            },
            {
                title: "Employee No.",
                field: "employee_number",
                headerSort: true,
                width: 140,
            },
            {
                title: "Division",
                field: "division_name",
                headerSort: true,
                width: 180,
            },
            {
                title: "Position",
                field: "position_name",
                headerSort: true,
                width: 200,
            },
            {
                title: "HR",
                field: "has_hr_access",
                editable: cell => accessRightsRowEditor.isEditingRow(cell.getRow().getData()),
                editor: searchableDropdownEditor,
                editorParams: () => buildSearchableListEditorParams(accessRightBooleanOptions, {
                    clearable: false,
                    placeholder: "Select option",
                }),
                formatter: cell => formatBooleanValue(cell.getValue()),
                headerSort: true,
                width: 100,
                hozAlign: "center",
            },
            {
                title: "Recruitment",
                field: "has_recruitment_access",
                editable: cell => accessRightsRowEditor.isEditingRow(cell.getRow().getData()),
                editor: searchableDropdownEditor,
                editorParams: () => buildSearchableListEditorParams(accessRightBooleanOptions, {
                    clearable: false,
                    placeholder: "Select option",
                }),
                formatter: cell => formatBooleanValue(cell.getValue()),
                headerSort: true,
                width: 130,
                hozAlign: "center",
            },
            {
                title: "Employee Portal",
                field: "has_employee_access",
                formatter: cell => formatBooleanValue(cell.getValue()),
                headerSort: true,
                width: 130,
                hozAlign: "center",
            },
            {
                title: "Approver",
                field: "has_approver_access",
                formatter: cell => formatBooleanValue(cell.getValue()),
                headerSort: true,
                width: 110,
                hozAlign: "center",
            },
            {
                title: "Status",
                field: "is_active",
                editable: cell => accessRightsRowEditor.isEditingRow(cell.getRow().getData()),
                editor: searchableDropdownEditor,
                editorParams: () => buildSearchableListEditorParams(accessRightBooleanOptions, {
                    clearable: false,
                    placeholder: "Select status",
                }),
                formatter: cell => formatBooleanValue(cell.getValue(), "Active", "Inactive"),
                headerSort: true,
                width: 110,
                hozAlign: "center",
            },
            {
                title: "Last Login",
                field: "last_login",
                formatter: cell => formatLastLogin(cell.getValue()),
                headerSort: true,
                width: 190,
            },
            accessRightsRowEditor.buildActionsColumn({ width: 190 }),
        ],
    });

    accessRightsTable = accessRightsFactory.create();
    accessRightsRowEditor.attachTable(accessRightsTable);
    bindTableSearchInput("table-search", accessRightsFactory);
    bindBulkEditActionButtons(accessRightsRowEditor, {
        editAllButton: document.getElementById("edit-all-access-rights-btn"),
        saveAllButton: document.getElementById("save-all-access-rights-btn"),
        cancelAllButton: document.getElementById("cancel-all-access-rights-btn"),
    });
    bindSelectionActionButton(
        accessRightsTable,
        document.getElementById("delete-selected-access-rights-btn")
    );

    const accessRightsModalElement = document.getElementById("addAccessRightsModal");
    const accessRightsModal = new bootstrap.Modal(accessRightsModalElement);
    const accessRightsForm = document.getElementById("add-access-rights-form");
    const addEmployeeSelect = document.getElementById("add-access-employee");
    const addHrToggle = document.getElementById("add-access-hr");
    const addRecruitmentToggle = document.getElementById("add-access-recruitment");
    const addActiveToggle = document.getElementById("add-access-active");

    initializeSearchableSelects(accessRightsModalElement, {
        selector: "select",
    });

    function refreshAddEmployeeOptions() {
        populateLookupSelect(
            addEmployeeSelect,
            getAvailableEmployeeOptions(),
            "No employee link",
        );
    }

    document.getElementById("add-access-rights-btn").addEventListener("click", () => {
        accessRightsForm.reset();
        addHrToggle.checked = false;
        addRecruitmentToggle.checked = false;
        addActiveToggle.checked = true;
        refreshAddEmployeeOptions();
        accessRightsModal.show();
    });

    document.getElementById("delete-selected-access-rights-btn").addEventListener("click", () => {
        accessRightsRowEditor.deleteSelectedRows({
            emptySelectionMessage: "Select at least one account to delete.",
        });
    });

    accessRightsForm.addEventListener("submit", async event => {
        event.preventDefault();

        const payload = {
            username: document.getElementById("add-access-username").value.trim(),
            password: document.getElementById("add-access-password").value,
            employee: resolveEmployeeReference(addEmployeeSelect.value),
            has_hr_access: addHrToggle.checked,
            has_recruitment_access: addRecruitmentToggle.checked,
            is_active: addActiveToggle.checked,
        };

        if (!payload.username || !payload.password) {
            showSystemToast({
                title: "Incomplete form",
                message: "Username and temporary password are required.",
                tone: "danger",
            });
            return;
        }

        try {
            const response = await fetch("/api/access-rights/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response, "Failed to create the account"));
            }

            accessRightsModal.hide();
            accessRightsForm.reset();
            refreshAddEmployeeOptions();
            accessRightsRowEditor.reset();
            accessRightsTable.replaceData();
            showSystemToast({
                title: "Account created",
                message: "The access-rights record was saved successfully.",
                tone: "success",
            });
        } catch (err) {
            showSystemToast({
                title: "Creation failed",
                message: err.message,
                tone: "danger",
            });
        }
    });
}).catch(err => {
    console.error("Failed to initialize access rights page:", err);
    showSystemToast({
        title: "Page unavailable",
        message: "Failed to initialize the access-rights page.",
        tone: "danger",
    });
});
