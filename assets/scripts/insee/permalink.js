import {HOST_FRONT} from "./api";
import * as form from "./form";
import * as content from "./content";

const P_TAB = 't', P_SURNAME = 's', P_NAME = 'n', P_PLACE = 'p', P_EVENT = 'e', P_AFTER = 'a', P_BEFORE = 'b', P_EXACT = 'y', P_ORDER = 'o', P_PAGE = 'k', P_LIMIT = 'l';
const V_TAB_RESULTS = 'r', V_TAB_STATS = 's', V_BIRTH = 'b', V_DEATH = 'd', V_ASCEND = 'a', V_DESCEND = 'd';

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

export function getPermalink() {
    const hash = '#', equal = '=', and = '&';

    const parameters = [];

    function add(k, v) {
        parameters.push(k + equal + encodeURIComponent(v));
    }

    if(content.isStatsSelected()) {
        add(P_TAB, V_TAB_STATS);
    }
    add(P_SURNAME, form.surname);
    if(form.name.length > 0) {
        add(P_NAME, form.name);
    }
    if(form.placeName.length > 0) {
        add(P_PLACE, form.placeName);
    }
    if(form.after.length > 0 || form.before.length > 0 || form.event !== 'birth' || form.order !== 'ascending') {
        add(P_EVENT, form.event === 'birth' ? V_BIRTH : V_DEATH);
        if(form.dateKind === 'range') {
            if(form.after.length > 0) {
                add(P_AFTER, form.after);
            }
            if(form.before.length > 0) {
                add(P_BEFORE, form.before);
            }
        } else {
            if(form.after.length > 0) {
                add(P_EXACT, form.after);
            }
        }
        add(P_ORDER, form.order === 'ascending' ? V_ASCEND : V_DESCEND);
    }
    if(form.currentPage > 0 || form.resultsPerPage !== 25) {
        add(P_PAGE, form.currentPage);
        add(P_LIMIT, form.resultsPerPage);
    }

    return HOST_FRONT + hash + parameters.join(and);
}

function loadPermalink() {
    const parameters = getHashParameters();

    history.pushState('', document.title, window.location.pathname + window.location.search); // Remove hash from URL

    function get(k) {
        return k in parameters ? String(parameters[k]) : '';
    }

    const tab = get(P_TAB), surname = get(P_SURNAME), name = get(P_NAME), placePrefix = get(P_PLACE), event = get(P_EVENT), after = get(P_AFTER), before = get(P_BEFORE), exact = get(P_EXACT), order = get(P_ORDER), page = get(P_PAGE), limit = get(P_LIMIT);

    if(tab === V_TAB_STATS) {
        $('#statistics-content, a#statistics-tab').tab('show');
    }

    let eventName = null;
    if(event === V_BIRTH || event === V_DEATH) {
        eventName = event === V_BIRTH ? 'birth' : 'death';
    }

    let orderName = null;
    if(order === V_ASCEND || order === V_DESCEND) {
        orderName = order === V_ASCEND ? 'ascending' : 'descending';
    }

    form.prefillSafe(surname, name, placePrefix, eventName, after, before, exact, orderName, page, limit);
}

$(document).ready(function() {
    loadPermalink(); // Important to call it after readiness
});
