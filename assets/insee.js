import './scripts/vendor/jquery'
import './scripts/vendor/bootstrap'
import 'bootstrap-select'

import './scss/insee.scss'


import {dom, library} from '@fortawesome/fontawesome-svg-core'

import { faBook, faFileCsv, faFileDownload, faFilter, faInfoCircle, faLink, faLongArrowAltLeft, faMars, faSearch, faSort, faVenus, faUndoAlt } from '@fortawesome/free-solid-svg-icons'
import {faGithub} from '@fortawesome/free-brands-svg-icons'

library.add(faBook, faSearch, faMars, faVenus, faInfoCircle, faLongArrowAltLeft, faFileDownload, faFileCsv, faFilter, faSort, faLink, faUndoAlt);

library.add(faGithub);

dom.i2svg();

dom.watch(); // Important because we are dynamically adding icons

// ---

const HOST_API = "https://insee.arbre.app/", HOST_FRONT = "https://arbre.app/insee";

let currentPage = 0, resultsPerPage = 25;
let preservePage = false;

const placeSelect = $('#place');
placeSelect.selectpicker({
    noneSelectedText : 'Lieu (commune, département, région ou pays)',
    noneResultsText: 'Aucun lieu trouvé',
    liveSearchPlaceholder: 'Commune, département, région ou pays'
});

$('.bs-searchbox > input').attr('autocomplete', 'random'); // Disable autocomplete

placeSelect.on('shown.bs.select', function () {
    placeSelect.empty();
    placeSelect.selectpicker('refresh');
});

const limitSelect = $('#limit');
limitSelect.selectpicker();

limitSelect.on('change', function () {
    const newResultsPerPage = parseInt(limitSelect.val());
    currentPage = 0; // Current behavior: reset to page 0
    //currentPage = Math.floor(currentPage * resultsPerPage / newResultsPerPage);
    resultsPerPage = newResultsPerPage;

    updateResults();
});

let placeRequestIndex = 1, lastReceived = 0;
jQuery("select#place").siblings().find("input[type='text']").keyup(function (e) {
    const search = $(this).val();

    const requestIndex = placeRequestIndex;
    placeRequestIndex++;


    if(search.trim().length > 0) {

        getPlaces(10, search)
            .done(function(data) {
                if(requestIndex > lastReceived) {
                    placeSelect.empty();
                    data.results.forEach(r => {
                        const option = $('<option>', {
                            value: r.id,
                            text: r.fullname
                        });
                        placeSelect.append(option);
                    });
                    placeSelect.selectpicker('refresh');

                    lastReceived = requestIndex;
                }
            });
    } else {
        placeSelect.empty();
        placeSelect.selectpicker('refresh');

        lastReceived = requestIndex;
    }
});

function scrollToTop() {
    $('html,body').animate({scrollTop: 0}, 'fast');
}

$("a.left-arrow").click(function(e) {
    currentPage--;
    updateResults();
    e.preventDefault();
});
$("a.right-arrow").click(function(e) {
    currentPage++;
    updateResults();
    e.preventDefault();
});

const reset = $('#reset');

function displayResults(data, offset, limit) {
    const totalPages = Math.ceil(data.count / limit);
    currentPage = Math.floor(offset / limit);

    const ul = $('ul.pagination');
    $('ul.pagination > li:not(.navigation-arrow)').remove(); // Remove pages


    function pageButton(n, disabled, active) {
        return `<li class="page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}"><a class="page-link" href="#" data-page="${n}">${n}</a></li>`
    }

    function normalButton(n) {
        return pageButton(n + 1, false,n === currentPage);
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
        if(currentPage <= 3) {
            for(let i = 0; i < 5; i++) {
                buttons.push(normalButton(i));
            }
            buttons.push(ellipsisButton());
            buttons.push(normalButton(totalPages - 1));
        } else if(totalPages - 1 - currentPage <= 3) {
            buttons.push(normalButton(0));
            buttons.push(ellipsisButton());
            for(let i = -4; i <= 0; i++) {
                buttons.push(normalButton(totalPages - 1 + i));
            }
        } else {
            buttons.push(normalButton(0));
            buttons.push(ellipsisButton());
            for(let i = -1; i <= 1; i++) {
                buttons.push(normalButton(currentPage + i));
            }
            buttons.push(ellipsisButton());
            buttons.push(normalButton(totalPages - 1));
        }
    }

    const arrows = $('li.navigation-arrow');
    const leftArrow = $(arrows[0]), rightArrow = $(arrows[1]);
    buttons.forEach(b => rightArrow.before(b));

    $("a[data-page]").click(function(e) {
        currentPage = $(this).attr('data-page') - 1;
        updateResults();
        e.preventDefault();
    });

    if(currentPage === 0) leftArrow.addClass('disabled'); else leftArrow.removeClass('disabled');
    if(totalPages === 0 || currentPage === totalPages - 1) rightArrow.addClass('disabled'); else rightArrow.removeClass('disabled');


    $('#count').text(data.count.toLocaleString('FR-fr') + ' résultat' + (data.count > 1 ? 's' : ''));

    // Math.max to address totalPages == 0
    $('#page-info').text(`Page ${currentPage + 1} sur ${Math.max(totalPages, 1)}`);

    const tableDiv = $('#table-container');
    tableDiv.removeClass('hidden');

    $('tbody').remove(); // Remove current content

    const table = $('#persons');

    table.removeClass('brighter');

    const nav = $('nav');
    const noResults = $('div#no-results');

    const downloadGroup = $('#download-tooltip');
    const downloadButton = $('#download-button');

    table.removeClass('hidden');
    nav.removeClass('hidden');
    noResults.addClass('hidden');
    if(data.count === 0) { // No results
        table.addClass('hidden');
        nav.addClass('hidden');
        noResults.removeClass('hidden');
    }

    if(data.count > 0 && data.count <= 100) {
        downloadButton.removeClass('disabled');
        downloadGroup.tooltip('disable');
    } else {
        downloadButton.addClass('disabled');
        downloadGroup.tooltip('enable');
    }

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
        const fieldsFirst = ['Naissance' , date(row.birthDate), row.birthPlace];
        const fieldsSecond = ['Décès', date(row.deathDate), row.deathPlace];
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

    reset.removeClass('hidden');
}

function resetForm() {
    $('#surname').val('');
    $('#name').val('');
    placeSelect.empty();
    placeSelect.selectpicker('refresh');
    $('#event').val('birth');
    $('#after').val('');
    $('#before').val('');
    $('#order').val('ascending');
    $('#reset').addClass('hidden');
    $('#table-container').addClass('hidden');
}

reset.click(function(e) {
    e.preventDefault();
    resetForm();
});

let surname = '', name = '', place = 0, event = '', after = '', before = '', order = '';

function updateResults() {
    const offset = currentPage * resultsPerPage, limit = resultsPerPage;

    const pagination = $('ul.pagination');
    pagination.addClass('disabled');

    setFormDisabled(true);
    getPersons(offset, limit, surname, name, place, event, after, before, order)
        .done(function(data) {
            displayResults(data, offset, limit);
        })
        .always(function () {
            pagination.removeClass('disabled');
            setFormDisabled(false);
        });

    $('#persons').addClass('brighter');

    scrollToTop();
}

$('#search').click(function(e) {

    const surnameElement = $('#surname');

    surname = surnameElement.val();
    name = $('#name').val();
    place = placeSelect.val();
    event = $('#event').val();
    after = $('#after').val();
    before = $('#before').val();
    order = $('#order').val();

    surnameElement.removeClass('is-invalid');
    if(surname.trim().length > 0) {
        if(!preservePage) {
            currentPage = 0;
        } else {
            preservePage = false;
        }

        updateResults();
    } else {
        surnameElement.addClass('is-invalid');
    }

    e.preventDefault();
});

let errorFlag = false;

function getPersons(offset, limit, surname, name, place, event, after, before, order) {
    errorFlag = false;
    return $.get(HOST_API + "persons", {
        offset: offset,
        limit: limit,
        surname: surname,
        name: name,
        place: place,
        event: event,
        after: after,
        before: before,
        order: order
    }).fail(failureFallback);
}

function getPlaces(limit, prefix) {
    errorFlag = false;
    return $.get(HOST_API + "places", {
        limit: limit,
        prefix: prefix
    }).fail(failureFallback);
}

function failureFallback(xhr, status, error) {
    console.log("Request error");

    if(xhr.status === 503 && xhr.hasOwnProperty('responseJSON') && !errorFlag) { // An information should be displayed
        errorFlag = true;

        const json = xhr.responseJSON;

        const modal = $('#server-message');
        const content = $('#server-message-content');
        let message;
        if(json.hasOwnProperty('information')) { // A message is available
            message = json.information;
        } else { // No message provided
            message = 'Le serveur n\'est actuellement pas en mesure de traiter votre requête.';
        }

        content.text(message);

        modal.modal('show');
    }
}

function setFormDisabled(disabled) {
    $("form input, form button, form select").prop("disabled", disabled);
}

$('document').ready(function() {
    $('[data-toggle=tooltip]').tooltip(); // Tooltips
});

$('#help').on('click', function () { // Help button
    $('#help-modal').modal('show');
});

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

    getPersons(0, 100, surname, name, place, event, after, before, order)
        .done(function(data) {
            const lines = [];
            lines.push(['sexe', 'noms', 'prenoms', 'date_naissance', 'lieu_naissance', 'date_deces', 'lieu_deces']);

            data.results.forEach(r => {
                lines.push([r.gender ? 'M' : 'F', r.nom, r.prenom, r.birthDate, r.birthPlace, r.deathDate, r.deathPlace]);
            });

            const valueSeparator = ',', lineSeparator = '\n', doubleQuotes = '"';

            const csv = lines.map(l => l.map(s => s.includes(valueSeparator) ? doubleQuotes + s.replace(doubleQuotes, '\\"') + doubleQuotes : s).join(valueSeparator)).join(lineSeparator);

            function sanitize(filename) {
                return filename.replace(/[|&;$%@"<>()+,]/g, '');
            }

            const parts = [surname, name].map(s => s.trim()).filter(s => s.length > 0);

            downloadContent(csv, sanitize(`Export recherche '${parts.join(' ')}' (arbre.app - INSEE).csv`), 'text/csv');
        })
        .fail(function () {
            console.log("Impossible d'effectuer la requête");
        });

    e.preventDefault();
});

// Anchor

function getHashValue() {
    return window.location.hash.substr(1);
}

// https://stackoverflow.com/a/21903119/4413709
function getHashParameters() {
    const pageUrl = getHashValue(), urlVariables = pageUrl.split('&');
    const result = {};

    for (let i = 0; i < urlVariables.length; i++) {
        const parameterName = urlVariables[i].split('=');
        const key = parameterName[0];
        const value = parameterName[1] === undefined ? true : decodeURIComponent(parameterName[1]);
        
        result[key] = value;
    }

    return result;
}

const P_SURNAME = 's', P_NAME = 'n', P_PLACE = 'p', P_EVENT = 'e', P_AFTER = 'a', P_BEFORE = 'b', P_ORDER = 'o', P_PAGE = 'k', P_LIMIT = 'l';
const V_BIRTH = 'b', V_DEATH = 'd', V_ASCEND = 'a', V_DESCEND = 'd';

function getPermalink() {
    const hash = '#', equal = '=', and = '&';

    const parameters = [];

    function add(k, v) {
        parameters.push(k + equal + encodeURIComponent(v));
    }

    add(P_SURNAME, surname);
    if(name.length > 0) {
        add(P_NAME, name);
    }
    const placeText = placeSelect.find('option:selected').text();
    if(
        placeText.length > 0) {
        add(P_PLACE, placeText);
    }
    if(after.length > 0 || before.length > 0 || event !== 'birth' || order !== 'ascending') {
        add(P_EVENT, event === 'birth' ? V_BIRTH : V_DEATH);
        if(after.length > 0) {
            add(P_AFTER, after);
        }
        if(before.length > 0) {
            add(P_BEFORE, before);
        }
        add(P_ORDER, order === 'ascending' ? V_ASCEND : V_DESCEND);
    }
    if(currentPage > 0 || resultsPerPage !== 25) {
        add(P_PAGE, currentPage);
        add(P_LIMIT, resultsPerPage);
    }

    return HOST_FRONT + hash + parameters.join(and);
}

function loadPermalink() {
    const parameters = getHashParameters();

    history.pushState("", document.title, window.location.pathname + window.location.search); // Remove hash from URL

    function get(k) {
        return k in parameters ? String(parameters[k]) : '';
    }

    function isNormalInteger(str) {
        const n = Math.floor(Number(str));
        return n !== Infinity && String(n) === str && n >= 0;
    }

    const surname = get(P_SURNAME), name = get(P_NAME), placePrefix = get(P_PLACE), event = get(P_EVENT), after = get(P_AFTER), before = get(P_BEFORE), order = get(P_ORDER), page = get(P_PAGE), limit = get(P_LIMIT);

    if(surname.trim().length > 0) {
        const hasPlace = placePrefix.trim().length > 0;

        $('#surname').val(surname);
        $('#name').val(name);

        if(hasPlace) {
            setFormDisabled(true);

            getPlaces(1, placePrefix)
                .done(function(data) {
                    placeSelect.empty();
                    if(data.results.length > 0) {
                        const r = data.results[0];
                        const option = $('<option>', {
                            value: r.id,
                            text: r.fullname
                        });
                        placeSelect.append(option);
                    }
                })
                .always(function () {
                    setFormDisabled(false);
                    placeSelect.selectpicker('refresh');
                    $('button[type="submit"]').trigger('click');
                });
        }

        if(event === V_BIRTH || event === V_DEATH) {
            const eventKey = event === V_BIRTH ? 'birth' : 'death';
            $(`select#event > option[value="${eventKey}"]`).prop('selected', true);
        }
        if(isNormalInteger(after)) {
            $('#after').val(after);
        }
        if(isNormalInteger(before)) {
            $('#before').val(before);
        }
        if(order === V_ASCEND || order === V_DESCEND) {
            const orderKey = order === V_ASCEND ? 'ascending' : 'descending';
            $(`select#order > option[value="${orderKey}"]`).prop('selected', true);
        }
        if(isNormalInteger(page) && isNormalInteger(limit)) {
            const perPage = parseInt(limit);
            const res = $(`select#limit > option[value="${perPage}"]`);
            if(res.length > 0) {
                resultsPerPage = perPage;
                currentPage = parseInt(page);
                preservePage = true; // Hacky
                res.prop('selected', true);
                limitSelect.selectpicker('refresh'); // Needed
            }
        }

        if(!hasPlace) { // Weird but works
            $('button[type="submit"]').trigger('click');
        }
    }
}

loadPermalink();

$(function() { // Popovers
    const popover = $("[data-toggle=popover]");
    popover.popover({
        html: true,
        sanitize: false,
        content: function() {
            const content = $('#popover-content').clone();
            content.removeClass('hidden');
            content.find('input.link').val(getPermalink());

            return content;
        }
    });

    popover.on('shown.bs.popover', function () {
        $('input.link').on('click', function() {
            $(this).select();
        });

        /*$('.copy').on('click', function() {
            $('input.link').select(0);
            document.execCommand("copy");
        });*/
    });
});

$(document).mouseup(function (e) {
    const container = $(".popover");

    if (!container.is(e.target)  && container.has(e.target).length === 0)  {
        container.popover("hide");
    }
});
