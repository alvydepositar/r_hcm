const salaryStepFields = [
    "step_1",
    "step_2",
    "step_3",
    "step_4",
    "step_5",
    "step_6",
    "step_7",
    "step_8",
];
const requiredSalaryStepFields = ["step_1", "step_2"];

const salaryCurrencyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const salaryGradeViewFields = [
    { label: "Salary Grade", field: "csc_grade" },
    ...salaryStepFields.map((field, index) => ({
        label: `Step ${index + 1}`,
        field,
        format: ({ value }) => formatSalaryAmount(value),
    })),
];

function parseSalaryGradeValue(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function parseSalaryAmount(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const normalized = String(value).replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(normalized);

    if (Number.isNaN(parsed) || parsed < 0) {
        return null;
    }

    return parsed.toFixed(2);
}

function formatSalaryAmount(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const numericValue = Number.parseFloat(value);
    if (Number.isNaN(numericValue)) {
        return value;
    }

    return salaryCurrencyFormatter.format(numericValue);
}

const salaryGradeRowEditor = createTableRowEditor({
    primaryKey: "salary_grade_id",
    editableFields: [
        "csc_grade",
        ...salaryStepFields,
    ],
    viewFields: salaryGradeViewFields,
    getViewTitle: rowData => `Salary Grade ${rowData.csc_grade}`,
    getViewSubtitle: "CSC Salary Matrix Record",
    patchUrlBase: "/api/salary_grades/",
    deleteUrlBase: "/api/salary_grades/",
    deleteConfirmMessage: "Delete this salary grade row?",
    bulkDeleteConfirmMessage: "Delete the selected salary grade rows?",
    serializeFieldValue: ({ field, value }) => {
        if (field === "csc_grade") {
            return parseSalaryGradeValue(value);
        }

        if (salaryStepFields.includes(field)) {
            return parseSalaryAmount(value);
        }

        return value === "" ? null : value;
    },
});

const salaryGradeFactory = new tableFactory({
    el: "#salary-grades-table",
    api: {
        list: "/api/salary_grades/",
        detail: "/api/salary_grades/",
    },
    primaryKey: "salary_grade_id",
    autoSaveEdits: false,
    layout: "fitDataStretch",
    tableHeight: "560px",
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
            title: "Salary Grade",
            field: "csc_grade",
            hozAlign: "center",
            headerSort: true,
            width: 140,
            frozen: true,
            editable: cell => salaryGradeRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
        },
        ...salaryStepFields.map((field, index) => ({
            title: `Step ${index + 1}`,
            field,
            width: 150,
            hozAlign: "right",
            headerSort: true,
            editable: cell => salaryGradeRowEditor.isEditingRow(cell.getRow().getData()),
            editor: "input",
            formatter: cell => formatSalaryAmount(cell.getValue()),
        })),
        salaryGradeRowEditor.buildActionsColumn({ width: 190 }),
    ],
});

const salaryGradeTable = salaryGradeFactory.create();
salaryGradeRowEditor.attachTable(salaryGradeTable);
bindTableSearchInput("table-search", salaryGradeFactory);
bindBulkEditActionButtons(salaryGradeRowEditor, {
    editAllButton: document.getElementById("edit-all-salary-grades-btn"),
    saveAllButton: document.getElementById("save-all-salary-grades-btn"),
    cancelAllButton: document.getElementById("cancel-all-salary-grades-btn"),
});
bindSelectionActionButton(
    salaryGradeTable,
    document.getElementById("delete-selected-salary-grades-btn")
);

const salaryGradeModalElement = document.getElementById("addSalaryGradeModal");
const salaryGradeModal = new bootstrap.Modal(salaryGradeModalElement);
const salaryGradeForm = document.getElementById("add-salary-grade-form");

function buildSalaryGradePayload() {
    const payload = {
        csc_grade: parseSalaryGradeValue(document.getElementById("add-csc-grade").value),
    };

    salaryStepFields.forEach(field => {
        payload[field] = parseSalaryAmount(document.getElementById(`add-${field.replace("_", "-")}`).value);
    });

    return payload;
}

document.getElementById("add-salary-grade-btn").addEventListener("click", () => {
    salaryGradeForm.reset();
    salaryGradeModal.show();
});

document.getElementById("delete-selected-salary-grades-btn").addEventListener("click", () => {
    salaryGradeRowEditor.deleteSelectedRows({
        emptySelectionMessage: "Select at least one salary grade row to delete.",
    });
});

salaryGradeForm.addEventListener("submit", async event => {
    event.preventDefault();

    const payload = buildSalaryGradePayload();

    if (!payload.csc_grade || requiredSalaryStepFields.some(field => payload[field] === null)) {
        alert("Please complete the salary grade, Step 1, and Step 2.");
        return;
    }

    try {
        const response = await fetch("/api/salary_grades/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to add salary grade"));
        }

        salaryGradeModal.hide();
        salaryGradeForm.reset();
        salaryGradeRowEditor.reset();
        salaryGradeTable.replaceData();
    } catch (err) {
        alert(err.message);
    }
});
