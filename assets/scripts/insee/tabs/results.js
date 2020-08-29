import {updateResults} from '../ui';
import * as form from '../form';
import * as api from '../api'
import * as content from "../content";
import * as warnings from "../warnings";
import {pluralize} from "../utils";

const table = $('#persons');

export const limitSelect = $('#limit');
limitSelect.selectpicker();

const pagination = $('ul.pagination');

const permalinkButton = $('#permalink');
const downloadGroupButton = $('#download-tooltip');
const downloadButton = $('#download-button');

const texts = $('#results-texts');

const noResults = $('div#no-results');

limitSelect.on('change', function () {
    const newResultsPerPage = parseInt(limitSelect.val());
    form.setCurrentPage(0); // Current behavior: reset to page 0
    //currentPage = Math.floor(currentPage * resultsPerPage / newResultsPerPage);
    form.setResultsPerPage(newResultsPerPage);

    updateResults();
});

$("a.left-arrow").click(function(e) {
    form.setCurrentPage(form.currentPage - 1);
    updateResults();
    e.preventDefault();
});
$("a.right-arrow").click(function(e) {
    form.setCurrentPage(form.currentPage + 1);
    updateResults();
    e.preventDefault();
});

export function setDisabled(disabled) {
    pagination.toggleClass('disabled', disabled);
    table.toggleClass('brighter', disabled);
    texts.toggleClass('brighter', disabled);
    permalinkButton.toggleClass('disabled', disabled);
    if(disabled) {
        downloadGroupButton.toggleClass('disabled', disabled);
        downloadButton.toggleClass('disabled', disabled);
    }
    limitSelect.prop('disabled', disabled);
    limitSelect.selectpicker('refresh');
    noResults.toggleClass('brighter', disabled);
}

$('#download-csv').on('click', function (e) {

    function downloadContent(data, filename, type) {
        const file = new Blob([data], {type: type});
        if (window.navigator.msSaveOrOpenBlob) // IE10+
            window.navigator.msSaveOrOpenBlob(file, filename);
        else { // Others
            const a = document.createElement("a"), url = URL.createObjectURL(file);
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(function () {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 0);
        }
    }

    api.getPersons(0, 100, form.surname, form.name, form.place, form.event, form.after, form.before, form.order)
        .done(function(data) {
            const lines = [];
            lines.push([__('insee.csv_fields.gender'), __('insee.csv_fields.surname'), __('insee.csv_fields.given'),
                __('insee.csv_fields.birth_date'), __('insee.csv_fields.birth_place'), __('insee.csv_fields.death_date'), __('insee.csv_fields.death_place')]);

            data.results.forEach(r => {
                lines.push([r.gender ? 'M' : 'F', r.nom, r.prenom, r.birthDate, r.birthPlace, r.deathDate, r.deathPlace]);
            });

            const valueSeparator = ',', lineSeparator = '\n', doubleQuotes = '"';

            const csv = lines.map(l => l.map(s => s ? s : '').map(s => s.includes(valueSeparator) ? doubleQuotes + s.replace(doubleQuotes, '\\"') + doubleQuotes : s).join(valueSeparator)).join(lineSeparator);

            function sanitize(filename) {
                return filename.replace(/[|&;$%@"<>()+,]/g, '');
            }

            const parts = [form.surname, form.name].map(s => s.trim()).filter(s => s.length > 0);

            downloadContent(csv, sanitize(__('insee.search_export') + ` '${parts.join(' ')}' (arbre.app - INSEE).csv`), 'text/csv');
        })
        .fail(function () {
            console.log("Impossible d'effectuer la requête");
        });

    e.preventDefault();
});

function displayPagination(totalPages) {
    $('ul.pagination > li:not(.navigation-arrow)').remove(); // Remove pages


    function pageButton(n, disabled, active) {
        return `<li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}"><a class="page-link" href="#" data-page="${n}">${n}</a></li>`
    }

    function normalButton(n) {
        return pageButton(n + 1, false,n === form.currentPage);
    }

    function ellipsisButton() {
        return pageButton('...', true, false);
    }

    let buttons = [];
    if(totalPages <= 7) { // Display all page buttons
        for(let i = 0; i < totalPages; i++) {
            buttons.push(normalButton(i));
        }
    } else {
        if(form.currentPage <= 3) {
            for(let i = 0; i < 5; i++) {
                buttons.push(normalButton(i));
            }
            buttons.push(ellipsisButton());
            buttons.push(normalButton(totalPages - 1));
        } else if(totalPages - 1 - form.currentPage <= 3) {
            buttons.push(normalButton(0));
            buttons.push(ellipsisButton());
            for(let i = -4; i <= 0; i++) {
                buttons.push(normalButton(totalPages - 1 + i));
            }
        } else {
            buttons.push(normalButton(0));
            buttons.push(ellipsisButton());
            for(let i = -1; i <= 1; i++) {
                buttons.push(normalButton(form.currentPage + i));
            }
            buttons.push(ellipsisButton());
            buttons.push(normalButton(totalPages - 1));
        }
    }

    const arrows = $('li.navigation-arrow');
    const leftArrow = $(arrows[0]), rightArrow = $(arrows[1]);
    buttons.forEach(b => rightArrow.before(b));

    $("a[data-page]").click(function(e) {
        form.setCurrentPage($(this).attr('data-page') - 1);
        updateResults();
        e.preventDefault();
    });

    if(form.currentPage === 0) leftArrow.addClass('disabled'); else leftArrow.removeClass('disabled');
    if(totalPages === 0 || form.currentPage === totalPages - 1) rightArrow.addClass('disabled'); else rightArrow.removeClass('disabled');
}

function displayTable(data) {
    const male = $('#male'), female = $('#female');

    data.results.forEach(row => {
        const tbody = $('<tbody></tbody>');
        const trFirst = $('<tr></tr>'), trSecond = trFirst.clone();
        function fa(icon, color) {
            return `<i class="fas fa-${icon} fa-lg" style="color:${color}"></i>`
        }
        function date(str) {
            if(str != null && str.length > 0) {
                const split = str.split('-');
                return split.reverse().join('/')
            } else {
                return str;
            }
        }
        let genderIcon;
        if(row.gender) { // Male
            genderIcon = male;
        } else { // Female
            genderIcon = female;
        }
        const fieldsShared = [genderIcon, row.nom.toUpperCase(), row.prenom];
        const fieldsFirst = [__('insee.birth') , date(row.birthDate), row.birthPlace];
        const fieldsSecond = [__('insee.death'), date(row.deathDate), row.deathPlace];
        let first = true;
        fieldsShared.forEach(f => {
            const row = $(`<td rowspan="2" class="${first ? 'text-center' : ''}"></td>`);
            if(first) { // Icon
                genderIcon.clone().appendTo(row);
            } else {
                row.html(f);
            }
            trFirst.append(row); // XSS! (nah, should be safe...)
            first = false;
        });
        fieldsFirst.forEach(f => {
            trFirst.append($('<td></td>').html(f));
        });
        fieldsSecond.forEach(f => {
            trSecond.append($('<td></td>').html(f));
        });
        tbody.append(trFirst, trSecond);

        table.append(tbody);
    });
}

export function displayResults(data, offset, limit) {
    const totalPages = Math.ceil(data.count / limit);
    form.setCurrentPage(Math.floor(offset / limit));

    displayPagination(totalPages);

    $('.count').text(data.count.toLocaleString('FR-fr') + ' ' + pluralize(data.count, __('insee.result'), __('insee.results')));

    // Math.max to address totalPages == 0
    $('#page-info').text(__('insee.page') + ' ' + (form.currentPage + 1) + ' ' + __('insee.of') + ' ' + Math.max(totalPages, 1));

    const tableDiv = $('#content-container');
    content.show();

    tableDiv.find('tbody').remove(); // Remove current content

    const nav = $('nav');

    table.removeClass('hidden');
    nav.removeClass('hidden');
    noResults.addClass('hidden');

    if(data.count === 0) { // No results
        table.addClass('hidden');
        nav.addClass('hidden');
        noResults.removeClass('hidden');
    }

    warnings.display();

    if(data.count > 0 && data.count <= 100) {
        downloadButton.removeClass('disabled');
        downloadGroupButton.tooltip('disable');
    } else {
        downloadButton.addClass('disabled');
        downloadGroupButton.tooltip('enable');
    }

    displayTable(data);

    setDisabled(false);

    form.setResetable(true);
}
