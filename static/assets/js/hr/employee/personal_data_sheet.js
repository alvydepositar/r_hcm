const pdsState = {
    recordId: null,
    employeeId: null,
};

const pdsSectionConfigs = {
    children: {
        bodyId: "children-table-body",
        columns: [
            { key: "full_name", type: "text", placeholder: "Full name" },
            { key: "birthdate", type: "date" },
        ],
    },
    civil_service_eligibilities: {
        bodyId: "civil_service_eligibilities-table-body",
        columns: [
            { key: "eligibility", type: "text", placeholder: "Career service / bar / board / etc." },
            { key: "rating", type: "text", placeholder: "Rating" },
            { key: "exam_date", type: "date" },
            { key: "exam_place", type: "text", placeholder: "Place" },
            { key: "license_number", type: "text", placeholder: "License number" },
            { key: "validity", type: "text", placeholder: "Validity" },
        ],
    },
    work_experiences: {
        bodyId: "work_experiences-table-body",
        columns: [
            { key: "from", type: "date" },
            { key: "to", type: "date" },
            { key: "position_title", type: "text", placeholder: "Position title" },
            { key: "agency_company", type: "text", placeholder: "Department / agency / company" },
            { key: "monthly_salary", type: "number", min: "0", step: "0.01", placeholder: "0.00" },
            { key: "salary_grade_step", type: "text", placeholder: "e.g. SG-11/3" },
            { key: "appointment_status", type: "text", placeholder: "Status of appointment" },
            {
                key: "government_service",
                type: "select",
                options: [
                    { value: "", label: "Select" },
                    { value: "yes", label: "Yes" },
                    { value: "no", label: "No" },
                ],
            },
        ],
    },
    voluntary_works: {
        bodyId: "voluntary_works-table-body",
        columns: [
            { key: "organization_address", type: "text", placeholder: "Organization and address" },
            { key: "from", type: "date" },
            { key: "to", type: "date" },
            { key: "hours", type: "number", min: "0", step: "1", placeholder: "Hours" },
            { key: "nature_of_work", type: "text", placeholder: "Position / nature of work" },
        ],
    },
    learning_and_development: {
        bodyId: "learning_and_development-table-body",
        columns: [
            { key: "title", type: "text", placeholder: "Training title" },
            { key: "from", type: "date" },
            { key: "to", type: "date" },
            { key: "hours", type: "number", min: "0", step: "1", placeholder: "Hours" },
            { key: "type", type: "text", placeholder: "Managerial / supervisory / technical / etc." },
            { key: "conducted_by", type: "text", placeholder: "Conducted / sponsored by" },
        ],
    },
    references: {
        bodyId: "references-table-body",
        maxRows: 3,
        columns: [
            { key: "name", type: "text", placeholder: "Full name" },
            { key: "address", type: "text", placeholder: "Address" },
            { key: "contact", type: "text", placeholder: "Telephone / mobile no." },
        ],
    },
};

const questionnaireKeys = [
    "q34a",
    "q34b",
    "q35a",
    "q35b",
    "q36",
    "q37",
    "q38a",
    "q38b",
    "q39",
    "q40a",
    "q40b",
    "q40c",
];

const educationLevels = [
    "elementary",
    "secondary",
    "vocational",
    "college",
    "graduate",
];

function populateLookupSelect(select, options, placeholder) {
    select.innerHTML = [`<option value="">${placeholder}</option>`]
        .concat(options.map(option => `<option value="${option.value}">${option.label}</option>`))
        .join("");
    refreshSearchableSelect(select);
}

function emptyAddress() {
    return {
        house_block_lot_no: "",
        street: "",
        subdivision_village: "",
        barangay: "",
        city_municipality: "",
        province: "",
        zip_code: "",
    };
}

function emptyPersonName() {
    return {
        surname: "",
        first_name: "",
        middle_name: "",
        name_extension: "",
    };
}

function emptyEducationalBackground() {
    return {
        elementary: {},
        secondary: {},
        vocational: {},
        college: {},
        graduate: {},
    };
}

function emptyQuestionnaire() {
    return Object.fromEntries(
        questionnaireKeys.map(key => [key, { answer: "", details: "" }])
    );
}

function emptyPdsRecord() {
    return {
        employee: "",
        surname: "",
        first_name: "",
        middle_name: "",
        name_extension: "",
        date_of_birth: "",
        place_of_birth: "",
        sex: "",
        civil_status: "",
        civil_status_other: "",
        citizenship: "",
        citizenship_basis: "",
        dual_citizenship_country: "",
        height_m: "",
        weight_kg: "",
        blood_type: "",
        gsis_id_no: "",
        pagibig_id_no: "",
        philhealth_no: "",
        sss_no: "",
        tin_no: "",
        agency_employee_no: "",
        residential_address: emptyAddress(),
        permanent_address: emptyAddress(),
        telephone_no: "",
        mobile_no: "",
        email_address: "",
        spouse_information: {
            ...emptyPersonName(),
            occupation: "",
            employer_business_name: "",
            business_address: "",
            telephone_no: "",
        },
        father_information: emptyPersonName(),
        mother_information: {
            surname: "",
            first_name: "",
            middle_name: "",
        },
        children: [],
        educational_background: emptyEducationalBackground(),
        civil_service_eligibilities: [],
        work_experiences: [],
        voluntary_works: [],
        learning_and_development: [],
        special_skills: [],
        recognitions: [],
        memberships: [],
        questionnaire: emptyQuestionnaire(),
        references: [],
        government_id_type: "",
        government_id_number: "",
        government_id_date_of_issue: "",
        government_id_place_of_issue: "",
        date_accomplished: "",
    };
}

function buildDefaultPdsForEmployee(employee) {
    const record = emptyPdsRecord();
    record.employee = employee.id;
    record.surname = employee.last_name || "";
    record.first_name = employee.first_name || "";
    record.middle_name = employee.middle_name || "";
    record.name_extension = employee.name_extension || "";
    record.agency_employee_no = employee.employee_id || "";
    record.date_accomplished = new Date().toISOString().slice(0, 10);
    return record;
}

function getInputValue(id) {
    return document.getElementById(id).value.trim();
}

function setInputValue(id, value) {
    document.getElementById(id).value = value ?? "";
}

function parseNullableNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
}

function normalizeStringList(value) {
    if (!value) {
        return [];
    }

    return value
        .split("\n")
        .map(item => item.trim())
        .filter(Boolean);
}

function setListTextarea(id, values = []) {
    setInputValue(id, Array.isArray(values) ? values.join("\n") : "");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function getNestedValue(source, path) {
    return path.split(".").reduce((value, key) => {
        if (value === null || value === undefined) {
            return "";
        }
        return value[key];
    }, source);
}

function formatDateDisplay(value) {
    if (!value) {
        return "";
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
        const [year, month, day] = String(value).split("-");
        return `${month}/${day}/${year}`;
    }

    return String(value);
}

function formatNumberDisplay(value, minimumFractionDigits = 0, maximumFractionDigits = 2) {
    if (value === null || value === undefined || value === "") {
        return "";
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return String(value);
    }

    return parsed.toLocaleString("en-US", { minimumFractionDigits, maximumFractionDigits });
}

function formatAddressDisplay(address = {}) {
    return [
        address.house_block_lot_no,
        address.street,
        address.subdivision_village,
        address.barangay,
        address.city_municipality,
        address.province,
    ]
        .map(part => String(part ?? "").trim())
        .filter(Boolean)
        .join(", ");
}

function renderPrintTableRows(bodyId, rows, columns, minimumRows) {
    const tbody = document.getElementById(bodyId);
    if (!tbody) {
        return;
    }

    const safeRows = Array.isArray(rows) ? rows : [];
    const rowCount = Math.max(minimumRows, safeRows.length);

    tbody.innerHTML = Array.from({ length: rowCount }, (_, index) => {
        const row = safeRows[index] || {};
        return `
            <tr>
                ${columns.map(column => {
                    const rawValue = column.resolve ? column.resolve(row) : row[column.key];
                    const formattedValue = column.format ? column.format(rawValue, row) : rawValue;
                    return `<td>${escapeHtml(formattedValue ?? "")}&nbsp;</td>`;
                }).join("")}
            </tr>
        `;
    }).join("");
}

function renderPrintOtherInfoRows(skills, recognitions, memberships, minimumRows) {
    const tbody = document.getElementById("pds-print-other-info-body");
    if (!tbody) {
        return;
    }

    const safeSkills = Array.isArray(skills) ? skills : [];
    const safeRecognitions = Array.isArray(recognitions) ? recognitions : [];
    const safeMemberships = Array.isArray(memberships) ? memberships : [];
    const rowCount = Math.max(minimumRows, safeSkills.length, safeRecognitions.length, safeMemberships.length);

    tbody.innerHTML = Array.from({ length: rowCount }, (_, index) => `
        <tr>
            <td>${escapeHtml(safeSkills[index] ?? "")}&nbsp;</td>
            <td>${escapeHtml(safeRecognitions[index] ?? "")}&nbsp;</td>
            <td>${escapeHtml(safeMemberships[index] ?? "")}&nbsp;</td>
        </tr>
    `).join("");
}

function renderPrintEducationRows(education = {}) {
    const tbody = document.getElementById("pds-print-education-body");
    if (!tbody) {
        return;
    }

    const rows = [
        { label: "Elementary", data: education.elementary || {} },
        { label: "Secondary", data: education.secondary || {} },
        { label: "Vocational / Trade", data: education.vocational || {} },
        { label: "College", data: education.college || {} },
        { label: "Graduate Studies", data: education.graduate || {} },
    ];

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td>${escapeHtml(row.label)}</td>
            <td>${escapeHtml(row.data.school_name || "")}&nbsp;</td>
            <td>${escapeHtml(row.data.degree_course || "")}&nbsp;</td>
            <td>${escapeHtml(row.data.period_from || "")}&nbsp;</td>
            <td>${escapeHtml(row.data.period_to || "")}&nbsp;</td>
            <td>${escapeHtml(row.data.highest_level_units || "")}&nbsp;</td>
            <td>${escapeHtml(row.data.year_graduated || "")}&nbsp;</td>
            <td>${escapeHtml(row.data.honors || "")}&nbsp;</td>
        </tr>
    `).join("");
}

function renderPrintChecks(record) {
    document.querySelectorAll("[data-print-check]").forEach(element => {
        const [path, expected] = element.dataset.printCheck.split(":");
        const currentValue = String(getNestedValue(record, path) ?? "");
        element.textContent = currentValue === expected ? "/" : "";
    });
}

function buildEmployeeDisplay() {
    const employee = getEmployeeRecord(pdsState.employeeId);
    if (!employee) {
        return "";
    }

    return `${employee.employee_id} - ${employee.last_name}, ${employee.first_name}${employee.middle_name ? ` ${employee.middle_name}` : ""}`;
}

function buildSpouseBusinessContactDisplay(spouse = {}) {
    return [spouse.business_address, spouse.telephone_no]
        .map(value => String(value ?? "").trim())
        .filter(Boolean)
        .join("\n");
}

function renderPrintablePds(record = emptyPdsRecord()) {
    const normalizedRecord = {
        ...record,
        date_of_birth_display: formatDateDisplay(record.date_of_birth),
        government_id_date_of_issue_display: formatDateDisplay(record.government_id_date_of_issue),
        date_accomplished_display: formatDateDisplay(record.date_accomplished),
        height_m_display: formatNumberDisplay(record.height_m),
        weight_kg_display: formatNumberDisplay(record.weight_kg),
        residential_address_display: formatAddressDisplay(record.residential_address || {}),
        permanent_address_display: formatAddressDisplay(record.permanent_address || {}),
        residential_zip: record.residential_address?.zip_code || "",
        permanent_zip: record.permanent_address?.zip_code || "",
        employee_display: buildEmployeeDisplay(),
        spouse_business_contact_display: buildSpouseBusinessContactDisplay(record.spouse_information || {}),
    };

    document.querySelectorAll("[data-print-text]").forEach(element => {
        const value = getNestedValue(normalizedRecord, element.dataset.printText);
        element.textContent = value || "\u00A0";
    });
    renderPrintChecks(normalizedRecord);

    renderPrintTableRows("pds-print-children-body", record.children, [
        { key: "full_name" },
        { key: "birthdate", format: formatDateDisplay },
    ], 8);

    renderPrintEducationRows(record.educational_background || {});

    renderPrintTableRows("pds-print-eligibility-body", record.civil_service_eligibilities, [
        { key: "eligibility" },
        { key: "rating" },
        { key: "exam_date", format: formatDateDisplay },
        { key: "exam_place" },
        { key: "license_number" },
        { key: "validity" },
    ], 6);

    renderPrintTableRows("pds-print-work-body", record.work_experiences, [
        { key: "from", format: formatDateDisplay },
        { key: "to", format: formatDateDisplay },
        { key: "position_title" },
        { key: "agency_company" },
        { key: "monthly_salary", format: value => formatNumberDisplay(value, 2, 2) },
        { key: "salary_grade_step" },
        { key: "appointment_status" },
        { key: "government_service", format: value => String(value || "").toUpperCase() },
    ], 10);

    renderPrintTableRows("pds-print-voluntary-body", record.voluntary_works, [
        { key: "organization_address" },
        { key: "from", format: formatDateDisplay },
        { key: "to", format: formatDateDisplay },
        { key: "hours" },
        { key: "nature_of_work" },
    ], 5);

    renderPrintTableRows("pds-print-learning-body", record.learning_and_development, [
        { key: "title" },
        { key: "from", format: formatDateDisplay },
        { key: "to", format: formatDateDisplay },
        { key: "hours" },
        { key: "type" },
        { key: "conducted_by" },
    ], 7);

    renderPrintOtherInfoRows(record.special_skills, record.recognitions, record.memberships, 8);

    renderPrintTableRows("pds-print-references-body", record.references, [
        { key: "name" },
        { key: "address" },
        { key: "contact" },
    ], 3);
}

function preparePrintLayout() {
    renderPrintablePds(buildPayload());
}

function getAddress(prefix) {
    return {
        house_block_lot_no: getInputValue(`pds-${prefix}-house`),
        street: getInputValue(`pds-${prefix}-street`),
        subdivision_village: getInputValue(`pds-${prefix}-subdivision`),
        barangay: getInputValue(`pds-${prefix}-barangay`),
        city_municipality: getInputValue(`pds-${prefix}-city`),
        province: getInputValue(`pds-${prefix}-province`),
        zip_code: getInputValue(`pds-${prefix}-zip`),
    };
}

function setAddress(prefix, value = {}) {
    setInputValue(`pds-${prefix}-house`, value.house_block_lot_no);
    setInputValue(`pds-${prefix}-street`, value.street);
    setInputValue(`pds-${prefix}-subdivision`, value.subdivision_village);
    setInputValue(`pds-${prefix}-barangay`, value.barangay);
    setInputValue(`pds-${prefix}-city`, value.city_municipality);
    setInputValue(`pds-${prefix}-province`, value.province);
    setInputValue(`pds-${prefix}-zip`, value.zip_code);
}

function setStatus(text, theme = "light") {
    const badge = document.getElementById("pds-record-status");
    badge.className = `badge text-bg-${theme}`;
    badge.textContent = text;
}

function syncToolbarState() {
    const hasEmployee = !!pdsState.employeeId;
    document.getElementById("pds-save-btn").disabled = !hasEmployee;
    document.getElementById("pds-print-btn").disabled = !hasEmployee;
    document.getElementById("pds-delete-btn").disabled = !pdsState.recordId;
}

function buildFieldMarkup(sectionKey, rowIndex, column, value) {
    const commonAttrs = [
        `data-section="${sectionKey}"`,
        `data-row-index="${rowIndex}"`,
        `data-field="${column.key}"`,
        'class="form-control form-control-sm"',
    ];

    if (column.type === "select") {
        const options = column.options || [];
        const currentValue = value ?? "";
        return `
            <select ${commonAttrs.join(" ")}>
                ${options.map(option => `
                    <option value="${option.value}"${String(option.value) === String(currentValue) ? " selected" : ""}>
                        ${option.label}
                    </option>
                `).join("")}
            </select>
        `;
    }

    if (column.min !== undefined) {
        commonAttrs.push(`min="${column.min}"`);
    }

    if (column.step !== undefined) {
        commonAttrs.push(`step="${column.step}"`);
    }

    if (column.placeholder) {
        commonAttrs.push(`placeholder="${column.placeholder}"`);
    }

    commonAttrs.push(`type="${column.type || "text"}"`);
    commonAttrs.push(`value="${value ?? ""}"`);
    return `<input ${commonAttrs.join(" ")}>`;
}

function getSectionRows(sectionKey) {
    const config = pdsSectionConfigs[sectionKey];
    const tbody = document.getElementById(config.bodyId);
    const rows = [];

    tbody.querySelectorAll("tr").forEach(rowElement => {
        const rowData = {};
        config.columns.forEach(column => {
            const fieldElement = rowElement.querySelector(`[data-field="${column.key}"]`);
            rowData[column.key] = fieldElement ? fieldElement.value : "";
        });
        if (Object.values(rowData).some(value => value !== "")) {
            rows.push(rowData);
        }
    });

    return rows;
}

function renderSectionRows(sectionKey, rows = []) {
    const config = pdsSectionConfigs[sectionKey];
    const tbody = document.getElementById(config.bodyId);

    tbody.innerHTML = rows.map((row, rowIndex) => `
        <tr>
            ${config.columns.map(column => `<td>${buildFieldMarkup(sectionKey, rowIndex, column, row[column.key])}</td>`).join("")}
            <td class="text-center">
                <button type="button" class="btn btn-sm btn-outline-danger" data-remove-row="${sectionKey}" data-row-index="${rowIndex}">
                    Remove
                </button>
            </td>
        </tr>
    `).join("");
}

function addSectionRow(sectionKey) {
    const config = pdsSectionConfigs[sectionKey];
    const rows = getSectionRows(sectionKey);

    if (config.maxRows && rows.length >= config.maxRows) {
        alert(`Only ${config.maxRows} rows are allowed in this section.`);
        return;
    }

    rows.push(Object.fromEntries(config.columns.map(column => [column.key, ""])));
    renderSectionRows(sectionKey, rows);
}

function removeSectionRow(sectionKey, rowIndex) {
    const rows = getSectionRows(sectionKey);
    rows.splice(rowIndex, 1);
    renderSectionRows(sectionKey, rows);
}

function setEducationalBackground(value = {}) {
    educationLevels.forEach(level => {
        const levelData = value[level] || {};
        document.querySelectorAll(`[data-education-level="${level}"]`).forEach(input => {
            input.value = levelData[input.dataset.educationField] ?? "";
        });
    });
}

function getEducationalBackground() {
    const result = {};
    educationLevels.forEach(level => {
        const levelData = {};
        document.querySelectorAll(`[data-education-level="${level}"]`).forEach(input => {
            levelData[input.dataset.educationField] = input.value.trim();
        });
        result[level] = levelData;
    });
    return result;
}

function setQuestionnaire(value = {}) {
    questionnaireKeys.forEach(key => {
        const answer = value[key]?.answer ?? "";
        const details = value[key]?.details ?? "";
        const answerField = document.querySelector(`[data-question-key="${key}"][data-question-field="answer"]`);
        const detailsField = document.querySelector(`[data-question-key="${key}"][data-question-field="details"]`);
        if (answerField) {
            answerField.value = answer;
        }
        if (detailsField) {
            detailsField.value = details;
        }
        syncQuestionnaireDetailVisibility(key);
    });
}

function syncQuestionnaireDetailVisibility(key) {
    const answerField = document.querySelector(`[data-question-key="${key}"][data-question-field="answer"]`);
    const detailsField = document.querySelector(`[data-question-key="${key}"][data-question-field="details"]`);
    if (!answerField || !detailsField) {
        return;
    }

    const shouldShow = answerField.value === "yes";
    detailsField.hidden = !shouldShow;
    detailsField.required = shouldShow;

    if (!shouldShow) {
        detailsField.value = "";
    }
}

function bindQuestionnaireVisibility() {
    questionnaireKeys.forEach(key => {
        const answerField = document.querySelector(`[data-question-key="${key}"][data-question-field="answer"]`);
        if (!answerField) {
            return;
        }

        answerField.addEventListener("change", () => {
            syncQuestionnaireDetailVisibility(key);
        });
    });
}

function getQuestionnaire() {
    return Object.fromEntries(
        questionnaireKeys.map(key => {
            const answerField = document.querySelector(`[data-question-key="${key}"][data-question-field="answer"]`);
            const detailsField = document.querySelector(`[data-question-key="${key}"][data-question-field="details"]`);
            const answer = answerField ? answerField.value : "";
            return [key, {
                answer,
                details: answer === "yes" && detailsField ? detailsField.value.trim() : "",
            }];
        })
    );
}

function setFormData(record) {
    setInputValue("pds-surname", record.surname);
    setInputValue("pds-first-name", record.first_name);
    setInputValue("pds-middle-name", record.middle_name);
    setInputValue("pds-name-extension", record.name_extension);
    setInputValue("pds-date-of-birth", record.date_of_birth);
    setInputValue("pds-place-of-birth", record.place_of_birth);
    setInputValue("pds-sex", record.sex);
    setInputValue("pds-civil-status", record.civil_status);
    setInputValue("pds-civil-status-other", record.civil_status_other);
    setInputValue("pds-citizenship", record.citizenship);
    setInputValue("pds-citizenship-basis", record.citizenship_basis);
    setInputValue("pds-dual-citizenship-country", record.dual_citizenship_country);
    setInputValue("pds-height-m", record.height_m);
    setInputValue("pds-weight-kg", record.weight_kg);
    setInputValue("pds-blood-type", record.blood_type);
    setInputValue("pds-gsis-id", record.gsis_id_no);
    setInputValue("pds-pagibig-id", record.pagibig_id_no);
    setInputValue("pds-philhealth-no", record.philhealth_no);
    setInputValue("pds-sss-no", record.sss_no);
    setInputValue("pds-tin-no", record.tin_no);
    setInputValue("pds-agency-employee-no", record.agency_employee_no);
    setInputValue("pds-telephone-no", record.telephone_no);
    setInputValue("pds-mobile-no", record.mobile_no);
    setInputValue("pds-email-address", record.email_address);

    setAddress("residential", record.residential_address || {});
    setAddress("permanent", record.permanent_address || {});

    const spouse = record.spouse_information || {};
    setInputValue("pds-spouse-surname", spouse.surname);
    setInputValue("pds-spouse-first-name", spouse.first_name);
    setInputValue("pds-spouse-middle-name", spouse.middle_name);
    setInputValue("pds-spouse-extension", spouse.name_extension);
    setInputValue("pds-spouse-occupation", spouse.occupation);
    setInputValue("pds-spouse-employer", spouse.employer_business_name);
    setInputValue("pds-spouse-business-address", spouse.business_address);
    setInputValue("pds-spouse-telephone", spouse.telephone_no);

    const father = record.father_information || {};
    setInputValue("pds-father-surname", father.surname);
    setInputValue("pds-father-first-name", father.first_name);
    setInputValue("pds-father-middle-name", father.middle_name);
    setInputValue("pds-father-extension", father.name_extension);

    const mother = record.mother_information || {};
    setInputValue("pds-mother-surname", mother.surname);
    setInputValue("pds-mother-first-name", mother.first_name);
    setInputValue("pds-mother-middle-name", mother.middle_name);

    renderSectionRows("children", record.children || []);
    setEducationalBackground(record.educational_background || {});
    renderSectionRows("civil_service_eligibilities", record.civil_service_eligibilities || []);
    renderSectionRows("work_experiences", record.work_experiences || []);
    renderSectionRows("voluntary_works", record.voluntary_works || []);
    renderSectionRows("learning_and_development", record.learning_and_development || []);
    setListTextarea("pds-special-skills", record.special_skills || []);
    setListTextarea("pds-recognitions", record.recognitions || []);
    setListTextarea("pds-memberships", record.memberships || []);
    setQuestionnaire(record.questionnaire || emptyQuestionnaire());
    renderSectionRows("references", record.references || []);
    setInputValue("pds-government-id-type", record.government_id_type);
    setInputValue("pds-government-id-number", record.government_id_number);
    setInputValue("pds-government-id-date", record.government_id_date_of_issue);
    setInputValue("pds-government-id-place", record.government_id_place_of_issue);
    setInputValue("pds-date-accomplished", record.date_accomplished);
    renderPrintablePds(record);
}

function buildPayload() {
    return {
        employee: Number.parseInt(pdsState.employeeId, 10),
        surname: getInputValue("pds-surname"),
        first_name: getInputValue("pds-first-name"),
        middle_name: getInputValue("pds-middle-name"),
        name_extension: getInputValue("pds-name-extension"),
        date_of_birth: getInputValue("pds-date-of-birth") || null,
        place_of_birth: getInputValue("pds-place-of-birth"),
        sex: getInputValue("pds-sex"),
        civil_status: getInputValue("pds-civil-status"),
        civil_status_other: getInputValue("pds-civil-status-other"),
        citizenship: getInputValue("pds-citizenship"),
        citizenship_basis: getInputValue("pds-citizenship-basis"),
        dual_citizenship_country: getInputValue("pds-dual-citizenship-country"),
        height_m: parseNullableNumber(document.getElementById("pds-height-m").value),
        weight_kg: parseNullableNumber(document.getElementById("pds-weight-kg").value),
        blood_type: getInputValue("pds-blood-type"),
        gsis_id_no: getInputValue("pds-gsis-id"),
        pagibig_id_no: getInputValue("pds-pagibig-id"),
        philhealth_no: getInputValue("pds-philhealth-no"),
        sss_no: getInputValue("pds-sss-no"),
        tin_no: getInputValue("pds-tin-no"),
        agency_employee_no: getInputValue("pds-agency-employee-no"),
        residential_address: getAddress("residential"),
        permanent_address: getAddress("permanent"),
        telephone_no: getInputValue("pds-telephone-no"),
        mobile_no: getInputValue("pds-mobile-no"),
        email_address: getInputValue("pds-email-address"),
        spouse_information: {
            surname: getInputValue("pds-spouse-surname"),
            first_name: getInputValue("pds-spouse-first-name"),
            middle_name: getInputValue("pds-spouse-middle-name"),
            name_extension: getInputValue("pds-spouse-extension"),
            occupation: getInputValue("pds-spouse-occupation"),
            employer_business_name: getInputValue("pds-spouse-employer"),
            business_address: getInputValue("pds-spouse-business-address"),
            telephone_no: getInputValue("pds-spouse-telephone"),
        },
        father_information: {
            surname: getInputValue("pds-father-surname"),
            first_name: getInputValue("pds-father-first-name"),
            middle_name: getInputValue("pds-father-middle-name"),
            name_extension: getInputValue("pds-father-extension"),
        },
        mother_information: {
            surname: getInputValue("pds-mother-surname"),
            first_name: getInputValue("pds-mother-first-name"),
            middle_name: getInputValue("pds-mother-middle-name"),
        },
        children: getSectionRows("children"),
        educational_background: getEducationalBackground(),
        civil_service_eligibilities: getSectionRows("civil_service_eligibilities"),
        work_experiences: getSectionRows("work_experiences"),
        voluntary_works: getSectionRows("voluntary_works"),
        learning_and_development: getSectionRows("learning_and_development"),
        special_skills: normalizeStringList(document.getElementById("pds-special-skills").value),
        recognitions: normalizeStringList(document.getElementById("pds-recognitions").value),
        memberships: normalizeStringList(document.getElementById("pds-memberships").value),
        questionnaire: getQuestionnaire(),
        references: getSectionRows("references"),
        government_id_type: getInputValue("pds-government-id-type"),
        government_id_number: getInputValue("pds-government-id-number"),
        government_id_date_of_issue: getInputValue("pds-government-id-date") || null,
        government_id_place_of_issue: getInputValue("pds-government-id-place"),
        date_accomplished: getInputValue("pds-date-accomplished") || null,
    };
}

async function loadPdsForEmployee(employeeId) {
    if (!employeeId) {
        pdsState.recordId = null;
        pdsState.employeeId = null;
        setFormData(emptyPdsRecord());
        setStatus("No employee selected", "light");
        syncToolbarState();
        return;
    }

    pdsState.employeeId = String(employeeId);

    try {
        const response = await fetch(`/api/personal-data-sheets/?employee=${employeeId}`);
        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to load personal data sheet"));
        }

        const records = await response.json();
        if (records.length) {
            pdsState.recordId = records[0].pds_id;
            setFormData(records[0]);
            setStatus("Saved record loaded", "success");
        } else {
            const employee = getEmployeeRecord(employeeId);
            pdsState.recordId = null;
            setFormData(buildDefaultPdsForEmployee(employee || { id: employeeId }));
            setStatus("New sheet for selected employee", "warning");
        }
    } catch (err) {
        setStatus("Unable to load sheet", "danger");
        alert(err.message);
    }

    syncToolbarState();
}

async function savePds(event) {
    event.preventDefault();

    if (!pdsState.employeeId) {
        alert("Select an employee first.");
        return;
    }

    if (!document.getElementById("personal-data-sheet-form").reportValidity()) {
        return;
    }

    const payload = buildPayload();

    try {
        const response = await fetch(
            pdsState.recordId
                ? `/api/personal-data-sheets/${pdsState.recordId}/`
                : "/api/personal-data-sheets/",
            {
                method: pdsState.recordId ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrftoken,
                },
                body: JSON.stringify(payload),
            }
        );

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to save personal data sheet"));
        }

        const saved = await response.json();
        pdsState.recordId = saved.pds_id;
        setFormData(saved);
        setStatus("Personal data sheet saved", "success");
        syncToolbarState();
    } catch (err) {
        alert(err.message);
    }
}

async function deletePds() {
    if (!pdsState.recordId) {
        return;
    }

    const confirmed = confirm("Delete this personal data sheet?");
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/personal-data-sheets/${pdsState.recordId}/`, {
            method: "DELETE",
            headers: {
                "X-CSRFToken": csrftoken,
            },
        });

        if (!response.ok) {
            throw new Error(await readApiError(response, "Failed to delete personal data sheet"));
        }

        pdsState.recordId = null;
        const employee = getEmployeeRecord(pdsState.employeeId);
        setFormData(buildDefaultPdsForEmployee(employee || { id: pdsState.employeeId }));
        setStatus("Saved sheet deleted; draft reset", "warning");
        syncToolbarState();
    } catch (err) {
        alert(err.message);
    }
}

function bindSectionRowActions() {
    document.addEventListener("click", event => {
        const addButton = event.target.closest("[data-add-row]");
        if (addButton) {
            addSectionRow(addButton.dataset.addRow);
            return;
        }

        const removeButton = event.target.closest("[data-remove-row]");
        if (removeButton) {
            removeSectionRow(removeButton.dataset.removeRow, Number(removeButton.dataset.rowIndex));
        }
    });
}

function buildEmployeeOptions() {
    return Array.from(employeeState.records.values())
        .sort((left, right) => {
            const leftLabel = `${left.last_name}, ${left.first_name}`;
            const rightLabel = `${right.last_name}, ${right.first_name}`;
            return leftLabel.localeCompare(rightLabel);
        })
        .map(employee => ({
            value: employee.id,
            label: `${employee.employee_id} - ${employee.last_name}, ${employee.first_name}`,
        }));
}

Promise.all([loadEmployees()]).then(() => {
    const employeeSelect = document.getElementById("pds-employee-select");
    populateLookupSelect(employeeSelect, buildEmployeeOptions(), "Select employee");
    initializeSearchableSelects(document.getElementById("pds-page"), {
        selector: "#pds-employee-select",
        searchPlaceholder: "Search employees",
    });

    setFormData(emptyPdsRecord());
    renderSectionRows("children", []);
    renderSectionRows("civil_service_eligibilities", []);
    renderSectionRows("work_experiences", []);
    renderSectionRows("voluntary_works", []);
    renderSectionRows("learning_and_development", []);
    renderSectionRows("references", []);
    syncToolbarState();
    bindSectionRowActions();
    bindQuestionnaireVisibility();

    employeeSelect.addEventListener("change", event => {
        loadPdsForEmployee(event.target.value);
    });

    document.getElementById("personal-data-sheet-form").addEventListener("submit", savePds);
    document.getElementById("pds-delete-btn").addEventListener("click", deletePds);
    document.getElementById("pds-reset-btn").addEventListener("click", () => {
        loadPdsForEmployee(pdsState.employeeId);
    });
    document.getElementById("pds-print-btn").addEventListener("click", () => {
        if (!pdsState.employeeId) {
            alert("Select an employee first.");
            return;
        }
        preparePrintLayout();
        requestAnimationFrame(() => window.print());
    });
}).catch(err => {
    console.error("Failed to initialize personal data sheet page:", err);
    alert("Failed to initialize the personal data sheet page.");
});

window.addEventListener("beforeprint", preparePrintLayout);
