export const HOST_API = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : 'https://insee.arbre.app';
export const HOST_FRONT = (location.protocol + '//' + location.host + location.pathname).replace(/\/$/, '');

const fallbacks = [];

export let errorFlag = false;

export function getPersons(offset, limit, surname, name, place, event, after, before, order) {
    errorFlag = false;
    return $.get(HOST_API + '/persons', {
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

export function getPlaces(limit, prefix) {
    errorFlag = false;
    return $.get(HOST_API + '/places', {
        limit: limit,
        prefix: prefix
    }).fail(failureFallback);
}

export function getStatsGeography(surname, name) {
    errorFlag = false;
    return $.get(HOST_API + '/stats/geography', {
        surname: surname,
        name: name
    }).fail(failureFallback);
}

export function getStatsTime(surname, name, place, event) {
    errorFlag = false;
    return $.get(HOST_API + '/stats/time', {
        surname: surname,
        name: name,
        place: place,
        event: event
    }).fail(failureFallback);
}

function failureFallback(xhr, status, error) {
    fallbacks.forEach(f => f(xhr, status, error));
}

export function registerFailureFallback(f) {
    fallbacks.push(f);
}