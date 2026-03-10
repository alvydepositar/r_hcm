const standardLeaveCreditBucketOptions = [
    {
        value: "vacation",
        label: "Vacation Leave Credits",
        bucketCode: "vacation",
        bucketName: "Vacation Leave Credits",
        linkedLeaveType: null,
    },
    {
        value: "sick",
        label: "Sick Leave Credits",
        bucketCode: "sick",
        bucketName: "Sick Leave Credits",
        linkedLeaveType: null,
    },
];
const leaveCreditViewFields = [
    {
        label: "Employee",
        field: "employee",
        format: ({ value, rowData }) => formatEmployeeReference(value) || rowData.employee_name || "",
    },
    {
        label: "Balance Bucket",
        field: "bucket_selector",
        editField: "bucket_selector",
        format: ({ value, rowData }) => getLeaveCreditBucketOption(value)?.label || rowData.bucket_name || rowData.bucket_code || "",
    },
    {
        label: "Linked Leave Type",
        field: "linked_leave_type_name",
    },
    {
        label: "Current Balance",
        field: "current_balance",
        format: ({ value }) => formatLeaveCreditBalance(value),
    },
    { label: "Notes", field: "notes", fullWidth: true },
];

function parseNullableDecimal(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

function formatLeaveCreditBalance(value) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value || "" : parsed.toFixed(2);
}

function getTrackedLeaveTypeBucketOptions() {
    return Array.from(leaveTypeState.records.values())
        .filter(record => record.is_active && record.balance_tracking_mode === "leave_type")
        .map(record => ({
            value: `leave_type:${record.leave_type_id}`,
            label: `${record.leave_name} Balance`,
            bucketCode: record.leave_code,
            bucketName: record.leave_name,
            linkedLeaveType: record.leave_type_id,
        }));
}

function getLeaveCreditBucketOptions() {
    return standardLeaveCreditBucketOptions.concat(getTrackedLeaveTypeBucketOptions());
}

function getLeaveCreditBucketOption(value) {
    return getLeaveCreditBucketOptions().find(option => String(option.value) === String(value)) || null;
}

function applyLeaveCreditBucketSelection(rowData, selectorValue) {
    const option = getLeaveCreditBucketOption(selectorValue);
    if (!option) {
        return {
            ...rowData,
            bucket_selector: selectorValue,
        };
    }

    const leaveTypeRecord = option.linkedLeaveType ? getLeaveTypeRecord(option.linkedLeaveType) : null;

    return {
        ...rowData,
        bucket_selector: option.value,
        bucket_code: option.bucketCode,
        bucket_name: option.bucketName,
        linked_leave_type: option.linkedLeaveType,
        linked_leave_type_name: leaveTypeRecord?.leave_name || "",
    };
}

function buildLeaveCreditDisplayRow(rowData) {
    const selectorValue = rowData.linked_leave_type
        ? `leave_type:${rowData.linked_leave_type}`
        : rowData.bucket_code;
    return applyLeaveCreditBucketSelection(rowData, selectorValue);
}

function formatLeaveCreditBucket(cell) {
    const rowData = cell.getRow().getData();
    const option = getLeaveCreditBucketOption(cell.getValue());
    return option?.label || rowData.bucket_name || rowData.bucket_code || "";
}

Promise.all([loadEmployees(), loadLeaveTypes()])
    .then(() => {
        const leaveCreditRowEditor = createTableRowEditor({
            primaryKey: "leave_credit_id",
            editableFields: [
                "employee",
                "bucket_code",
                "bucket_name",
                "linked_leave_type",
                "current_balance",
                "notes",
            ],
            viewFields: leaveCreditViewFields,
            getViewTitle: rowData => `Leave Credit Record: ${rowData.employee_name || formatEmployeeReference(rowData.employee)}`,
            getViewSubtitle: rowData => rowData.bucket_name || rowData.bucket_code,
            patchUrlBase: "/api/leave-credits/",
            deleteUrlBase: "/api/leave-credits/",
            deleteConfirmMessage: "Delete this leave credit balance?",
            bulkDeleteConfirmMessage: "Delete the selected leave credit balances?",
            prepareModalRowData: rowData => applyLeaveCreditBucketSelection(
                rowData,
                rowData.bucket_selector,
            ),
            serializeFieldValue: ({ field, value }) => {
                if (field === "employee") {
                    return resolveEmployeeReference(value);
                }

                if (field === "linked_leave_type") {
                    return resolveLeaveTypeReference(value);
                }

                if (field === "current_balance") {
                    return parseNullableDecimal(value);
                }

                if (value === "") {
                    return null;
                }

                return value;
            },
            onSaveSuccess: ({ row, updated }) => {
                row.update(buildLeaveCreditDisplayRow(updated));
            },
        });

        const leaveCreditFactory = new tableFactory({
            el: "#leave-credits-table",
            api: {
                list: "/api/leave-credits/",
                detail: "/api/leave-credits/",
            },
            primaryKey: "leave_credit_id",
            autoSaveEdits: false,
            ajaxResponse: (url, params, response) => response.map(row => buildLeaveCreditDisplayRow(row)),
            onCellEdited: cell => {
                if (cell.getField() !== "bucket_selector") {
                    return;
                }

                const updatedRow = applyLeaveCreditBucketSelection(
                    cell.getRow().getData(),
                    cell.getValue(),
                );
                cell.getRow().update(updatedRow);
            },
            columns: [
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "left",
                    headerSort: false,
                    width: 50,
                },
                {
                    title: "Employee",
                    field: "employee",
                    editor: searchableDropdownEditor,
                    editorParams: () => buildSearchableListEditorParams(employeeState.options, {
                        placeholder: "Select employee",
                        searchPlaceholder: "Search employees",
                        searchCategory: "person",
                    }),
                    editable: cell => leaveCreditRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: cell => formatEmployeeReference(cell.getValue()) || cell.getRow().getData().employee_name || "",
                    headerSort: true,
                    width: 240,
                },
                {
                    title: "Balance Bucket",
                    field: "bucket_selector",
                    editor: searchableDropdownEditor,
                    editorParams: () => buildSearchableListEditorParams(getLeaveCreditBucketOptions(), {
                        placeholder: "Select balance bucket",
                        searchPlaceholder: "Search buckets",
                    }),
                    editable: cell => leaveCreditRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: formatLeaveCreditBucket,
                    headerSort: true,
                    width: 280,
                },
                {
                    title: "Current Balance",
                    field: "current_balance",
                    editor: "input",
                    editable: cell => leaveCreditRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: cell => formatLeaveCreditBalance(cell.getValue()),
                    hozAlign: "right",
                    headerSort: true,
                    width: 140,
                },
                {
                    title: "Notes",
                    field: "notes",
                    editor: "textarea",
                    editable: cell => leaveCreditRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: "textarea",
                    headerSort: true,
                },
                leaveCreditRowEditor.buildActionsColumn({ width: 190 }),
            ],
        });

        const leaveCreditTable = leaveCreditFactory.create();
        leaveCreditRowEditor.attachTable(leaveCreditTable);
        bindTableSearchInput("table-search", leaveCreditFactory);
        bindBulkEditActionButtons(leaveCreditRowEditor, {
            editAllButton: document.getElementById("edit-all-leave-credits-btn"),
            saveAllButton: document.getElementById("save-all-leave-credits-btn"),
            cancelAllButton: document.getElementById("cancel-all-leave-credits-btn"),
        });
        bindSelectionActionButton(
            leaveCreditTable,
            document.getElementById("delete-selected-leave-credits-btn"),
        );

        const leaveCreditModalElement = document.getElementById("addLeaveCreditModal");
        const leaveCreditModal = new bootstrap.Modal(leaveCreditModalElement);
        const leaveCreditForm = document.getElementById("add-leave-credit-form");
        const employeeSelect = document.getElementById("add-credit-employee");
        const bucketSelect = document.getElementById("add-credit-bucket");
        const balanceInput = document.getElementById("add-credit-balance");
        const notesInput = document.getElementById("add-credit-notes");

        employeeSelect.dataset.searchCategory = "person";
        initializeSearchableSelects(leaveCreditModalElement, {
            selector: "select",
            searchPlaceholder: "Search records",
        });

        function populateLeaveCreditModalOptions() {
            populateLookupSelect(employeeSelect, employeeState.options, "Select employee");
            populateLookupSelect(bucketSelect, getLeaveCreditBucketOptions(), "Select balance bucket");
            refreshSearchableSelect(employeeSelect);
            refreshSearchableSelect(bucketSelect);
        }

        document.getElementById("add-leave-credit-btn").addEventListener("click", () => {
            if (!employeeState.options.length) {
                alert("Employee records are not available. Please refresh the page.");
                return;
            }

            leaveCreditForm.reset();
            populateLeaveCreditModalOptions();
            leaveCreditModal.show();
        });

        document.getElementById("delete-selected-leave-credits-btn").addEventListener("click", () => {
            leaveCreditRowEditor.deleteSelectedRows({
                emptySelectionMessage: "Select at least one leave credit balance to delete.",
            });
        });

        leaveCreditForm.addEventListener("submit", async event => {
            event.preventDefault();

            const bucketOption = getLeaveCreditBucketOption(bucketSelect.value);
            const payload = {
                employee: resolveEmployeeReference(employeeSelect.value),
                bucket_code: bucketOption?.bucketCode || "",
                bucket_name: bucketOption?.bucketName || "",
                linked_leave_type: bucketOption?.linkedLeaveType || null,
                current_balance: parseNullableDecimal(balanceInput.value),
                notes: notesInput.value.trim(),
            };

            if (!payload.employee || !payload.bucket_code || payload.current_balance === null) {
                alert("Please complete the employee, balance bucket, and current balance.");
                return;
            }

            try {
                const response = await fetch("/api/leave-credits/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrftoken,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(await readApiError(response, "Failed to add leave credit balance"));
                }

                leaveCreditModal.hide();
                leaveCreditForm.reset();
                leaveCreditRowEditor.reset();
                leaveCreditTable.replaceData();
            } catch (err) {
                alert(err.message);
            }
        });
    })
    .catch(err => {
        console.error("Failed to initialize leave credit maintenance page:", err);
        alert("Failed to initialize employee leave credits.");
    });
