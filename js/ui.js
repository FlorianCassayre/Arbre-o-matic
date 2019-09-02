// Logo
function drawLogo() {
    const svg = d3.select('svg#logo');
    const size = parseFloat(svg.style('width'));
    const logoDepth = 4;
    const rStep = size / (logoDepth * 2);
    const offset = logoDepth * rStep;
    const g = svg.append('g').attr('transform', 'translate(' + size / 2 + ', ' + offset + ')');
    for (let i = 0; i < logoDepth; i++) {
        const first = i === 0;
        const total = 1 << i;
        for (let j = 0; j < total; j++) {
            const angle = Math.PI * j / total - Math.PI / 2;
            g.append('path')
                .attr('d', d3.arc()
                    .startAngle(first ? 0 : angle)
                    .endAngle(first ? 2 * Math.PI : angle + Math.PI / total)
                    .innerRadius(i * rStep)
                    .outerRadius((i + 1) * rStep)
                )
                .attr('fill', 'white')
                .attr('stroke', 'black')
                .attr('stroke-width', '1px');
        }
    }
}

drawLogo();

// Select picker
const individualSelect = $('#individual-select');
individualSelect.selectpicker({
    noneSelectedText : 'Aucun individu sélectionné'
});


let map = null;
let json = null;

let previousColoring = null;

let previousDimensions = null;

function onFileChange(data) {
    json = toJson(data);

    $('.parameter, #individual-select, #download-menu').attr('disabled', false);
    $('.colorpicker-group').each(function () {
        $(this).data('colorpicker').enable()
    });
    $('#print').removeClass('disabled');

    let isFirst = true;

    individualSelect.empty();
    const individuals = json.filter(byTag(TAG_INDIVIDUAL));
    individuals.map(i => buildIndividual(i, {dates: {showInvalidDates: false, showYearsOnly: true}, places: {showPlaces: false}}))
        .map(function (o) {
            const object = {
                value: o.id,
                text: o.surname + (o.surname ? ' ' : '') + o.name +
                (o.birth.date && (o.birth.date.display || o.death.date && o.death.date.display) ?
                    ' (' + (o.birth.date && o.birth.date.display ? o.birth.date.display : '?') + (o.death.date && o.death.date.display ? '-' + o.death.date.display : '') + ')' : '')
            };
            if(isFirst) {
                object['selected'] = 'selected';
                isFirst = false;
            }
            return object;
        })
        .sort(function(a, b) {
            const rule = o => !o.text ? 'zzz' : o.text;
            const x = rule(a), y = rule(b);
            if(x < y) {
            return -1;
        } else if (x > y) {
            return 1;
        } else {
            return 0;
        }
    }).forEach(o => {
        const option = $('<option>', o);
        individualSelect.append(option);
    });
    individualSelect.selectpicker('refresh');

    $('#preview-group').css('display', '');

    onSettingChange();

    map = panzoom(document.querySelector('#map'));

    resetZoom();

}

function resetZoom() {
    if(map != null) {
        const previewContainer = $('#preview'), svg = $('#fan');
        const previewRatio = previewContainer.height() / previewContainer.width(), svgRatio = svg.height() / svg.width();
        let ratio;
        if (previewRatio > svgRatio) { // SVG is horizontally larger
            ratio = previewContainer.width() / svg.width();
        } else { // SVG is vertically larger
            ratio = previewContainer.height() / svg.height();
        }

        const centerX = (previewContainer.width() - svg.width() * ratio) / 2,
            centerY = (previewContainer.height() - svg.height() * ratio) / 2;

        map.zoomAbs(0, 0, ratio);
        map.moveTo(centerX, centerY);
    }
}

const COLORING_NONE = 'none', COLORING_DUAL = 'dual', COLORING_GRADIENT = 'gradient', COLORING_TEXTUAL = 'textual';

const coloringSchemes = {
    none: {type: COLORING_NONE},
    sex: {type: COLORING_DUAL, f: (d => d.sex), color1: '#e0f4ff', color2: '#ffe0eb'},
    generation: {type: COLORING_GRADIENT, f: (d => d.generation), colorStart: '#FBC79F', colorEnd: '#CEFFCE'},
    agedeath: {type: COLORING_GRADIENT, f: (d => {
        if(!d.birth || !d.birth.date || !d.birth.date.year)
            return null;
        if(!d.death || !d.death.date || !d.death.date.year)
                return null;
        return d.death.date.year - d.birth.date.year;
        }), colorStart: '#F9B4B4', colorEnd: '#BAFCFF'},
    agemarriage: {type: COLORING_GRADIENT, f: (d => {
            if(!d.birth || !d.birth.date || !d.birth.date.year)
                return null;
            const parent = d.parent();
            if(parent === null || !parent.marriage || !parent.marriage.date || !parent.marriage.date.year)
                return null;
            return parent.marriage.date.year - d.birth.date.year;
        }), colorStart: '#8EF389', colorEnd: '#D5B4F9'},
    birthdate: {type: COLORING_GRADIENT, f: (d => d.birth && d.birth.date && d.birth.date.year ? d.birth.date.year : null), colorStart: '#565756', colorEnd: '#BAFCFF'},
    birthtown: {type: COLORING_TEXTUAL, f: (d => d.birth && d.birth.place && d.birth.place.town ? d.birth.place.town : null)},
    birthdepartement: {type: COLORING_TEXTUAL, f: (d => d.birth && d.birth.place && d.birth.place.departement ? d.birth.place.departement : null)},
    patronym: {type: COLORING_TEXTUAL, f: (d => d.surname)},
    signature: {type: COLORING_DUAL, f: (d => d.canSign), color1: '#83FBBC', color2: '#C8C8C8'},
    occupation: {type: COLORING_TEXTUAL, f: (d => d.occupation)},
    childrencount: {type: COLORING_GRADIENT, f: (d => d.childrenCount), colorStart: '#BAFCFF', colorEnd: '#F9B4B4'},
};

function colorValue(id) {
    return $(id).parent().data('colorpicker').getValue();
}

function onSettingChange() {
    const selectedDates = parseInt($('#select-dates').val());
    const selectedPlaces = parseInt($('#select-places').val());
    const selectedContemporary = parseInt($('#select-hidden-generations').val());

    const coloring = $('#select-color-scheme').val();
    const coloringScheme = coloringSchemes[coloring];
    if(previousColoring !== coloring) {
        onColoringChange(coloringScheme); // Reset default colors, display menu according to scheme
    }
    previousColoring = coloring;
    const dimensions = parseInt($('#size-pixels').val());

    const config = {
        root: individualSelect.val(), // Root individual
        maxGenerations: parseInt($('#max-generations').val()),
        angle: 2 * Math.PI * parseInt($('#fan-angle').val()) / 360.0,
        dates: {
            showYearsOnly: selectedDates === 0,
            showInvalidDates: $('#show-invalid-dates').prop('checked')
        },
        places: {
            showPlaces: selectedPlaces !== 2,
            showReducedPlaces: selectedPlaces === 1
        },
        showMarriages: $('#show-marriages').prop('checked'),
        showMissing: $('#show-missing').prop('checked'),
        invertTextArc: $('#invert-text-arc').prop('checked'),
        isTimeVisualisationEnabled: $('#show-chronology').prop('checked'),
        weights: {
            generations: [$('#weightg1'), $('#weightg2'), $('#weightg3')].map(e => parseInt(e.val()) / 100.0)
        },
        contemporary: {
            showEvents: selectedContemporary === 0,
            showNames: selectedContemporary < 2,
            trulyAll: selectedContemporary === 3,
            generations: parseInt($('#hidden-generations-count').val())
        },
        colors: {
            individuals: colorValue('#color-individuals'),
            marriages: colorValue('#color-marriages'),
            textContrast: $('#text-contrast').prop('checked'),
            scheme: coloringScheme,

            color1: colorValue('#color1'),
            color2: colorValue('#color2'),
            colorStart: colorValue('#color-start'),
            colorEnd: colorValue('#color-end'),

            saturation: parseInt($('#saturation').val()) / 100.0,
            value: parseInt($('#value').val()) / 100.0,
            randomSelection: $('#random-selection').prop('checked')
        },
        dimensions: dimensions,

        computeChildrenCount: coloring === 'childrencount',
    };

    drawFan(json, config);

    if(dimensions !== previousDimensions) {
        previousDimensions = dimensions;
        resetZoom();
    }
}

function onColoringChange(scheme) {
    $('.group-color').css('display', 'none'); // Hide all
    // Show only one
    if(scheme === null)
        return;
    if(scheme.type === COLORING_DUAL) {
        $('#group-color-dual').css('display', '');

        $('#color1').parent().data('colorpicker').setValue(scheme.color1);
        $('#color2').parent().data('colorpicker').setValue(scheme.color2);
    } else if(scheme.type === COLORING_GRADIENT) {
        $('#group-color-gradient').css('display', '');

        $('#color-start').parent().data('colorpicker').setValue(scheme.colorStart);
        $('#color-end').parent().data('colorpicker').setValue(scheme.colorEnd);
    } else if(scheme.type === COLORING_TEXTUAL) {
        $('#group-color-textual').css('display', '');
    }
}

$("#file").change(function (e) {
    const file = e.target.files[0];
    const reader = new FileReader();

    reader.addEventListener("loadend", function () {
        const data = reader.result;

        onFileChange(data);
    });

    reader.readAsArrayBuffer(file);
});

individualSelect.on('change', function () {
    onSettingChange();
});

function zoom(scale) {
    if (map != null) {
        const previewContainer = $('#preview');
        const transform = map.getTransform();
        const deltaX = transform.x, deltaY = transform.y;
        const offsetX = 1 / scale * previewContainer.width() / 2 + deltaX, offsetY = 1 / scale * previewContainer.height() / 2 + deltaY;

        map.zoomTo(previewContainer.width() / 2, previewContainer.height() / 2, scale);
    }
}

const zoomFactor = 0.2;

$("#zoom-plus").click(function () {
        zoom(1 + zoomFactor);
        return false;
    }
);

$("#zoom-minus").click(function () {
        zoom(1 - zoomFactor);
        return false;
    }
);

$("#zoom-reset").click(function () {
        resetZoom();
        return false;
    }
);

const zoomButtons = $(".button-zoom");

zoomButtons.mousedown(function () {
    return false;
});

zoomButtons.dblclick(function () {
    return false;
});

// --

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

function fanAsXml() {
    const svg = $("#fan")[0];
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }
    source = source.replace(/href/g, 'xlink:href'); // Compatibility

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    return source;
}

function generatePdf(callback) {
    const doc = new PDFDocument({
        size: [595.28, 841.89],
        margins : {
            top: 28,
            bottom: 28,
            left: 28,
            right: 28
        },
        layout: 'landscape', // Either 'portrait' or 'landscape'
        info: {
            Title: 'Eventail généalogique', // Title of the document
            Author: 'Arbre-o-matic', // Name of the author
            Subject: 'Eventail généalogique', // Subject of the document
            Keywords: 'généalogie;arbre;éventail', // Keywords
            //CreationDate: 'DD/MM/YYYY', // Date created (added automatically by PDFKit)
            //ModDate: 'DD/MM/YYYY' // Date last modified
        }
    });

    const stream = doc.pipe(blobStream());
    stream.on('finish', function() {
        const blob = stream.toBlob('application/pdf');
        callback(blob);
    });

    SVGtoPDF(doc, fanAsXml().trim(), 0, 0, {preserveAspectRatio: 'xMidYMid meet'});

    doc.end();
}

$("#download-pdf").click(function () {
    generatePdf(function (blob) {
        downloadContent(blob, "Généalogie.pdf", "pdf");
    });

    return false; // Prevent default link action
});

$("#download-svg").click(function () {
    downloadContent(fanAsXml(), "Généalogie.svg", "svg");
    return false;
});

$("#download-png-transparency").click(function () {
    downloadPNG(true);
    return false;
});

$("#download-png-background").click(function () {
    downloadPNG(false);
    return false;
});

function downloadPNG(transparency) {
    const svgString = fanAsXml();
    const canvas = document.createElement("canvas");
    const fan = $("#fan");

    canvas.width = parseInt(fan.width());
    canvas.height = parseInt(fan.height());
    const ctx = canvas.getContext("2d");

    if(!transparency) { // No transparency
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const DOMURL = self.URL || self.webkitURL || self;
    const img = new Image();
    const svg = new Blob([svgString], {type: "image/svg+xml;charset=utf-8"});
    const url = DOMURL.createObjectURL(svg);

    img.onload = function() {
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = "Généalogie.png";
            document.body.appendChild(a);
            a.click();
        });
    };
    img.src = url;
}

$("#print").click(function () {
    function printPdf(url) {
        const iframe = document.createElement('iframe');
        iframe.className = 'pdfIframe';
        document.body.appendChild(iframe);
        iframe.style.position = 'absolute';
        iframe.style.left = '-10000px';
        iframe.style.top = '-10000px';
        iframe.onload = function () {
            setTimeout(function () {
                iframe.focus();
                try {
                    iframe.contentWindow.print();
                } catch (e) { // Fallback
                    console.log('Cannot print, downloading instead');
                    $("#download-pdf").click();
                }
                URL.revokeObjectURL(url);
            }, 1);
        };
        iframe.src = url;
    }

    generatePdf(function(blob) {
        printPdf(URL.createObjectURL(blob), {type: 'application/pdf'});
    });

    return false;
});

function loadExternal(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function(e) {
        if (this.status === 200) {
            const data = xhr.response;
            onFileChange(data);
        } else {
            window.alert("Impossible de charger le fichier"); // FIXME
        }
    };
    xhr.send();
}

$('#sample-toggle').click(function () {
    $('#sample-modal').modal('show');
    //loadExternal('shakespeare.ged');
    return false;
});

$('.sample').click(function (e) {
    loadExternal('https://cors-anywhere.herokuapp.com/' + $(e.target).attr('data-link'));
    $('#sample-modal').modal('hide');
    return false;
});

$('#help').click(function (e) {
    $('#help-modal').modal('show');
    return false;
});

$('#news-button').click(function (e) {
    $('#news-modal').modal('show');
    return false;
});

// Prevent the user from entering invalid quantities
$('input[type=number]').change(function () {
    const _this = $(this);
    const min = parseInt(_this.attr('min'));
    const max = parseInt(_this.attr('max'));
    const val = parseInt(_this.val()) || (min - 1);
    if(val < min)
        _this.val( min );
    if(val > max)
        _this.val( max );
});

$('.gradient-group').on('colorpickerChange colorpickerCreate', function (e) {
    const preview = $('#gradient-preview');
    preview.css('background', 'linear-gradient(to right, ' + colorValue('#color-start') +', ' + colorValue('#color-end') + ')');
});

$(function () {
    $('[data-toggle="tooltip"]').tooltip(); // Bootstrap tooltips
    $('.colorpicker-group')
        .colorpicker({ // Color picker plugin
            format: 'hex',
            useAlpha: false,
            placement: 'top',
            fallbackColor: '#ffffff'
        })
        .on('colorpickerHide', function () {
            if(json !== null) {
                onSettingChange();
            }
        })
        .each(function () {
            $(this).data('colorpicker').disable()
        });


    // Triggers on any parameter modification
    $(".parameter").change(onSettingChange);
    $('.colorpicker-group input').blur(onSettingChange);
});

$(document).ready(function() {
    // ARE YOU READY?
    if(isReady) {
        $('#overlay').addClass('overlay-hidden');//.css('display', 'none');
        $('body').css('overflow', 'auto'); // Enable scrolling
    }
});

// TODO remove (debug)
//loadExternal('test.ged');
