import * as api from './api';
import {updateResults} from './ui';
import * as content from './content';
import * as warnings from './warnings';
import * as results from './tabs/results';

const searchButton = $('#search');
const resetButton = $('#reset');

const surnameInput = $('#surname'), nameInput = $('#name'), dateAfterInput = $('#after'), dateBeforeInput = $('#before'), dateExactInput = $('#exact');
const placeSelect = $('#place');
const eventSelect = $('#event'), orderSelect = $('#order'), dateKindSelect = $('#date-kind');

export let surname = '', name = '', place = 0, event = '', after = '', before = '', dateKind = '', order = '';
export let placeName = '';

export let currentPage = 0, resultsPerPage = 25; // Controlled by other components
let preservePage = false;

surnameInput.focus();

function setupPlaceSelect() {
    placeSelect.selectpicker({
        noneSelectedText : __('insee.none_selected_text'),
        noneResultsText: __('insee.no_place_found'),
        liveSearchPlaceholder: __('insee.place_kind')
    });

    $('.bs-searchbox > input').attr('autocomplete', 'random'); // Disable autocomplete

    placeSelect.on('shown.bs.select', function () {
        placeSelect.empty();
        placeSelect.selectpicker('refresh');
    });

    // TODO: on clear

    let previousValue = null;
    let placeRequestIndex = 1, placeRequestLastReceived = 0;
    placeSelect.siblings().find("input[type='search']").keyup(function (e) {
        const search = $(this).val();

        const isPrintableKey = e.key.length === 1;
        const hasTextChanged = previousValue !== search;
        if(isPrintableKey || hasTextChanged) {
            const requestIndex = placeRequestIndex;
            placeRequestIndex++;

            previousValue = search;

            if(search.trim().length > 0) {

                api.getPlaces(10, search)
                    .done(function(data) {
                        if(requestIndex > placeRequestLastReceived) {
                            placeSelect.empty();
                            data.results.forEach(r => {
                                const option = $('<option>', {
                                    value: r.id,
                                    text: r.fullname
                                });
                                placeSelect.append(option);
                            });
                            placeSelect.selectpicker('refresh');

                            placeRequestLastReceived = requestIndex;
                        }
                    });
            } else {
                placeSelect.empty();
                placeSelect.selectpicker('refresh');

                placeRequestLastReceived = requestIndex;
            }
        }
    });
}
setupPlaceSelect();

resetButton.click(function(e) {
    e.preventDefault();
    resetState();
});

searchButton.click(function(e) {
    surname = surnameInput.val();
    name = nameInput.val();
    place = placeSelect.val();
    placeName = placeSelect.find('option:selected').text(); // Required for permalink
    event = eventSelect.val();
    dateKind = dateKindSelect.val();
    if(dateKind === 'range') {
        after = dateAfterInput.val();
        before = dateBeforeInput.val();
    } else {
        after = dateExactInput.val();
        before = after;
    }
    order = orderSelect.val();

    surnameInput.removeClass('is-invalid');
    if(surname.trim().length > 0) {
        if(!preservePage) {
            currentPage = 0;
        } else {
            preservePage = false;
        }

        updateResults();
    } else {
        surnameInput.addClass('is-invalid');
    }

    e.preventDefault();
});

dateKindSelect.on('change', function() {
    updateDateKind(this.value);
});


function updateDateKind(value) {
    const toShow = [], toHide = [];
    if(value === 'range') {
        toShow.push(dateAfterInput);
        toShow.push(dateBeforeInput);
        toHide.push(dateExactInput);
    } else {
        toShow.push(dateExactInput);
        toHide.push(dateAfterInput);
        toHide.push(dateBeforeInput);
    }
    toShow.forEach(e => {
        e.val('');
        e.removeClass('hidden');
    });
    toHide.forEach(e => {
        e.addClass('hidden');
    })
}


export function setDisabled(disabled) {
    $("form input, form button, form select").prop("disabled", disabled);
}

export function resetState() {
    surnameInput.val('');
    nameInput.val('');
    placeSelect.empty();
    placeSelect.selectpicker('refresh');
    eventSelect.val('birth');
    $(`select#date-kind > option[value="range"]`).prop('selected', true);
    updateDateKind('range');
    dateAfterInput.val('');
    dateBeforeInput.val('');
    orderSelect.val('ascending');

    setResetable(false);

    content.resetState();

    warnings.clear();
}

export function prefillSafe(surname, name, placePrefix, event, after, before, exact, order, page, limit) {
    function isNormalInteger(str) {
        const n = Math.floor(Number(str));
        return n !== Infinity && String(n) === str && n >= 0;
    }

    if(surname.trim().length > 0) {
        const hasPlace = placePrefix.trim().length > 0;

        surnameInput.val(surname);
        nameInput.val(name);

        if(hasPlace) {
            setDisabled(true);

            api.getPlaces(1, placePrefix)
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
                    setDisabled(false);
                    placeSelect.selectpicker('refresh');
                    searchButton.trigger('click');
                });
        }

        if(event) {
            $(`select#event > option[value="${event}"]`).prop('selected', true);
        }
        const dateKindKey = exact.length > 0 && after.length === 0 && before.length === 0 ? 'exact' : 'range';
        $(`select#date-kind > option[value="${dateKindKey}"]`).prop('selected', true);
        updateDateKind(dateKindKey);
        if(isNormalInteger(exact)) {
            dateExactInput.val(exact);
        }
        if(isNormalInteger(after)) {
            dateAfterInput.val(after);
        }
        if(isNormalInteger(before)) {
            dateBeforeInput.val(before);
        }
        if(order) {
            $(`select#order > option[value="${order}"]`).prop('selected', true);
        }
        if(isNormalInteger(page) && isNormalInteger(limit)) {
            const perPage = parseInt(limit);
            const res = $(`select#limit > option[value="${perPage}"]`);
            if(res.length > 0) {
                resultsPerPage = perPage;
                currentPage = parseInt(page);
                preservePage = true; // Hacky
                res.prop('selected', true);
                results.limitSelect.selectpicker('refresh'); // Needed
            }
        }

        if(!hasPlace) { // Weird but works
            searchButton.trigger('click');
        }
    }
}

export function setCurrentPage(p) {
    currentPage = p;
}

export function setResultsPerPage(p) {
    resultsPerPage = p;
}

export function setResetable(resetable) {
    resetButton.toggleClass('hidden', !resetable);
}