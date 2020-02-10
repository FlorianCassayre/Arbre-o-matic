import './scripts/vendor/jquery'
import './scripts/vendor/bootstrap'
import 'bootstrap-select'

import './scss/insee.scss'


import { library, dom } from '@fortawesome/fontawesome-svg-core'

import { faBook, faSearch, faMars, faVenus } from '@fortawesome/free-solid-svg-icons'
library.add(faBook, faSearch, faMars, faVenus);

import { faGithub } from '@fortawesome/free-brands-svg-icons'
library.add(faGithub);

dom.i2svg();

dom.watch(); // Important because we are dynamically adding icons

// ---

const host = "https://insee.arbre.app/";

let currentPage = 0, resultsPerPage = 25;

const placeSelect = $('#place');
placeSelect.selectpicker({
    noneSelectedText : 'Lieu',
    noneResultsText: 'Aucun lieu trouvé',
    liveSearchPlaceholder: 'Commune, département, région ou pays'
});

placeSelect.on('change', function () {
    // TODO
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
            })
            .fail(function () {
                alert("Impossible d'effectuer la requête")
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

    $('#page-info').text(`Page ${currentPage + 1} sur ${totalPages}`);

    const tableDiv = $('#table-container');
    tableDiv.removeClass('hidden');

    $('tbody').remove(); // Remove current content

    const table = $('#persons');

    table.removeClass('brighter');

    data.results.forEach(row => {
        const tbody = $('<tbody></tbody>');
        const trFirst = $('<tr></tr>'), trSecond = trFirst.clone();
        function fa(icon) {
            return `<i class="fas fa-${icon} fa-lg"></i>`
        }
        function date(str) {
            if(str != null && str.length > 0) {
                const split = str.split('-');
                return split.reverse().join('/')
            } else {
                return str;
            }
        }
        const fieldsShared = [fa(row.gender ? 'mars' : 'venus'), row.nom.toUpperCase(), row.prenom];
        const fieldsFirst = ['Naissance' , date(row.birthDate), row.birthPlace];
        const fieldsSecond = ['Décès', date(row.deathDate), row.deathPlace];
        let first = true;
        fieldsShared.forEach(f => {
            trFirst.append($(`<td rowspan="2" class="${first ? 'text-center' : ''}"></td>`).html(f)); // XSS! (nah, should be safe...)
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

function updateResults() {
    const offset = currentPage * resultsPerPage, limit = resultsPerPage;

    const surname = $('#surname').val(), name = $('#name').val();
    const place = placeSelect.val();

    const pagination = $('ul.pagination');
    pagination.addClass('disabled');

    setFormDisabled(true);
    getPersons(offset, limit, surname, name, place)
        .done(function(data) {
            displayResults(data, offset, limit);
        })
        .fail(function () {
            alert("Impossible d'effectuer la requête")
        })
        .always(function () {
            pagination.removeClass('disabled');
            setFormDisabled(false);
        });

    $('#persons').addClass('brighter');

    scrollToTop();
}

$('#search').click(function(e) {

    const surname = $('#surname');
    surname.removeClass('is-invalid');
    if(surname.val().trim().length > 0) {
        currentPage = 0;

        updateResults();
    } else {
        surname.addClass('is-invalid');

    }

    e.preventDefault();
});

function getPersons(offset, limit, surname, name, place) {
    return $.get(host + "persons", {
        offset: offset,
        limit: limit,
        surname: surname,
        name: name,
        place: place
    });
}

function getPlaces(limit, prefix) {
    return $.get(host + "places", {
        limit: limit,
        prefix: prefix
    });
}

function setFormDisabled(disabled) {
    $("form input, form button").prop("disabled", disabled);
}

$('document').ready(function(){
    $('[data-toggle=tooltip]').tooltip(); // Tooltips
});