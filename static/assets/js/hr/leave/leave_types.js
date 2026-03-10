const leaveCategoryOptions = [
    { value: "credit_based", label: "Credit-based Leave" },
    { value: "statutory", label: "Statutory Leave" },
    { value: "special", label: "Special Leave Privilege" },
    { value: "conversion", label: "Credit Conversion / Separation" },
    { value: "wellness", label: "Wellness Leave" },
];

const leaveEntitlementUnitOptions = [
    { value: "working_days", label: "Working Days" },
    { value: "calendar_days", label: "Calendar Days" },
    { value: "months", label: "Months" },
    { value: "credit_balance", label: "Available Leave Credit Balance" },
];

const leaveEntitlementPeriodOptions = [
    { value: "per_application", label: "Per Application" },
    { value: "per_year", label: "Per Year" },
    { value: "per_occurrence", label: "Per Occurrence" },
    { value: "on_separation", label: "Upon Separation" },
    { value: "not_fixed", label: "Not Fixed" },
];

const leaveBooleanOptions = [
    { value: true, label: "Yes" },
    { value: false, label: "No" },
];

const leaveCompensationOptions = [
    {
        value: "with_pay_separate",
        label: "With Pay, Separate CSC Entitlement",
        payStatus: "with_pay",
        creditMode: "separate",
        requiresEarnedCredits: false,
    },
    {
        value: "with_pay_no_deduction",
        label: "With Pay, Not Deducted from Leave Credits",
        payStatus: "with_pay",
        creditMode: "none",
        requiresEarnedCredits: false,
    },
    {
        value: "vacation_credits",
        label: "Charge to Vacation Leave Credits",
        payStatus: "chargeable_to_credits",
        creditMode: "vacation",
        requiresEarnedCredits: true,
    },
    {
        value: "sick_credits",
        label: "Charge to Sick Leave Credits",
        payStatus: "chargeable_to_credits",
        creditMode: "sick",
        requiresEarnedCredits: true,
    },
    {
        value: "vacation_or_sick_credits",
        label: "Charge to Vacation / Sick Leave Credits",
        payStatus: "chargeable_to_credits",
        creditMode: "vacation_or_sick",
        requiresEarnedCredits: true,
    },
    {
        value: "without_pay",
        label: "Without Pay",
        payStatus: "without_pay",
        creditMode: "none",
        requiresEarnedCredits: false,
    },
    {
        value: "conditional",
        label: "Conditional / Depends on Rule",
        payStatus: "conditional",
        creditMode: "none",
        requiresEarnedCredits: false,
    },
];

const leaveCategoryLookup = new Map(leaveCategoryOptions.map(option => [option.value, option.label]));
const leaveEntitlementUnitLookup = new Map(leaveEntitlementUnitOptions.map(option => [option.value, option.label]));
const leaveEntitlementPeriodLookup = new Map(leaveEntitlementPeriodOptions.map(option => [option.value, option.label]));
const leaveCompensationLookup = new Map(leaveCompensationOptions.map(option => [option.value, option.label]));
const leaveTypeViewFields = [
    { label: "Leave Code", field: "leave_code" },
    { label: "Leave Type", field: "leave_name" },
    {
        label: "Leave Class",
        field: "category",
        format: ({ value }) => formatOptionLabel(leaveCategoryLookup, value),
    },
    {
        label: "Charge Against",
        field: "compensation_rule",
        editField: "compensation_rule",
        format: ({ value }) => formatOptionLabel(leaveCompensationLookup, value),
    },
    { label: "Entitlement Summary", field: "entitlement_summary", fullWidth: true },
    { label: "CSC Basis", field: "legal_basis", fullWidth: true },
    { label: "Description", field: "description", fullWidth: true },
    {
        label: "Requires Supporting Document",
        field: "requires_supporting_document",
        format: ({ value }) => parseBooleanValue(value) ? "Yes" : "No",
    },
    { label: "Supporting Document Notes", field: "supporting_document_notes", fullWidth: true },
    { label: "Eligibility Notes", field: "eligibility_notes", fullWidth: true },
    { label: "Filing Notes", field: "filing_notes", fullWidth: true },
    { label: "Rule Notes", field: "rule_notes", fullWidth: true },
    {
        label: "Active",
        field: "is_active",
        format: ({ value }) => parseBooleanValue(value) ? "Yes" : "No",
    },
];

const leaveEditableFields = [
    "leave_code",
    "leave_name",
    "category",
    "description",
    "legal_basis",
    "is_active",
    "pay_status",
    "credit_deduction_mode",
    "entitlement_value",
    "entitlement_unit",
    "entitlement_period",
    "requires_earned_leave_credits",
    "requires_supporting_document",
];

const leaveDerivedFields = [
    "compensation_rule",
];

function buildLeaveListEditorParams(options, {
    clearable = false,
    placeholder = "Select an option",
    searchPlaceholder = "Search options",
} = {}) {
    return buildSearchableListEditorParams(options, {
        clearable,
        placeholder,
        searchPlaceholder,
    });
}

function parseNullableDecimal(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const normalized = String(value).replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    if (Number.isNaN(parsed)) {
        return null;
    }

    return parsed.toFixed(2);
}

function parseNullableInteger(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseBooleanValue(value) {
    if (value === true || value === false) {
        return value;
    }

    if (value === null || value === undefined || value === "") {
        return false;
    }

    return ["true", "1", "yes", "y"].includes(String(value).trim().toLowerCase());
}

function formatNullableNumber(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const parsed = Number.parseFloat(value);
    if (Number.isNaN(parsed)) {
        return value;
    }

    return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

function formatOptionLabel(lookup, value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    return lookup.get(String(value)) || value;
}

function formatBooleanBadge(value) {
    return parseBooleanValue(value)
        ? '<span class="badge text-bg-success">Yes</span>'
        : '<span class="badge text-bg-light text-dark">No</span>';
}

function getLeaveCompensationOption(value) {
    return leaveCompensationOptions.find(option => option.value === value) || null;
}

function buildCompensationRuleValue({ pay_status: payStatus, credit_deduction_mode: creditMode }) {
    const matchedOption = leaveCompensationOptions.find(option => (
        option.payStatus === payStatus && option.creditMode === creditMode
    ));

    if (matchedOption) {
        return matchedOption.value;
    }

    if (payStatus === "conditional") {
        return "conditional";
    }

    if (payStatus === "without_pay") {
        return "without_pay";
    }

    return "with_pay_separate";
}

function buildLeaveTypeDisplayRow(rowData) {
    return {
        ...rowData,
        compensation_rule: buildCompensationRuleValue(rowData),
    };
}

function syncLeaveTypeCompensation(rowData, compensationRuleValue) {
    const option = getLeaveCompensationOption(compensationRuleValue);

    return {
        ...rowData,
        compensation_rule: option.value,
        pay_status: option.payStatus,
        credit_deduction_mode: option.creditMode,
        requires_earned_leave_credits: option.requiresEarnedCredits,
    };
}

const leaveTypeRowEditor = createTableRowEditor({
    primaryKey: "leave_type_id",
    editableFields: leaveEditableFields,
    viewFields: leaveTypeViewFields,
    getViewTitle: rowData => `Leave Type Record: ${rowData.leave_name}`,
    getViewSubtitle: rowData => rowData.leave_code,
    patchUrlBase: "/api/leave-types/",
    deleteUrlBase: "/api/leave-types/",
    deleteConfirmMessage: "Delete this leave type?",
    bulkDeleteConfirmMessage: "Delete the selected leave types?",
    prepareModalRowData: rowData => buildLeaveTypeDisplayRow(
        syncLeaveTypeCompensation(
            rowData,
            rowData.compensation_rule || buildCompensationRuleValue(rowData),
        ),
    ),
    onSaveSuccess: ({ row }) => {
        row.update(buildLeaveTypeDisplayRow(row.getData()));
    },
    serializeFieldValue: ({ field, value }) => {
        if (field === "entitlement_value") {
            return parseNullableDecimal(value);
        }

        if (["is_active", "requires_earned_leave_credits", "requires_supporting_document"].includes(field)) {
            return parseBooleanValue(value);
        }

        return value ?? "";
    },
});

const leaveTypeFactory = new tableFactory({
    el: "#leave-types-table",
    api: {
        list: "/api/leave-types/",
        detail: "/api/leave-types/",
    },
    primaryKey: "leave_type_id",
    autoSaveEdits: false,
    layout: "fitDataStretch",
    tableHeight: "560px",
    ajaxResponse: (url, params, response) => response.map(row => buildLeaveTypeDisplayRow(row)),
    onCellEdited: cell => {
        if (cell.getField() !== "compensation_rule") {
            return;
        }

        const updatedRow = syncLeaveTypeCompensation(cell.getRow().getData(), cell.getValue());
        cell.getRow().update(updatedRow);
    },
    columns: [
        {
            formatter: "rowSelection",
            titleFormatter: "rowSelection",
            hozAlign: "left",
            headerSort: false,
            width: 50,
            frozen: true,
        },
        {
            title: "Code",
            field: "leave_code",
            editor: "input",
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            headerSort: true,
            width: 120,
            frozen: true,
        },
        {
            title: "Leave Type",
            field: "leave_name",
            editor: "input",
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            headerSort: true,
            width: 250,
            frozen: true,
        },
        {
            title: "Leave Class",
            field: "category",
            editor: searchableDropdownEditor,
            editorParams: () => buildLeaveListEditorParams(leaveCategoryOptions, {
                placeholder: "Select class",
                searchPlaceholder: "Search classes",
            }),
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatOptionLabel(leaveCategoryLookup, cell.getValue()),
            headerSort: true,
            width: 200,
        },
        {
            title: "Charge Against",
            field: "compensation_rule",
            editor: searchableDropdownEditor,
            editorParams: () => buildLeaveListEditorParams(leaveCompensationOptions, {
                placeholder: "Select charge rule",
                searchPlaceholder: "Search charge rules",
            }),
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatOptionLabel(leaveCompensationLookup, cell.getValue()),
            headerSort: true,
            width: 250,
        },
        {
            title: "Entitlement Value",
            field: "entitlement_value",
            editor: "input",
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatNullableNumber(cell.getValue()),
            headerSort: true,
            width: 140,
            hozAlign: "right",
        },
        {
            title: "Unit",
            field: "entitlement_unit",
            editor: searchableDropdownEditor,
            editorParams: () => buildLeaveListEditorParams(leaveEntitlementUnitOptions, {
                placeholder: "Select unit",
                searchPlaceholder: "Search units",
            }),
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatOptionLabel(leaveEntitlementUnitLookup, cell.getValue()),
            headerSort: true,
            width: 170,
        },
        {
            title: "Frequency",
            field: "entitlement_period",
            editor: searchableDropdownEditor,
            editorParams: () => buildLeaveListEditorParams(leaveEntitlementPeriodOptions, {
                placeholder: "Select frequency",
                searchPlaceholder: "Search frequencies",
            }),
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatOptionLabel(leaveEntitlementPeriodLookup, cell.getValue()),
            headerSort: true,
            width: 170,
        },
        {
            title: "Needs Docs",
            field: "requires_supporting_document",
            editor: searchableDropdownEditor,
            editorParams: () => buildLeaveListEditorParams(leaveBooleanOptions, {
                placeholder: "Select option",
                searchPlaceholder: "Search options",
            }),
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatBooleanBadge(cell.getValue()),
            headerSort: true,
            width: 140,
            hozAlign: "center",
        },
        {
            title: "CSC Basis",
            field: "legal_basis",
            editor: "input",
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            headerSort: true,
            width: 280,
        },
        {
            title: "Description",
            field: "description",
            editor: "textarea",
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            headerSort: true,
            width: 260,
            formatter: "textarea",
        },
        {
            title: "Active",
            field: "is_active",
            editor: searchableDropdownEditor,
            editorParams: () => buildLeaveListEditorParams(leaveBooleanOptions, {
                placeholder: "Select option",
                searchPlaceholder: "Search options",
            }),
            editable: cell => leaveTypeRowEditor.isEditingRow(cell.getRow().getData()),
            formatter: cell => formatBooleanBadge(cell.getValue()),
            headerSort: true,
            width: 110,
            hozAlign: "center",
        },
        leaveTypeRowEditor.buildActionsColumn({ width: 190 }),
    ],
});

const leaveTypeTable = leaveTypeFactory.create();
leaveTypeRowEditor.attachTable(leaveTypeTable);
bindTableSearchInput("table-search", leaveTypeFactory);
bindBulkEditActionButtons(leaveTypeRowEditor, {
    editAllButton: document.getElementById("edit-all-leave-types-btn"),
    saveAllButton: document.getElementById("save-all-leave-types-btn"),
    cancelAllButton: document.getElementById("cancel-all-leave-types-btn"),
});
bindSelectionActionButton(
    leaveTypeTable,
    document.getElementById("delete-selected-leave-types-btn")
);

const leaveTypeModalElement = document.getElementById("addLeaveTypeModal");
const leaveTypeModal = new bootstrap.Modal(leaveTypeModalElement);
const leaveTypeForm = document.getElementById("add-leave-type-form");

const leaveTypeCategorySelect = document.getElementById("add-category");
const leaveTypeCompensationSelect = document.getElementById("add-compensation-rule");
const leaveTypeEntitlementUnitSelect = document.getElementById("add-entitlement-unit");
const leaveTypeEntitlementPeriodSelect = document.getElementById("add-entitlement-period");
const leaveTypeStatusSelect = document.getElementById("add-is-active");
const leaveTypeEntitlementValueInput = document.getElementById("add-entitlement-value");
const leaveTypeRequiresCreditsInput = document.getElementById("add-requires-earned-leave-credits");
const leaveTypeRequiresSupportingDocumentInput = document.getElementById("add-requires-supporting-document");
const leaveTypeSupportingDocumentNotesInput = document.getElementById("add-supporting-document-notes");

function getNextLeaveTypeSortOrder() {
    const currentRows = leaveTypeTable.getData();
    const sortOrders = currentRows
        .map(row => parseNullableInteger(row.sort_order))
        .filter(value => value !== null);

    if (!sortOrders.length) {
        return 10;
    }

    return Math.max(...sortOrders) + 10;
}

function syncLeaveTypeEntitlementInputs() {
    const isCreditBalance = leaveTypeEntitlementUnitSelect.value === "credit_balance";
    leaveTypeEntitlementValueInput.disabled = isCreditBalance;

    if (isCreditBalance) {
        leaveTypeEntitlementValueInput.value = "";
    }
}

function syncLeaveTypeCompensationInputs() {
    const compensationOption = getLeaveCompensationOption(leaveTypeCompensationSelect.value);
    leaveTypeRequiresCreditsInput.checked = compensationOption?.requiresEarnedCredits || false;
    leaveTypeRequiresCreditsInput.disabled = true;
}

function syncSupportingDocumentInputs() {
    const requiresSupportingDocument = leaveTypeRequiresSupportingDocumentInput.checked;
    leaveTypeSupportingDocumentNotesInput.disabled = !requiresSupportingDocument;

    if (!requiresSupportingDocument) {
        leaveTypeSupportingDocumentNotesInput.value = "";
    }
}

function populateLeaveTypeModalOptions() {
    populateLookupSelect(leaveTypeCategorySelect, leaveCategoryOptions, "Select class");
    populateLookupSelect(leaveTypeCompensationSelect, leaveCompensationOptions, "Select charge rule");
    populateLookupSelect(leaveTypeEntitlementUnitSelect, leaveEntitlementUnitOptions, "Select unit");
    populateLookupSelect(leaveTypeEntitlementPeriodSelect, leaveEntitlementPeriodOptions, "Select frequency");
    refreshSearchableSelect(leaveTypeCategorySelect);
    refreshSearchableSelect(leaveTypeCompensationSelect);
    refreshSearchableSelect(leaveTypeEntitlementUnitSelect);
    refreshSearchableSelect(leaveTypeEntitlementPeriodSelect);
    refreshSearchableSelect(leaveTypeStatusSelect);
}

function buildLeaveTypePayload() {
    const compensationOption = getLeaveCompensationOption(leaveTypeCompensationSelect.value);

    return {
        leave_code: document.getElementById("add-leave-code").value.trim(),
        leave_name: document.getElementById("add-leave-name").value.trim(),
        category: leaveTypeCategorySelect.value,
        description: document.getElementById("add-description").value.trim(),
        legal_basis: document.getElementById("add-legal-basis").value.trim(),
        sort_order: parseNullableInteger(document.getElementById("add-sort-order").value) ?? getNextLeaveTypeSortOrder(),
        is_active: parseBooleanValue(leaveTypeStatusSelect.value),
        pay_status: compensationOption?.payStatus || "",
        credit_deduction_mode: compensationOption?.creditMode || "",
        entitlement_value: parseNullableDecimal(leaveTypeEntitlementValueInput.value),
        entitlement_unit: leaveTypeEntitlementUnitSelect.value,
        entitlement_period: leaveTypeEntitlementPeriodSelect.value,
        min_service_months_required: parseNullableDecimal(document.getElementById("add-min-service-months-required").value),
        advance_notice_days: parseNullableInteger(document.getElementById("add-advance-notice-days").value),
        max_consecutive_days: parseNullableDecimal(document.getElementById("add-max-consecutive-days").value),
        requires_earned_leave_credits: compensationOption?.requiresEarnedCredits || false,
        allows_intermittent: document.getElementById("add-allows-intermittent").checked,
        requires_supporting_document: leaveTypeRequiresSupportingDocumentInput.checked,
        supporting_document_notes: leaveTypeSupportingDocumentNotesInput.value.trim(),
        eligibility_notes: document.getElementById("add-eligibility-notes").value.trim(),
        filing_notes: document.getElementById("add-filing-notes").value.trim(),
        rule_notes: document.getElementById("add-rule-notes").value.trim(),
    };
}

initializeSearchableSelects(leaveTypeModalElement, {
    selector: "select",
    searchPlaceholder: "Search options",
});
populateLeaveTypeModalOptions();
syncLeaveTypeCompensationInputs();
syncLeaveTypeEntitlementInputs();
syncSupportingDocumentInputs();

document.getElementById("add-leave-type-btn").addEventListener("click", () => {
    leaveTypeForm.reset();
    populateLeaveTypeModalOptions();
    document.getElementById("add-sort-order").value = String(getNextLeaveTypeSortOrder());
    leaveTypeStatusSelect.value = "true";
    refreshSearchableSelect(leaveTypeStatusSelect);
    syncLeaveTypeCompensationInputs();
    syncLeaveTypeEntitlementInputs();
    syncSupportingDocumentInputs();
    leaveTypeModal.show();
});

leaveTypeCompensationSelect.addEventListener("change", syncLeaveTypeCompensationInputs);
leaveTypeEntitlementUnitSelect.addEventListener("change", syncLeaveTypeEntitlementInputs);
leaveTypeRequiresSupportingDocumentInput.addEventListener("change", syncSupportingDocumentInputs);

document.getElementById("delete-selected-leave-types-btn").addEventListener("click", () => {
    leaveTypeRowEditor.deleteSelectedRows({
        emptySelectionMessage: "Select at least one leave type to delete.",
    });
});

leaveTypeForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = buildLeaveTypePayload();

    if (!payload.leave_code || !payload.leave_name || !payload.category || !payload.pay_status) {
        alert("Please complete the leave code, leave type, leave class, and charge-against rule.");
        return;
    }

    if (!payload.entitlement_unit || !payload.entitlement_period) {
        alert("Please select the entitlement unit and availment frequency.");
        return;
    }

    try {
        const response = await fetch("/api/leave-types/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to add leave type"));
        }

        leaveTypeModal.hide();
        leaveTypeForm.reset();
        leaveTypeRowEditor.reset();
        leaveTypeTable.replaceData();
    } catch (err) {
        alert(err.message);
    }
});
