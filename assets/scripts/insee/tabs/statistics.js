import * as form from '../form';
import {pluralize} from "../utils";

const d3 = require('d3');

const map = $('#map');

$('document').ready(function() {
    $('[data-toggle=tooltip]').tooltip(); // Tooltips

    $('#map').load('/france.svg', function() {
        const div = d3.select($(this)[0]);
        const svg = div.select('svg');
        svg.style('overflow', 'visible');

        svg.selectAll('.departement')
            .attr('stroke', 'black')
            .attr('stroke-weight', 1)
            .attr('fill', 'white');

        const departements = $('.departement');
        departements.attr('title', '');
        departements.tooltip({
            'container': 'body',
            'placement': 'top'
        });
    });
});

export function setDisabled(disabled) {
    $('#statistics-content').toggleClass('brighter', disabled);
}

export function displayStatistics(data) {
    map.find('.departement').attr('fill', 'white');
    const departements = $('.departement');
    departements.each(function() {
        $(this).data('count', 0);
    });
    const counts = data.results.map(p => p.count);
    const total = counts.reduce((a, b) => a + b, 0);
    const max = counts.reduce((a, b) => Math.max(a, b), 0)
    data.results.forEach(pair => {
        const ratio = pair.count / max;
        const id = pair.name.substring(2);
        const e = map.find('.departement-' + id);
        const color = d3.interpolateYlOrRd(ratio);
        e.attr('fill', color).data('count', pair.count);
    });
    departements.each(function() {
        const e = $(this);
        const countRaw = parseInt(e.data('count'));
        const id = e.data('numerodepartement'), name = e.data('nom'), count = countRaw.toLocaleString('FR-fr');
        const title = `${name} (${id})\n${count} ${pluralize(countRaw, __('insee.result'), __('insee.results'))}`;
        e.attr('title', title).attr('data-original-title', title);
    })
    $('#count-events').text(total.toLocaleString('FR-fr') + ' ' + pluralize(total, __('insee.place_found'), __('insee.places_found')));
    $('#surname-name').text((form.surname.trim() + ' ' + form.name.trim()).trim());

    $('#statistics-content').removeClass('brighter');

    departements.tooltip('update');

    setDisabled(false);
}

function _experimental() {
    const div = d3.select('#time');
    div.selectAll("svg").remove();
    const width = 500;
    const height = 100;
    const svg = div.append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'red')
        .attr('stroke', 'red')
        .attr('stroke-weight', 0.2);
    data2.results.forEach(d => d.name = Math.floor(d.name));
    const years = data2.results.map(d => d.name), yearsAgg = data2.results.map(d => d.count);
    const minYear = years.reduce((a, b) => Math.min(a, b), Number.MAX_VALUE), maxYear = years.reduce((a, b) => Math.max(a, b), 0);
    const maxCount = yearsAgg.reduce((a, b) => Math.max(a, b), 0);

    const totalYears = maxYear - minYear + 1;
    const theoreticalTotalYears = 2020 - 1850 + 1;
    const barWidth = width / theoreticalTotalYears;
    const midX = width / 2 - totalYears * barWidth / 2;
    console.log([width / 2, totalYears, totalYears * barWidth / 2, midX]);
    data2.results.forEach(d => {
        const localHeight = d.count * height / maxCount;
        svg.append('rect')
            .attr('x', midX + (d.name - minYear) * barWidth)
            .attr('y', height - localHeight)
            .attr('width', barWidth)
            .attr('height', height)
        ;
    });
}