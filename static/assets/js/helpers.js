function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

const csrftoken = getCookie('csrftoken');

async function readApiError(response, fallbackMessage = 'Request failed') {
    try {
        const data = await response.json();

        if (typeof data === 'string') {
            return data;
        }

        if (Array.isArray(data)) {
            return data.join(', ');
        }

        if (data && typeof data === 'object') {
            if (data.detail) {
                return data.detail;
            }

            return Object.entries(data)
                .map(([field, messages]) => `${field}: ${[].concat(messages).join(', ')}`)
                .join(' | ');
        }
    } catch (err) {
        console.error('Failed to parse API error response:', err);
    }

    return fallbackMessage;
}

const employeeState = {
    options: [],
    lookup: new Map(),
    reverseLookup: new Map(),
    records: new Map(),
};

function loadEmployees() {
    return fetch('/api/employees/')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load employees');
            return res.json();
        })
        .then(data => {
            employeeState.options = data.map(d => {
                const value = d.id ?? d.employee_id;
                const label = `${d.first_name} ${d.last_name}`;
                return { value, label };
            }).filter(d => d.value !== undefined && d.value !== null);
            employeeState.lookup = new Map(employeeState.options.map(o => [String(o.value), o.label]));
            employeeState.reverseLookup = new Map(employeeState.options.map(o => [o.label, o.value]));
            employeeState.records = new Map(
                data
                    .filter(d => (d.id ?? d.employee_id) !== undefined && (d.id ?? d.employee_id) !== null)
                    .map(d => [String(d.id ?? d.employee_id), d])
            );
        })
        .catch(err => {
            console.error(err);
            employeeState.options = [];
            employeeState.lookup = new Map();
            employeeState.reverseLookup = new Map();
            employeeState.records = new Map();
        });
}

function formatEmployeeReference(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const normalized = String(value);
    return employeeState.lookup.get(normalized) || normalized;
}

function resolveEmployeeReference(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const normalized = String(value).trim();

    if (employeeState.lookup.has(normalized)) {
        const parsed = parseInt(normalized, 10);
        return Number.isNaN(parsed) ? normalized : parsed;
    }

    if (employeeState.reverseLookup.has(normalized)) {
        return employeeState.reverseLookup.get(normalized);
    }

    const parsed = parseInt(normalized, 10);
    return Number.isNaN(parsed) ? normalized : parsed;
}

function getEmployeeRecord(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const resolvedValue = resolveEmployeeReference(value);
    if (resolvedValue === null || resolvedValue === undefined || resolvedValue === '') {
        return null;
    }

    return employeeState.records.get(String(resolvedValue)) || null;
}

const divisionState = {
    options: [],
    lookup: new Map(),
    reverseLookup: new Map()
};

function loadDivisions() {
    return fetch('/api/divisions/')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load divisions');
            return res.json();
        })
        .then(data => {
            divisionState.options = data.map(d => {
                const value = d.id ?? d.division_id;
                const label = d.division_name ?? d.name ?? `Division ${value}`;
                return { value, label };
            }).filter(d => d.value !== undefined && d.value !== null);
            divisionState.lookup = new Map(divisionState.options.map(o => [String(o.value), o.label]));
            divisionState.reverseLookup = new Map(divisionState.options.map(o => [o.label, o.value]));
        })
        .catch(err => {
            console.error(err);
            divisionState.options = [];
            divisionState.lookup = new Map();
            divisionState.reverseLookup = new Map();
        });
}

function formatDivisionReference(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const normalized = String(value);
    return divisionState.lookup.get(normalized) || normalized;
}

function resolveDivisionReference(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const normalized = String(value).trim();

    if (divisionState.lookup.has(normalized)) {
        const parsed = parseInt(normalized, 10);
        return Number.isNaN(parsed) ? normalized : parsed;
    }

    if (divisionState.reverseLookup.has(normalized)) {
        return divisionState.reverseLookup.get(normalized);
    }

    const parsed = parseInt(normalized, 10);
    return Number.isNaN(parsed) ? normalized : parsed;
}

const positionState = {
    options: [],
    lookup: new Map(),
    reverseLookup: new Map()
};

function loadPositions() {
    return fetch('/api/positions/')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load positions');
            return res.json();
        })
        .then(data => {
            positionState.options = data.map(d => {
                const value = d.id ?? d.position_id;
                const label = d.position_name ?? d.name ?? `Position ${value}`;
                return { value, label };
            }).filter(d => d.value !== undefined && d.value !== null);
            positionState.lookup = new Map(positionState.options.map(o => [String(o.value), o.label]));
            positionState.reverseLookup = new Map(positionState.options.map(o => [o.label, o.value]));
        })
        .catch(err => {
            console.error(err);
            positionState.options = [];
            positionState.lookup = new Map();
            positionState.reverseLookup = new Map();
        });
}

function formatPositionReference(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const normalized = String(value);
    return positionState.lookup.get(normalized) || normalized;
}

function resolvePositionReference(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const normalized = String(value).trim();

    if (positionState.lookup.has(normalized)) {
        const parsed = parseInt(normalized, 10);
        return Number.isNaN(parsed) ? normalized : parsed;
    }

    if (positionState.reverseLookup.has(normalized)) {
        return positionState.reverseLookup.get(normalized);
    }

    const parsed = parseInt(normalized, 10);
    return Number.isNaN(parsed) ? normalized : parsed;
}

const salaryGradeState = {
    options: [],
    lookup: new Map(),
    reverseLookup: new Map(),
    records: new Map(),
};

function loadSalaryGrades() {
    return fetch('/api/salary_grades/')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load salary grades');
            return res.json();
        })
        .then(data => {
            salaryGradeState.options = data.map(record => {
                const value = record.salary_grade_id;
                const label = `SG ${record.csc_grade}`;
                return { value, label };
            }).filter(option => option.value !== undefined && option.value !== null);
            salaryGradeState.lookup = new Map(salaryGradeState.options.map(option => [String(option.value), option.label]));
            salaryGradeState.reverseLookup = new Map(salaryGradeState.options.map(option => [option.label, option.value]));
            salaryGradeState.records = new Map(
                data
                    .filter(record => record.salary_grade_id !== undefined && record.salary_grade_id !== null)
                    .map(record => [String(record.salary_grade_id), record])
            );
        })
        .catch(err => {
            console.error(err);
            salaryGradeState.options = [];
            salaryGradeState.lookup = new Map();
            salaryGradeState.reverseLookup = new Map();
            salaryGradeState.records = new Map();
        });
}

function formatSalaryGradeReference(value) {
    if (value === null || value === undefined || value === '') {
        return '';
    }

    const normalized = String(value);
    return salaryGradeState.lookup.get(normalized) || normalized;
}

function resolveSalaryGradeReference(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    const normalized = String(value).trim();

    if (salaryGradeState.lookup.has(normalized)) {
        const parsed = parseInt(normalized, 10);
        return Number.isNaN(parsed) ? normalized : parsed;
    }

    if (salaryGradeState.reverseLookup.has(normalized)) {
        return salaryGradeState.reverseLookup.get(normalized);
    }

    const parsed = parseInt(normalized, 10);
    return Number.isNaN(parsed) ? normalized : parsed;
}

function getSalaryGradeRecord(value) {
    const resolvedValue = resolveSalaryGradeReference(value);

    if (resolvedValue === null || resolvedValue === undefined || resolvedValue === '') {
        return null;
    }

    return salaryGradeState.records.get(String(resolvedValue)) || null;
}

function getSalaryAmountForStep(salaryGradeValue, salaryStepValue) {
    const salaryGradeRecord = getSalaryGradeRecord(salaryGradeValue);
    const salaryStep = parseInt(salaryStepValue, 10);

    if (!salaryGradeRecord || Number.isNaN(salaryStep) || salaryStep < 1 || salaryStep > 8) {
        return null;
    }

    return salaryGradeRecord[`step_${salaryStep}`] ?? null;
}

function getSalaryStepOptionsForGrade(salaryGradeValue) {
    const salaryGradeRecord = getSalaryGradeRecord(salaryGradeValue);

    if (!salaryGradeRecord) {
        return [];
    }

    return Array.from({ length: 8 }, (_, index) => index + 1)
        .filter(step => salaryGradeRecord[`step_${step}`] !== null && salaryGradeRecord[`step_${step}`] !== undefined)
        .map(step => ({
            value: step,
            label: `Step ${step}`,
        }));
}

function normalizeLookupOptions(options = []) {
    return options
        .filter(option => option && option.value !== undefined && option.value !== null)
        .map(option => ({
            value: option.value,
            label: option.label ?? String(option.value),
        }));
}

function buildSearchableListEditorParams(options, {
    clearable = false,
    placeholder = "Select an option",
    searchPlaceholder = "Search options",
} = {}) {
    return {
        values: normalizeLookupOptions(options),
        clearable,
        placeholder,
        searchPlaceholder,
    };
}

const searchableSelectRegistry = new WeakMap();
const searchableSelectStates = new Set();
let searchableSelectEventsBound = false;

function getSearchableSelectNow() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }

    return Date.now();
}

function getSelectPlaceholder(select) {
    const emptyOption = Array.from(select.options).find(option => option.value === "");
    return emptyOption?.textContent?.trim() || select.dataset.placeholder || "Select an option";
}

function getSelectLabelText(select) {
    if (!select.id) {
        return "Select an option";
    }

    const label = document.querySelector(`label[for="${select.id}"]`);
    return label?.textContent?.trim() || "Select an option";
}

function getSearchableSelectOptions(select) {
    return Array.from(select.options)
        .map((option, index) => ({
            index,
            value: option.value,
            label: option.textContent.trim(),
            disabled: option.disabled,
            hidden: option.hidden,
        }))
        .filter(option => !option.hidden);
}

function getSelectedOption(select) {
    const selectedIndex = select.selectedIndex;
    if (selectedIndex < 0) {
        return null;
    }

    return select.options[selectedIndex] || null;
}

function closeSearchableSelect(state, { keepSearch = false } = {}) {
    state.root.classList.remove("is-open");
    state.trigger.setAttribute("aria-expanded", "false");

    if (!keepSearch) {
        state.searchInput.value = "";
    }

    renderSearchableSelectOptions(state);
}

function closeAllSearchableSelects(exceptSelect = null) {
    searchableSelectStates.forEach(state => {
        if (state.select !== exceptSelect) {
            closeSearchableSelect(state);
        }
    });
}

function updateSearchableSelectTrigger(state) {
    const selectedOption = getSelectedOption(state.select);
    const hasValue = !!selectedOption && selectedOption.value !== "";

    state.triggerLabel.textContent = hasValue
        ? selectedOption.textContent.trim()
        : getSelectPlaceholder(state.select);

    state.trigger.classList.toggle("is-placeholder", !hasValue);
    state.trigger.disabled = state.select.disabled;
}

function renderSearchableSelectOptions(state) {
    const searchTerm = state.searchInput.value.trim().toLowerCase();
    const currentValue = String(state.select.value ?? "");
    const options = getSearchableSelectOptions(state.select).filter(option => {
        if (!searchTerm) {
            return true;
        }

        return option.label.toLowerCase().includes(searchTerm)
            || String(option.value).toLowerCase().includes(searchTerm);
    });

    if (!options.length) {
        state.optionsContainer.innerHTML = `
            <div class="hcm-searchable-select__empty">
                No matching results
            </div>
        `;
        return;
    }

    state.optionsContainer.innerHTML = options.map(option => `
        <button
            type="button"
            class="hcm-searchable-select__option${String(option.value) === currentValue ? " is-selected" : ""}${option.disabled ? " is-disabled" : ""}"
            data-option-index="${option.index}"
            ${option.disabled ? "disabled" : ""}
        >
            <span class="hcm-searchable-select__option-label">${option.label}</span>
            ${String(option.value) === currentValue ? '<i class="ti ti-check hcm-searchable-select__option-check"></i>' : ""}
        </button>
    `).join("");
}

function openSearchableSelect(state) {
    if (state.select.disabled) {
        return;
    }

    closeAllSearchableSelects(state.select);
    state.root.classList.add("is-open");
    state.trigger.setAttribute("aria-expanded", "true");
    state.suppressOutsideCloseUntil = getSearchableSelectNow() + 180;
    renderSearchableSelectOptions(state);

    window.setTimeout(() => {
        state.searchInput.focus();
        state.searchInput.select();
    }, 0);
}

function refreshSearchableSelect(select) {
    const state = searchableSelectRegistry.get(select);
    if (!state) {
        return;
    }

    updateSearchableSelectTrigger(state);
    renderSearchableSelectOptions(state);
}

function destroySearchableSelect(select) {
    const state = searchableSelectRegistry.get(select);
    if (!state) {
        return;
    }

    searchableSelectStates.delete(state);
    searchableSelectRegistry.delete(select);

    if (state.root?.parentNode) {
        state.root.remove();
    }
}

function bindSearchableSelectEvents() {
    if (searchableSelectEventsBound) {
        return;
    }

    document.addEventListener("click", event => {
        searchableSelectStates.forEach(state => {
            if (getSearchableSelectNow() < (state.suppressOutsideCloseUntil || 0)) {
                return;
            }

            if (!state.root.contains(event.target) && event.target !== state.select) {
                closeSearchableSelect(state);
            }
        });
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeAllSearchableSelects();
        }
    });

    searchableSelectEventsBound = true;
}

function enhanceSearchableSelect(select, options = {}) {
    if (!(select instanceof HTMLSelectElement)) {
        return null;
    }

    const existingState = searchableSelectRegistry.get(select);
    if (existingState) {
        existingState.searchInput.placeholder = options.searchPlaceholder || "Search options";
        existingState.keepOpenOnSelect = options.keepOpenOnSelect !== false;
        refreshSearchableSelect(select);
        return existingState;
    }

    const root = document.createElement("div");
    root.className = "hcm-searchable-select";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "hcm-searchable-select__trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", getSelectLabelText(select));

    const triggerLabel = document.createElement("span");
    triggerLabel.className = "hcm-searchable-select__trigger-label";
    trigger.appendChild(triggerLabel);

    const triggerIcon = document.createElement("i");
    triggerIcon.className = "ti ti-chevron-down hcm-searchable-select__trigger-icon";
    trigger.appendChild(triggerIcon);

    const menu = document.createElement("div");
    menu.className = "hcm-searchable-select__menu";

    const searchWrap = document.createElement("div");
    searchWrap.className = "hcm-searchable-select__search-wrap";

    const searchIcon = document.createElement("i");
    searchIcon.className = "ti ti-search hcm-searchable-select__search-icon";
    searchWrap.appendChild(searchIcon);

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "hcm-searchable-select__search-input";
    searchInput.placeholder = options.searchPlaceholder || "Search options";
    searchInput.autocomplete = "off";
    searchWrap.appendChild(searchInput);

    const optionsContainer = document.createElement("div");
    optionsContainer.className = "hcm-searchable-select__options";
    optionsContainer.setAttribute("role", "listbox");

    menu.appendChild(searchWrap);
    menu.appendChild(optionsContainer);

    root.appendChild(trigger);
    root.appendChild(menu);

    select.classList.add("hcm-searchable-select__native");
    select.insertAdjacentElement("afterend", root);

    const state = {
        select,
        root,
        trigger,
        triggerLabel,
        searchInput,
        optionsContainer,
        keepOpenOnSelect: options.keepOpenOnSelect !== false,
        suppressOutsideCloseUntil: 0,
    };

    searchableSelectRegistry.set(select, state);
    searchableSelectStates.add(state);

    trigger.addEventListener("click", event => {
        event.preventDefault();

        if (root.classList.contains("is-open")) {
            closeSearchableSelect(state);
            return;
        }

        openSearchableSelect(state);
    });

    trigger.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            openSearchableSelect(state);
        }
    });

    searchInput.addEventListener("input", () => {
        renderSearchableSelectOptions(state);
    });

    searchInput.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeSearchableSelect(state);
            trigger.focus();
            return;
        }

        if (event.key === "Enter") {
            const firstOption = optionsContainer.querySelector(".hcm-searchable-select__option:not(.is-disabled)");
            if (firstOption) {
                event.preventDefault();
                firstOption.click();
            }
        }
    });

    optionsContainer.addEventListener("click", event => {
        const optionButton = event.target.closest(".hcm-searchable-select__option");
        if (!optionButton || optionButton.classList.contains("is-disabled")) {
            return;
        }

        const optionIndex = Number(optionButton.dataset.optionIndex);
        const option = select.options[optionIndex];
        if (!option) {
            return;
        }

        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refreshSearchableSelect(select);

        if (state.keepOpenOnSelect) {
            state.searchInput.value = "";
            renderSearchableSelectOptions(state);
            window.setTimeout(() => {
                if (state.root.classList.contains("is-open")) {
                    state.searchInput.focus({ preventScroll: true });
                }
            }, 0);
            return;
        }

        closeSearchableSelect(state);
        trigger.focus();
    });

    select.addEventListener("change", () => {
        refreshSearchableSelect(select);
    });

    if (select.form) {
        select.form.addEventListener("reset", () => {
            window.setTimeout(() => {
                refreshSearchableSelect(select);
                closeSearchableSelect(state);
            }, 0);
        });
    }

    bindSearchableSelectEvents();
    refreshSearchableSelect(select);

    return state;
}

function initializeSearchableSelects(root = document, options = {}) {
    if (!root || typeof root.querySelectorAll !== "function") {
        return;
    }

    root.querySelectorAll(options.selector || "select").forEach(select => {
        enhanceSearchableSelect(select, options);
    });
}

function searchableDropdownEditor(cell, onRendered, success, cancel, editorParams = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "hcm-tabulator-dropdown-editor";

    const select = document.createElement("select");
    select.className = "form-select";

    const placeholder = editorParams.placeholder || "Select an option";
    const searchPlaceholder = editorParams.searchPlaceholder || "Search options";
    const options = normalizeLookupOptions(editorParams.values || []);
    const currentValue = cell.getValue();

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = placeholder;
    if (!editorParams.clearable) {
        emptyOption.disabled = true;
        emptyOption.hidden = true;
    }
    select.appendChild(emptyOption);

    options.forEach(option => {
        const optionElement = document.createElement("option");
        optionElement.value = String(option.value);
        optionElement.textContent = option.label;
        select.appendChild(optionElement);
    });

    select.value = currentValue === null || currentValue === undefined ? "" : String(currentValue);
    wrapper.appendChild(select);

    const initialValue = select.value;
    const state = enhanceSearchableSelect(select, {
        searchPlaceholder,
        keepOpenOnSelect: true,
    });
    let finished = false;

    const complete = callback => {
        if (finished) {
            return;
        }

        finished = true;
        destroySearchableSelect(select);
        callback();
    };

    wrapper.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            complete(cancel);
        }
    });

    wrapper.addEventListener("focusout", () => {
        window.setTimeout(() => {
            if (!finished && !wrapper.contains(document.activeElement)) {
                if (select.value !== initialValue) {
                    complete(() => success(select.value));
                    return;
                }

                complete(cancel);
            }
        }, 0);
    });

    onRendered(() => {
        wrapper.style.minWidth = `${Math.max(cell.getElement().offsetWidth, 220)}px`;
        window.setTimeout(() => {
            if (finished) {
                return;
            }

            state.trigger.focus({ preventScroll: true });
            openSearchableSelect(state);
        }, 0);
    });

    return wrapper;
}
