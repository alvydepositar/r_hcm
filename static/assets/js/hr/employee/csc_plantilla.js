const plantillaCurrencyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatPlantillaCurrency(value) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const numericValue = Number.parseFloat(value);
    if (Number.isNaN(numericValue)) {
        return value;
    }

    return plantillaCurrencyFormatter.format(numericValue);
}

function parsePlantillaStepValue(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function buildPlantillaDerivedFields(rowData) {
    const salaryGradeRecord = getSalaryGradeRecord(rowData.salary_grade);
    const availableStepOptions = getSalaryStepOptionsForGrade(rowData.salary_grade);
    const parsedStep = parsePlantillaStepValue(rowData.salary_step);
    const validStep = availableStepOptions.some(option => option.value === parsedStep)
        ? parsedStep
        : (availableStepOptions[0]?.value ?? null);
    const monthlySalary = validStep
        ? getSalaryAmountForStep(rowData.salary_grade, validStep)
        : null;
    const annualSalary = monthlySalary === null || monthlySalary === undefined
        ? null
        : (Number.parseFloat(monthlySalary) * 12).toFixed(2);

    return {
        salary_step: validStep,
        csc_grade: salaryGradeRecord?.csc_grade ?? null,
        monthly_salary: monthlySalary,
        annual_salary: annualSalary,
    };
}

function buildPlantillaListEditorParams(options, clearable = false) {
    return buildSearchableListEditorParams(options, {
        clearable,
        placeholder: "Select an option",
        searchPlaceholder: "Search records",
    });
}

Promise.all([loadDivisions(), loadPositions(), loadSalaryGrades()])
    .then(() => {
        const plantillaRowEditor = createTableRowEditor({
            primaryKey: "plantilla_id",
            editableFields: [
                "item_number",
                "position",
                "division",
                "salary_grade",
                "salary_step",
            ],
            patchUrlBase: "/api/csc-plantilla/",
            deleteUrlBase: "/api/csc-plantilla/",
            deleteConfirmMessage: "Delete this plantilla item?",
            bulkDeleteConfirmMessage: "Delete the selected plantilla items?",
            serializeFieldValue: ({ field, value }) => {
                if (field === "position") {
                    return resolvePositionReference(value);
                }

                if (field === "division") {
                    return resolveDivisionReference(value);
                }

                if (field === "salary_grade") {
                    return resolveSalaryGradeReference(value);
                }

                if (field === "salary_step") {
                    return parsePlantillaStepValue(value);
                }

                return value === "" ? null : value;
            },
        });

        const plantillaFactory = new tableFactory({
            el: "#csc-plantilla-table",
            api: {
                list: "/api/csc-plantilla/",
                detail: "/api/csc-plantilla/",
            },
            primaryKey: "plantilla_id",
            autoSaveEdits: false,
            onCellEdited: cell => {
                if (!["salary_grade", "salary_step"].includes(cell.getField())) {
                    return;
                }

                const rowData = cell.getRow().getData();
                cell.getRow().update(buildPlantillaDerivedFields(rowData));
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
                    title: "Plantilla Item No.",
                    field: "item_number",
                    editable: cell => plantillaRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: "input",
                    headerSort: true,
                    width: 180,
                },
                {
                    title: "Position Title",
                    field: "position",
                    editable: cell => plantillaRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: () => buildPlantillaListEditorParams(positionState.options, false),
                    formatter: cell => formatPositionReference(cell.getValue()),
                    headerSort: true,
                    width: 220,
                },
                {
                    title: "Place of Assignment",
                    field: "division",
                    editable: cell => plantillaRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: () => buildPlantillaListEditorParams(divisionState.options, false),
                    formatter: cell => formatDivisionReference(cell.getValue()),
                    headerSort: true,
                    width: 220,
                },
                {
                    title: "Salary Grade",
                    field: "salary_grade",
                    editable: cell => plantillaRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: () => buildPlantillaListEditorParams(salaryGradeState.options, false),
                    formatter: cell => {
                        const rowData = cell.getRow().getData();
                        if (rowData.csc_grade !== null && rowData.csc_grade !== undefined) {
                            return `SG ${rowData.csc_grade}`;
                        }

                        return formatSalaryGradeReference(cell.getValue());
                    },
                    headerSort: true,
                    width: 150,
                },
                {
                    title: "Step",
                    field: "salary_step",
                    editable: cell => plantillaRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: cell => buildPlantillaListEditorParams(
                        getSalaryStepOptionsForGrade(cell.getRow().getData().salary_grade),
                        false
                    ),
                    formatter: cell => {
                        const value = parsePlantillaStepValue(cell.getValue());
                        return value ? `Step ${value}` : "";
                    },
                    headerSort: true,
                    width: 120,
                },
                {
                    title: "Monthly Salary",
                    field: "monthly_salary",
                    formatter: cell => formatPlantillaCurrency(cell.getValue()),
                    headerSort: true,
                    width: 180,
                    hozAlign: "right",
                },
                {
                    title: "Annual Salary",
                    field: "annual_salary",
                    formatter: cell => formatPlantillaCurrency(cell.getValue()),
                    headerSort: true,
                    width: 180,
                    hozAlign: "right",
                },
                plantillaRowEditor.buildActionsColumn({ width: 250 }),
            ],
        });

        const plantillaTable = plantillaFactory.create();
        plantillaRowEditor.attachTable(plantillaTable);
        bindTableSearchInput("table-search", plantillaFactory);
        bindBulkEditActionButtons(plantillaRowEditor, {
            editAllButton: document.getElementById("edit-all-csc-plantilla-btn"),
            saveAllButton: document.getElementById("save-all-csc-plantilla-btn"),
            cancelAllButton: document.getElementById("cancel-all-csc-plantilla-btn"),
        });
        bindSelectionActionButton(
            plantillaTable,
            document.getElementById("delete-selected-csc-plantilla-btn")
        );

        const plantillaModalElement = document.getElementById("addCSCPlantillaModal");
        const plantillaModal = new bootstrap.Modal(plantillaModalElement);
        const plantillaForm = document.getElementById("add-csc-plantilla-form");
        const itemNumberInput = document.getElementById("add-item-number");
        const positionSelect = document.getElementById("add-position");
        const divisionSelect = document.getElementById("add-division");
        const salaryGradeSelect = document.getElementById("add-salary-grade");
        const salaryStepSelect = document.getElementById("add-salary-step");
        const monthlySalaryInput = document.getElementById("add-monthly-salary");
        const annualSalaryInput = document.getElementById("add-annual-salary");

        function syncPlantillaModalCompensation() {
            const monthlySalary = getSalaryAmountForStep(salaryGradeSelect.value, salaryStepSelect.value);
            const annualSalary = monthlySalary === null || monthlySalary === undefined
                ? null
                : (Number.parseFloat(monthlySalary) * 12).toFixed(2);

            monthlySalaryInput.value = formatPlantillaCurrency(monthlySalary);
            annualSalaryInput.value = formatPlantillaCurrency(annualSalary);
        }

        function syncPlantillaStepOptions({ resetValue = false } = {}) {
            const stepOptions = getSalaryStepOptionsForGrade(salaryGradeSelect.value);
            populateLookupSelect(salaryStepSelect, stepOptions, "Select salary step");

            if (stepOptions.length) {
                const currentValue = parsePlantillaStepValue(salaryStepSelect.value);
                const hasValidSelection = stepOptions.some(option => option.value === currentValue);
                salaryStepSelect.value = (
                    !resetValue && hasValidSelection
                        ? String(currentValue)
                        : String(stepOptions[0].value)
                );
            } else {
                salaryStepSelect.value = "";
            }

            refreshSearchableSelect(salaryStepSelect);
            syncPlantillaModalCompensation();
        }

        initializeSearchableSelects(plantillaModalElement, {
            selector: "select",
            searchPlaceholder: "Search records",
        });

        document.getElementById("add-csc-plantilla-btn").addEventListener("click", () => {
            if (!divisionState.options.length || !positionState.options.length || !salaryGradeState.options.length) {
                alert("Plantilla lookups are not available. Please refresh and try again.");
                return;
            }

            plantillaForm.reset();
            populateLookupSelect(positionSelect, positionState.options, "Select position");
            populateLookupSelect(divisionSelect, divisionState.options, "Select division");
            populateLookupSelect(salaryGradeSelect, salaryGradeState.options, "Select salary grade");
            populateLookupSelect(salaryStepSelect, [], "Select salary step");
            monthlySalaryInput.value = "";
            annualSalaryInput.value = "";
            itemNumberInput.focus();
            plantillaModal.show();
        });

        salaryGradeSelect.addEventListener("change", () => {
            syncPlantillaStepOptions({ resetValue: true });
        });

        salaryStepSelect.addEventListener("change", () => {
            syncPlantillaModalCompensation();
        });

        document.getElementById("delete-selected-csc-plantilla-btn").addEventListener("click", () => {
            plantillaRowEditor.deleteSelectedRows({
                emptySelectionMessage: "Select at least one plantilla item to delete.",
            });
        });

        plantillaForm.addEventListener("submit", async event => {
            event.preventDefault();

            const payload = {
                item_number: itemNumberInput.value.trim(),
                position: resolvePositionReference(positionSelect.value),
                division: resolveDivisionReference(divisionSelect.value),
                salary_grade: resolveSalaryGradeReference(salaryGradeSelect.value),
                salary_step: parsePlantillaStepValue(salaryStepSelect.value),
            };

            if (!payload.item_number || !payload.position || !payload.division || !payload.salary_grade || !payload.salary_step) {
                alert("Please complete all required plantilla fields.");
                return;
            }

            try {
                const response = await fetch("/api/csc-plantilla/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrftoken,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(await readApiError(response, "Failed to add plantilla item"));
                }

                plantillaModal.hide();
                plantillaForm.reset();
                monthlySalaryInput.value = "";
                annualSalaryInput.value = "";
                plantillaRowEditor.reset();
                plantillaTable.replaceData();
            } catch (err) {
                alert(err.message);
            }
        });
    })
    .catch(err => {
        console.error("Failed to initialize CSC plantilla page:", err);
        alert("Failed to initialize the CSC plantilla page.");
    });
