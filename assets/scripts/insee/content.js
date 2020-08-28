import './tabs/results';
import './tabs/statistics';

const contentContainer = $('#content-container');

export function show() {
    contentContainer.removeClass('hidden');
}

export function resetState() {
    contentContainer.addClass('hidden');

    $('#results-content, a#results-tab').tab('show');
}

export function isStatsSelected() {
    return $('#statistics-tab').hasClass('active');
}