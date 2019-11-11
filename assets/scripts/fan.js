const d3 = require('d3');
const seedrandom = require('seedrandom');

const Parse = require('./parse');
const Utils = require('./utils');


function drawFan(json, config) {

    const data = Parse.buildHierarchy(json, config);
    if(data == null) {
        window.alert("Impossible d'interpréter ce fichier");
        return null;
    }

    const radius = Math.round(config.dimensions / 2);


    function max(a, b) {
        return a > b ? a : b;
    }

    function computeDepth(data) {
        if (data.hasOwnProperty("children"))
            return 1 + data.children.map(computeDepth).reduce(max, 0);
        else
            return 1;
    }

    const depth = computeDepth(data);

    const showMarriages = config.showMarriages;

    const weightRadiusFirst = config.weights.generations[0], weightRadiusClose = config.weights.generations[1], weightRadiusFar = config.weights.generations[2], weightRadiusMarriage = showMarriages ? 0.2 : 0;
    const weightFontFirst = 0.25, weightFontOther = 0.2, weightFontMarriage = 0.15;
    const thirdLevel = 4, fourthLevel = 5, fifthLevel = 6, sixthLevel = 7;
    const weightTextMargin = 0.1;

    function between(a, b) {
        return d => d.depth >= a && d.depth < b;
    }

    const isFirstLayer = between(0, 1), isSecondLayer = between(1, thirdLevel),
        isThirdLayer = between(thirdLevel, fourthLevel), isFourthLayer = between(fourthLevel, fifthLevel), isFifthLayer = between(fifthLevel, sixthLevel), isSixthLayer = d => d.depth >= sixthLevel;
    const isMarriageFirst = d => between(0, fourthLevel)(d) && d.children, isMarriageSecond = d => d.depth >= fourthLevel && d.children;

    function applyNormalWeights(tree) {
        function computeRecursive(tree, generation) {
            let i;
            if(generation < 1) { // (1)
                i = 0;
            } else if(generation < thirdLevel) { // (2)
                i = 1;
            } else { // (3)
                i = 2;
            }
            tree.weight = config.weights.generations[i];
            if(tree.children) {
                tree.children.map(parent => computeRecursive(parent, generation + 1));
            }
        }
        computeRecursive(tree, 0);
    }

    function applyTimeWeights(tree) {
        const defaultAgeForBirth = 22, defaultAgeDead = 80, maxAgeAlive = 110; // TODO actually use these (for the first ind.)
        const minimumAgeForBirth = 14, maximumAgeForBirth = 60;
        let minimums = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
        function computeRecursive(tree, year, generation) {
            let timeDifference = defaultAgeForBirth;
            const isYearDefined = tree.birth && tree.birth.date && tree.birth.date.year;
            if(isYearDefined) {
                timeDifference = year - tree.birth.date.year;
            }
            if(timeDifference < minimumAgeForBirth || timeDifference > maximumAgeForBirth) {
                timeDifference = defaultAgeForBirth;
            }
            if(generation === 0) { // For now
                timeDifference = defaultAgeForBirth;
            }

            tree.weight = timeDifference;
            let i;
            if(generation < 1) { // (1)
                i = 0;
            } else if(generation < thirdLevel) { // (2)
                i = 1;
            } else { // (3)
                i = 2;
            }
            minimums[i] = Math.min(timeDifference, minimums[i]);

            if(tree.children) {
                tree.children.map(parent => computeRecursive(parent, isYearDefined ? tree.birth.date.year : year - timeDifference, generation + 1));
            }
        }
        const baseYear = new Date().getFullYear();
        computeRecursive(tree, baseYear, 0);

        let maxScale = 0;
        for(let i = 0; i < minimums.length; i++) {
            const scale = (config.weights.generations[i] + (i > 0 ? weightRadiusMarriage : 0)) / minimums[i];
            maxScale = Math.max(scale, maxScale);
        }

        function normalizeRecursive(tree, generation) {
            if(generation === 0) {
                tree.weight *= maxScale;
            } else {
                tree.weight = tree.weight * maxScale - weightRadiusMarriage;
            }
            if(tree.children) {
                tree.children.map(parent => normalizeRecursive(parent, generation + 1));
            }
        }

        normalizeRecursive(tree, 0);
    }

    if(config.isTimeVisualisationEnabled)
        applyTimeWeights(data);
    else
        applyNormalWeights(data);

    function computeTotalWeight(tree, generation) {
        let currentWeight = tree.weight;
        if(generation > 0) {
            currentWeight += weightRadiusMarriage;
        }
        return currentWeight + (tree.children ? Math.max(...tree.children.map(parent => computeTotalWeight(parent, generation + 1))) : 0);
    }

    const totalWeight = computeTotalWeight(data, 0); // Math.min(depth, 1) * weightRadiusFirst + Math.max(Math.min(depth, thirdLevel) - 1, 0) * weightRadiusClose + Math.max(depth - thirdLevel, 0) * weightRadiusFar + (depth - 1) * weightRadiusMarriage;


    const fixOrientations = true;

    // https://stackoverflow.com/a/5624139/4413709
    function hexToRgb(hex) {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : null;
    }

    const individualsDefaultColorRgb = hexToRgb(config.colors.individuals), marriagesColorHex = config.colors.marriages;

    // Calculate polar coordinates
    let rootNode = d3.hierarchy(data)
        .each(function (d) {
            const space = 2 * Math.PI - config.angle;
            //let depth = d.depth + d.height + 1;
            if (d.parent == null) {
                d.x0 = Math.PI - space / 2;
                d.x1 = -Math.PI + space / 2;
                d.y0 = 0;
                d.y1 = d.data.weight;
            } else {
                let p = d.parent;
                let add = (p.x1 - p.x0) / 2;
                d.x0 = p.x0 + (d.data.sosa % 2 === 0 ? add : 0);
                d.x1 = d.x0 + add;
                d.y0 = p.y1 + weightRadiusMarriage;
                d.y1 = d.y0 + d.data.weight;
            }
        });

    const id = 'svg#fan';
    $(id).empty(); // Clear current contents, if any

    const width = 2 * radius, height = radius + Math.max(radius * Math.cos(Math.PI - config.angle / 2), radius * weightRadiusFirst / totalWeight);

    const svg = d3.select('svg#fan')
        .attr('width', width)
        .attr('height', height)
        //.style('overflow', 'visible')
        .attr('font-family', 'Helvetica, Arial, serif');

    const scale = radius / totalWeight;
    const marginScale = 0.95;

    const defs = svg.append('defs');

    const center = svg.append('g')
        .attr('transform', 'translate(' + (width / 2) * (1 - marginScale) + ',' + (height / 2) * (1 - marginScale) + ') scale(' + marginScale + ', ' + marginScale + ')');

    const g = center.append('g')
        .attr('transform', 'translate(' + (width / 2) + ', ' + radius + ')' + ' scale(' + scale + ', ' + scale + ')');
    // FIXME scale margin != absolute margin

    // --
    function hslToRgb(h, s, l){
        var r, g, b;

        if(s == 0){
            r = g = b = l; // achromatic
        } else {
            var hue2rgb = function hue2rgb(p, q, t){
                if(t < 0) t += 1;
                if(t > 1) t -= 1;
                if(t < 1/6) return p + (q - p) * 6 * t;
                if(t < 1/2) return q;
                if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };

            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    const colorScheme = config.colors.scheme;
    let dataToColor, coloringFunction;
    let indexMap;
    if(colorScheme.type === 'gradient' || colorScheme.type === 'textual') {
        const set = new Set();
        dataToColor = [];
        function forEach(tree) {
            const result = colorScheme.f(tree);

            if(result != null) {
                if(!set.has(result))
                    dataToColor.push(result);
                set.add(result);
            }
            if(tree.children) {
                tree.children.forEach(c => forEach(c))
            }
        }
        forEach(data);
        const random = seedrandom(42);

        // https://stackoverflow.com/a/6274381/4413709
        function shuffle(a) {
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        }

        if(config.colors.randomSelection) {
            shuffle(dataToColor);
        }

        if(colorScheme.type === 'gradient') {
            const min = Math.min(...dataToColor), max = Math.max(...dataToColor);
            const c1 = hexToRgb(config.colors.colorStart), c2 = hexToRgb(config.colors.colorEnd);
            function interpolate(v, a, b) {
                return b !== a ? (v - a) / (b - a) : (a + b) / 2.0;
            }
            coloringFunction = function (d) {
                if(d == null || d.length === 0)
                    return individualsDefaultColorRgb;
                const array = [];
                for(let i = 0; i < 3; i++) {
                    array.push(Math.round(interpolate(d, min, max) * (c2[i] - c1[i]) + c1[i]));
                }
                return array;
            };
        } else {
            indexMap = {};
            for(let i = 0; i < dataToColor.length; i++) {
                indexMap[dataToColor[i]] = i;
            }
            coloringFunction = function (d) {
                if(d == null || d.length === 0)
                    return individualsDefaultColorRgb;
                const hue = indexMap[d] / dataToColor.length;
                return hslToRgb(hue, config.colors.saturation, config.colors.value);
            }
        }
    }

    function backgroundColor(d) {
        if(colorScheme.type === 'none') {
            return individualsDefaultColorRgb;
        } else if(colorScheme.type === 'dual') {
            const result = colorScheme.f(d.data);
            if(result != null) {
                return hexToRgb(result ? config.colors.color1 : config.colors.color2);}
            else
                return individualsDefaultColorRgb;
        } else if(colorScheme.type === 'gradient') {
            return coloringFunction(colorScheme.f(d.data));
        } else {
            return coloringFunction(colorScheme.f(d.data));
        }
    }

    /** Boxes **/

    const individualBoxGenerator = d3.arc()
        .startAngle(d => !isFirstLayer(d) ? d.x0 : 0)
        .endAngle(d => !isFirstLayer(d) ? d.x1 : 2 * Math.PI)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

    const marriageBoxGenerator = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y1)
        .outerRadius(d => d.y1 + weightRadiusMarriage);

    function generateBoxes(node, filter, boxGenerator) {
        return node.selectAll('path')
            .data(rootNode.descendants())
            .enter()
            .filter(filter)
            .append('path')
            /*.classed('box', true)
            .classed(cssClass, true)*/
            .attr('d', boxGenerator)
            .attr('stroke', 'black')
            .attr('stroke-width', '0.02px');
    }

    // Individual boxes
    generateBoxes(g.append('g').attr('id', 'individual-boxes'), _ => true, individualBoxGenerator) // .attr('fill', d => 'hsl(' + Math.random() * 360 + ', 76%, 80%)')
        .attr('fill', function (d) {
            const rgb = backgroundColor(d);
            return 'rgb(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ')';
        });
    //.attr('fill', 'white');

    // Marriage boxes
    if(showMarriages)
        generateBoxes(g.append('g').attr('id', 'marriage-boxes'), d => d.children, marriageBoxGenerator)
            .attr('fill', marriagesColorHex);

    /** Text paths **/

    function pathId(sosa, line) {
        return "s" + sosa + "l" + line;
    }

    function simpleLine(x0, y0, x1, y1) {
        const generator = d3.line();
        return generator([[x0, y0], [x1, y1]]);
    }

    function meanAngle(arr) {
        function sum(a, b) {
            return a + b;
        }
        return Math.atan2(
            arr.map(Math.sin).reduce(sum) / arr.length,
            arr.map(Math.cos).reduce(sum) / arr.length
        );
    }

    function fixArc(arcGenerator) {
        return d => arcGenerator(d).split('A').slice(0, 2).join("A"); // Small hack to create a pure arc path (not filled)
    }

    // First node
    const weightFirstLineSpacing = weightFontFirst;
    const linesFirst = 4;
    const halfHeightFirst = (linesFirst - 1) * weightFirstLineSpacing / 2;
    for (let i = 0; i < linesFirst; i++) {
        const y = i * weightFirstLineSpacing - halfHeightFirst, yabs = Math.abs(y) + weightFirstLineSpacing / 2,
            x = Math.sqrt(Math.max(weightRadiusFirst * weightRadiusFirst - yabs * yabs, 0));
        defs.append('path')
            .attr('id', pathId(1, i))
            .attr('d', simpleLine(-2 * x, y, 2 * x, y));
    }

    // Secondary nodes
    const weightSecondLineSpacing = weightFontOther;
    const linesSecond = 4;
    const halfHeightSecond = (linesSecond - 1) * weightSecondLineSpacing / 2;
    for (let i = 0; i < linesSecond; i++) {
        const invert = config.invertTextArc ? d => {
            const angle = meanAngle([d.x0, d.x1]);
            return angle < -Math.PI / 2 || angle > Math.PI / 2
        } : _ => false;
        const y = d => (invert(d) ? i : (linesSecond - 1 - i)) * weightSecondLineSpacing - halfHeightSecond;
        const radiusF = d => (d.y0 + d.y1) / 2 + y(d);
        const marginAngleF = d => weightTextMargin / radiusF(d) * (d.depth === 1 ? 1.5 : 1); // FIXME
        const minA = d => Math.min(d.x0, d.x1), maxA = d => Math.max(d.x0, d.x1), rangeA = d => Math.abs(d.x0 - d.x1) - 2 * marginAngleF(d);
        const start = d => minA(d) + -0.5 * rangeA(d) + marginAngleF(d), end = d => maxA(d) + 0.5 * rangeA(d) - marginAngleF(d);
        const arcGenerator = fixArc(d3.arc()
            .startAngle(d => invert(d) ? end(d) : start(d))
            .endAngle(d => invert(d) ? start(d) : end(d))
            .innerRadius(radiusF)
            .outerRadius(radiusF));
        rootNode.descendants().filter(isSecondLayer).forEach(d => {
            defs.append('path')
                .attr('id', pathId(d.data.sosa, i))
                .attr('d', arcGenerator(d))
        });
    }

    function generateThirdLevelTextPaths(lines, spacing, filter) {
        for (let i = 0; i < lines; i++) {
            rootNode.descendants().filter(filter).forEach(d => {
                const angleSplitting = 1.0 / (1 << d.depth);
                const weightThirdLineSpacing = angleSplitting * spacing;
                const halfHeightThird = (lines - 1) * weightThirdLineSpacing / 2;
                const angleMid = (((meanAngle([d.x0, d.x1]) - Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
                const inverted = fixOrientations && angleMid >= Math.PI / 2 && angleMid < 3 * Math.PI / 2;
                const trueI = inverted ? lines - 1 - i : i;
                const angle = trueI * weightThirdLineSpacing - halfHeightThird;
                const x = Math.cos(angle + angleMid), y = Math.sin(angle + angleMid);
                const halfRange = (d.y1 - d.y0) / 2 - weightTextMargin;
                const y0 = inverted ? (d.y1 - weightTextMargin + halfRange) : (d.y0 + weightTextMargin - halfRange),
                    y1 = inverted ? (d.y0 + weightTextMargin - halfRange) : (d.y1 - weightTextMargin + halfRange);
                defs.append('path')
                    .attr('id', pathId(d.data.sosa, i))
                    .attr('d', simpleLine(x * y0, y * y0, x * y1, y * y1))
            });
        }
    }

    // Third nodes
    generateThirdLevelTextPaths(4, Math.PI / 5, isThirdLayer);

    // Fourth nodes
    generateThirdLevelTextPaths(3, Math.PI / 3.5, isFourthLayer);

    // Fifth nodes
    generateThirdLevelTextPaths(2, Math.PI / 2.5, isFifthLayer);

    // Sixth nodes
    generateThirdLevelTextPaths(1, 0, isSixthLayer);

    // Marriage nodes
    if(showMarriages)
        rootNode.descendants().filter(d => d.children).forEach(d => {
            const r = d.y1 + weightRadiusMarriage / 2;
            const marginAngle = weightTextMargin / r;
            const min = Math.min(d.x0, d.x1), max = Math.max(d.x0, d.x1), range = Math.abs(d.x0 - d.x1) - 2 * marginAngle;
            const marriageArcGenerator = fixArc(d3.arc()
                .startAngle(range <= Math.PI ? min - 0.5 * range + marginAngle : -Math.PI + 1E-3)
                .endAngle(range <= Math.PI ? max + 0.5 * range - marginAngle : Math.PI - 1E-3)
                .innerRadius(r)
                .outerRadius(r));
            defs.append('path')
                .attr('id', pathId(d.data.sosa, 'm'))
                .attr('d', marriageArcGenerator(d));
        });

    /*
    DEBUG: red line
    .attr('class', 'debug')
     */


    /** Texts **/

    const texts = g.append('g')
        .attr('id', 'texts');

    function generateTexts(filter, lines, alignment, special) {
        const anchor = texts.selectAll('path')
            .data(rootNode.descendants())
            .enter()
            .filter(filter);
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            anchor.append('text')
                .attr('dominant-baseline', 'middle')
                .attr('alignment-baseline', 'middle')
                .append('textPath')
                .attr('font-size', l.size + "px")
                .attr('font-weight', l.hasOwnProperty('bold') && l.bold ? "bold" : "")
                .attr('fill', function (d) {
                    const rgb = backgroundColor(d);
                    // https://stackoverflow.com/questions/3942878/how-to-decide-font-color-in-white-or-black-depending-on-background-color
                    if((rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) > 186 || special || !config.colors.textContrast) {
                        return 'black';
                    } else {
                        return 'white';
                    }
                })
                .attr('text-anchor', alignment)
                .attr('startOffset', '50%')
                .attr('href', d => '#' + pathId(d.data.sosa, special ? 'm' : i))
                .text(function(d) {
                    function display() {
                        if(config.contemporary.generations <= (d.depth + (special ? 1 : 0))) // Out of scope
                            return true;
                        if(l.bold) { // Name
                            return config.contemporary.showNames || (d.depth === 0 && !config.contemporary.trulyAll);
                        } else { // Event
                            return config.contemporary.showEvents;
                        }
                    }
                    return display() ? l.text(d) : '';
                });
        }
    }

    function textBirth(d) {
        if((!d.data.birth.date || !d.data.birth.date.display) && (!d.data.birth.place || !d.data.birth.place.display))
            return '';
        else
            return '°' + (d.data.birth.date.display ? d.data.birth.date.display : '') + (config.places.showPlaces && d.data.birth.place && d.data.birth.place.display ? ' ' + d.data.birth.place.display : '');
    }

    function textDeath(d) {
        if((!d.data.death.date || !d.data.death.date.display) && (!d.data.death.place || !d.data.death.place.display))
            return '';
        else
            return '+' + (d.data.death.date.display ? d.data.death.date.display : '') + (config.places.showPlaces && d.data.death.place && d.data.death.place.display ? ' ' + d.data.death.place.display : '');
    }

    function textRange(d) {
        let s = '';
        if(d.data.birth.date && d.data.birth.date.display)
            s += d.data.birth.date.display;
        if(d.data.death.date && d.data.death.date.display)
            s += ' - ' + d.data.death.date.display;
        return s;
    }

    function givenName(d) {
        const full = d.data.name;
        if(config.showFirstNameOnly) {
            return full.split(/\s+/)[0];
        } else {
            return full;
        }
    }

    function nameFirst(d) {
        return config.givenThenFamilyName ? givenName(d) : d.data.surname;
    }

    function nameSecond(d) {
        return config.givenThenFamilyName ? d.data.surname : givenName(d);
    }

    // First individual
    generateTexts(isFirstLayer, [
        {text: nameFirst, size: weightFontFirst, bold: true},
        {text: nameSecond, size: weightFontFirst, bold: true},
        {text: textBirth, size: weightFontFirst},
        {text: textDeath, size: weightFontFirst}
    ], "middle", false);

    // Secondary individuals
    generateTexts(isSecondLayer, [
        {text: nameFirst, size: weightFontOther, bold: true},
        {text: nameSecond, size: weightFontOther, bold: true},
        {text: textBirth, size: weightFontOther},
        {text: textDeath, size: weightFontOther}
    ], "middle", false);

    // Third individuals
    generateTexts(isThirdLayer, [
        {text: nameFirst, size: weightFontOther, bold: true},
        {text: nameSecond, size: weightFontOther, bold: true},
        {text: textBirth, size: weightFontOther},
        {text: textDeath, size: weightFontOther}
    ], "middle", false);

    // Fourth individuals
    generateTexts(isFourthLayer, [
        {text: nameFirst, size: weightFontOther, bold: true},
        {text: nameSecond, size: weightFontOther, bold: true},
        {text: textRange, size: weightFontOther},
    ], "middle", false);

    // Fourth individuals
    generateTexts(isFifthLayer, [
        {text: d => nameFirst(d) + ' ' + nameSecond(d), size: weightFontOther, bold: true},
        {text: textRange, size: weightFontOther},
    ], "middle", false);

    // Fourth individuals
    generateTexts(isSixthLayer, [
        {text: d => nameFirst(d) + ' ' + nameSecond(d), size: weightFontOther, bold: true},
    ], "middle", false);

    if(showMarriages) {

        // Marriage texts first
        generateTexts(isMarriageFirst, [
            {text: d => !jQuery.isEmptyObject(d.data.marriage) && d.data.marriage.date && d.data.marriage.date.display ? d.data.marriage.date.display + (config.places.showPlaces && d.data.marriage.place && d.data.marriage.place.display ? ' ' + d.data.marriage.place.display : '') : '', size: weightFontMarriage},
        ], "middle", true);

        // Marriage texts second
        generateTexts(isMarriageSecond, [
            {text: d => !jQuery.isEmptyObject(d.data.marriage) && d.data.marriage.date && d.data.marriage.date.display ? d.data.marriage.date.display : '', size: weightFontMarriage},
        ], "middle", true);
    }


    // Fix overflow
    $('textPath').each((_, textPathElem) => {

        const textPath = $(textPathElem);
        const textElem = textPath.parent()[0];
        const pathElem = $(textPath.attr('href'))[0];
        let size = parseFloat(textPath.css('font-size'));
        const step = 0.01 * size;
        const totalLength = pathElem.getTotalLength() / 2;

        function overflows() {
            return textElem.getComputedTextLength() > totalLength;
        }

        if (overflows()) {
            // Pseudo invariant: solution lies between lower and upper
            let lower = step, upper = size, mid;
            // Binary search
            while (upper - lower > step) {
                mid = (lower + upper) / 2;
                textPath.css('font-size', mid);
                if (overflows()) {
                    upper = mid;
                } else {
                    lower = mid;
                }
            }
            textPath.css('font-size', lower);
        }

    });

    return data;
}

module.exports = {
    draw: drawFan
};