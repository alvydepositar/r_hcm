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

const employeeState = {
    options: [],
    lookup: new Map()
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
        })
        .catch(err => {
            console.error(err);
            employeeState.options = [];
            employeeState.lookup = new Map();
        });
}

function renderEmployeeSelect(selectedValue) {
    const options = employeeState.options.length
        ? employeeState.options
        : [{ value: '', label: 'Select employee' }];
    return `
        <select class="form-select form-select-sm dt-inline-input">
            ${options.map(o => {
                const isSelected = String(o.value) === String(selectedValue ?? '');
                return `<option value="${o.value}" ${isSelected ? 'selected' : ''}>${o.label}</option>`;
            }).join('')}
        </select>
    `;
}

const divisionState = {
    options: [],
    lookup: new Map()
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
        })
        .catch(err => {
            console.error(err);
            divisionState.options = [];
            divisionState.lookup = new Map();
        });
}

function renderDivisionSelect(selectedValue) {
    const options = divisionState.options.length
        ? divisionState.options
        : [{ value: '', label: 'Select division' }];

    return `
        <select class="form-select form-select-sm dt-inline-input">
            ${options.map(o => {
                const isSelected = String(o.value) === String(selectedValue ?? '');
                return `<option value="${o.value}" ${isSelected ? 'selected' : ''}>${o.label}</option>`;
            }).join('')}
        </select>
    `;
}

const positionState = {
    options: [],
    lookup: new Map()
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
        })
        .catch(err => {
            console.error(err);
            positionState.options = [];
            positionState.lookup = new Map();
        });
}

function renderPositionSelect(selectedValue) {
    const options = positionState.options.length
        ? positionState.options
        : [{ value: '', label: 'Select position' }];

    return `
        <select class="form-select form-select-sm dt-inline-input">
            ${options.map(o => {
                const isSelected = String(o.value) === String(selectedValue ?? '');
                return `<option value="${o.value}" ${isSelected ? 'selected' : ''}>${o.label}</option>`;
            }).join('')}
        </select>
    `;
}
