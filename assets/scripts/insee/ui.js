import * as api from './api';
import * as page from './page';
import * as form from './form';
import * as results from './tabs/results';
import * as statistics from './tabs/statistics';
import * as content from './content';
import * as warnings from './warnings';
import * as permalink from './permalink';

let searchRequestIndex = 0;

export function updateResults() {
    searchRequestIndex++;
    const requestIndex = searchRequestIndex;
    function matchesRequest() {
        return requestIndex === searchRequestIndex;
    }

    const offset = form.currentPage * form.resultsPerPage, limit = form.resultsPerPage;

    form.setDisabled(true);
    results.setDisabled(true);

    api.getPersons(offset, limit, form.surname, form.name, form.place, form.event, form.after, form.before, form.order)
        .done(function(data) {
            if(matchesRequest()) {
                results.displayResults(data, offset, limit);
            }
        })
        .always(function () {
            if(matchesRequest()) {
                form.setDisabled(false);
            }
        });

    statistics.setDisabled(true);

    api.getStatsGeography(form.surname, form.name)
        .done(function(data) {
            if(matchesRequest()) {
                statistics.displayStatistics(data);
            }
        })
        .always(function () {
            if(matchesRequest()) {
                // TODO
            }
        });

    page.scrollToTop();
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
            message = __('insee.default_server_message');
        }

        content.text(message);

        modal.modal('show');
    }
}
api.registerFailureFallback(failureFallback);


$(function() { // Popovers
    const popover = $("[data-toggle=popover]");
    popover.popover({
        html: true,
        sanitize: false,
        content: function() {
            const content = $('#popover-content').clone();
            content.removeClass('hidden');
            content.find('input.link').val(permalink.getPermalink());

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
