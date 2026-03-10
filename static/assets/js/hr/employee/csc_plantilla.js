const plantillaCurrencyFormatter = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const plantillaAvailabilityOptions = [
    { value: "vacant", label: "Vacant" },
    { value: "filled", label: "Filled" },
];
const plantillaAvailabilityLookup = new Map(
    plantillaAvailabilityOptions.map(option => [option.value, option.label]),
);
const plantillaViewFields = [
    { label: "Plantilla Item No.", field: "item_number" },
    {
        label: "Position Title",
        field: "position",
        format: ({ value }) => formatPositionReference(value),
    },
    {
        label: "Place of Assignment",
        field: "division",
        format: ({ value }) => formatDivisionReference(value),
    },
    {
        label: "Availability",
        field: "availability_status",
        format: ({ value }) => plantillaAvailabilityLookup.get(value) || value || "",
    },
    {
        label: "Salary Grade",
        field: "salary_grade",
        format: ({ rowData }) => {
            const grade = rowData.position_standard_csc_grade ?? rowData.csc_grade;
            return grade ? `SG ${grade}` : "";
        },
    },
    {
        label: "Salary Step",
        field: "salary_step",
        format: ({ value }) => value ? `Step ${value}` : "",
    },
    {
        label: "Monthly Salary",
        field: "monthly_salary",
        format: ({ value }) => formatPlantillaCurrency(value),
    },
    {
        label: "Annual Salary",
        field: "annual_salary",
        format: ({ value }) => formatPlantillaCurrency(value),
    },
];

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

function getPositionStandardSalaryGradeValue(positionValue) {
    const positionRecord = getPositionRecord(positionValue);
    return positionRecord?.standard_salary_grade ?? null;
}

function buildPlantillaListEditorParams(options, clearable = false) {
    return buildSearchableListEditorParams(options, {
        clearable,
        placeholder: "Select an option",
        searchPlaceholder: "Search records",
    });
}

function buildAvailabilityBadge(value) {
    if (value === "filled") {
        return '<span class="badge text-bg-secondary">Filled</span>';
    }

    return '<span class="badge text-bg-success">Vacant</span>';
}

function buildPlantillaDerivedFields(rowData) {
    const positionRecord = getPositionRecord(rowData.position);
    const positionSalaryGradeValue = positionRecord?.standard_salary_grade ?? null;
    const effectiveSalaryGrade = positionSalaryGradeValue || resolveSalaryGradeReference(rowData.salary_grade);
    const salaryGradeRecord = getSalaryGradeRecord(effectiveSalaryGrade);
    const availableStepOptions = getSalaryStepOptionsForGrade(effectiveSalaryGrade);
    const parsedStep = parsePlantillaStepValue(rowData.salary_step);
    const validStep = availableStepOptions.some(option => option.value === parsedStep)
        ? parsedStep
        : (availableStepOptions[0]?.value ?? null);
    const monthlySalary = validStep
        ? getSalaryAmountForStep(effectiveSalaryGrade, validStep)
        : null;
    const annualSalary = monthlySalary === null || monthlySalary === undefined
        ? null
        : (Number.parseFloat(monthlySalary) * 12).toFixed(2);

    return {
        salary_grade: effectiveSalaryGrade,
        position_standard_salary_grade: positionSalaryGradeValue,
        position_standard_csc_grade: positionRecord?.standard_csc_grade ?? null,
        csc_grade: salaryGradeRecord?.csc_grade ?? null,
        salary_step: validStep,
        monthly_salary: monthlySalary,
        annual_salary: annualSalary,
    };
}

Promise.all([loadDivisions(), loadPositions(), loadSalaryGrades()])
    .then(() => {
        let vacanciesOnly = false;

        const plantillaRowEditor = createTableRowEditor({
            primaryKey: "plantilla_id",
            editableFields: [
                "item_number",
                "position",
                "division",
                "salary_grade",
                "salary_step",
                "availability_status",
            ],
            viewFields: plantillaViewFields,
            getViewTitle: rowData => `CSC Plantilla Item: ${rowData.item_number}`,
            getViewSubtitle: rowData => formatPositionReference(rowData.position),
            patchUrlBase: "/api/csc-plantilla/",
            deleteUrlBase: "/api/csc-plantilla/",
            deleteConfirmMessage: "Delete this plantilla item?",
            bulkDeleteConfirmMessage: "Delete the selected plantilla items?",
            prepareModalRowData: rowData => ({
                ...rowData,
                ...buildPlantillaDerivedFields(rowData),
            }),
            isModalFieldEditable: ({ field, rowData }) => {
                if (field === "salary_grade") {
                    return !getPositionStandardSalaryGradeValue(rowData.position);
                }

                return true;
            },
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
                if (!["position", "salary_grade", "salary_step"].includes(cell.getField())) {
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
                    width: 230,
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
                    title: "Availability",
                    field: "availability_status",
                    editable: cell => plantillaRowEditor.isEditingRow(cell.getRow().getData()),
                    editor: searchableDropdownEditor,
                    editorParams: () => buildPlantillaListEditorParams(plantillaAvailabilityOptions, false),
                    formatter: cell => buildAvailabilityBadge(cell.getValue()),
                    headerSort: true,
                    width: 150,
                    hozAlign: "center",
                },
                {
                    title: "Standard SG",
                    field: "salary_grade",
                    editable: cell => {
                        const rowData = cell.getRow().getData();
                        const positionSalaryGrade = getPositionStandardSalaryGradeValue(rowData.position);
                        return plantillaRowEditor.isEditingRow(rowData) && !positionSalaryGrade;
                    },
                    editor: searchableDropdownEditor,
                    editorParams: () => buildPlantillaListEditorParams(salaryGradeState.options, false),
                    formatter: cell => {
                        const rowData = cell.getRow().getData();
                        if (rowData.position_standard_csc_grade !== null && rowData.position_standard_csc_grade !== undefined) {
                            return `SG ${rowData.position_standard_csc_grade}`;
                        }

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
                plantillaRowEditor.buildActionsColumn({ width: 190 }),
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

        function refreshPlantillaData() {
            const url = vacanciesOnly
                ? "/api/csc-plantilla/?availability_status=vacant"
                : "/api/csc-plantilla/";
            return plantillaTable.setData(url);
        }

        const toggleVacanciesButton = document.getElementById("toggle-csc-vacancies-btn");
        toggleVacanciesButton.addEventListener("click", async () => {
            vacanciesOnly = !vacanciesOnly;
            toggleVacanciesButton.classList.toggle("btn-warning", vacanciesOnly);
            toggleVacanciesButton.classList.toggle("btn-outline-warning", !vacanciesOnly);
            toggleVacanciesButton.innerHTML = vacanciesOnly
                ? '<i class="ti ti-list"></i> Show All Items'
                : '<i class="ti ti-filter"></i> Show Vacancies Only';
            await refreshPlantillaData();
        });

        const plantillaModalElement = document.getElementById("addCSCPlantillaModal");
        const plantillaModal = new bootstrap.Modal(plantillaModalElement);
        const plantillaForm = document.getElementById("add-csc-plantilla-form");
        const itemNumberInput = document.getElementById("add-item-number");
        const positionSelect = document.getElementById("add-position");
        const divisionSelect = document.getElementById("add-division");
        const salaryGradeSelect = document.getElementById("add-salary-grade");
        const salaryStepSelect = document.getElementById("add-salary-step");
        const availabilityStatusSelect = document.getElementById("add-availability-status");
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

        function syncPlantillaSalaryGradeFromPosition({ resetValue = false } = {}) {
            const positionSalaryGradeValue = getPositionStandardSalaryGradeValue(positionSelect.value);

            if (positionSalaryGradeValue) {
                const mappedOption = salaryGradeState.options.filter(
                    option => String(option.value) === String(positionSalaryGradeValue)
                );
                populateLookupSelect(salaryGradeSelect, mappedOption, "Select salary grade");
                salaryGradeSelect.value = String(positionSalaryGradeValue);
                salaryGradeSelect.disabled = true;
            } else if (positionSelect.value) {
                populateLookupSelect(salaryGradeSelect, salaryGradeState.options, "Select salary grade");
                salaryGradeSelect.disabled = false;
                if (resetValue) {
                    salaryGradeSelect.value = "";
                }
            } else {
                populateLookupSelect(salaryGradeSelect, [], "Select salary grade");
                salaryGradeSelect.value = "";
                salaryGradeSelect.disabled = true;
            }

            refreshSearchableSelect(salaryGradeSelect);
            syncPlantillaStepOptions({ resetValue: true });
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
            populateLookupSelect(salaryGradeSelect, [], "Select salary grade");
            populateLookupSelect(salaryStepSelect, [], "Select salary step");
            availabilityStatusSelect.value = "vacant";
            refreshSearchableSelect(availabilityStatusSelect);
            salaryGradeSelect.disabled = true;
            refreshSearchableSelect(salaryGradeSelect);
            monthlySalaryInput.value = "";
            annualSalaryInput.value = "";
            itemNumberInput.focus();
            plantillaModal.show();
        });

        positionSelect.addEventListener("change", () => {
            syncPlantillaSalaryGradeFromPosition({ resetValue: true });
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
                availability_status: availabilityStatusSelect.value || "vacant",
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
                await refreshPlantillaData();
            } catch (err) {
                alert(err.message);
            }
        });
    })
    .catch(err => {
        console.error("Failed to initialize CSC plantilla page:", err);
        alert("Failed to initialize the CSC plantilla page.");
    });
