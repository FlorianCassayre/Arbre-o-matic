const EMPTY = "";
const TAG_HEAD = "HEAD", TAG_ENCODING = "CHAR", TAG_FORMAT = "FORM", TAG_INDIVIDUAL = "INDI", TAG_FAMILY = "FAM", TAG_CHILD = "CHIL", TAG_HUSBAND = "HUSB", TAG_WIFE = "WIFE",
    TAG_NAME = "NAME", TAG_GIVEN_NAME = "GIVN", TAG_SURNAME = "SURN", TAG_BIRTH = "BIRT", TAG_DEATH = "DEAT", TAG_SEX = "SEX",
    TAG_DATE = "DATE", TAG_PLACE = "PLAC", TAG_MARRIAGE = "MARR", TAG_SIGNATURE = "SIGN";
const TAG_YES = "YES", TAG_ANSI = "ANSI";
const TAG_ABOUT = 'ABT', TAG_BEFORE = 'BEF', TAG_AFTER = 'AFT';
const TAG_GREGORIAN = '@#DGREGORIAN@', TAG_REPUBLICAN = '@#DFRENCH R@';
const TAGS_MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TAGS_MONTH_REPUBLICAN = ['VEND', 'BRUM', 'FRIM', 'NIVO', 'PLUV', 'VENT', 'GERM', 'FLOR', 'PRAI', 'MESS', 'THER', 'FRUC', 'COMP'];

const republicanConversion = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];

function toJson(data) {
    const decoder = new TextDecoder("utf-8");
    const text = decoder.decode(data);
    const parsed = parseGedcom.parse(text);

    const isAnsi = getFirst(parsed.filter(byTag(TAG_HEAD)).flatMap(a => a.tree.filter(byTag(TAG_ENCODING)).map(a => a.data)), null) === TAG_ANSI;

    if(isAnsi) { // Conversion and reparsing needed
        console.log("ANSI detected, converting");
        const extendedAsciiTable = "€?‚ƒ„…†‡ˆ‰Š‹Œ?Ž??‘’“”•–—˜™š›œ?žŸ?¡¢£¤¥¦§¨©ª«¬?®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"; // Let's hope this doesn't cause issues with IDEs
        const builder = [];
        const mask = 0x80;

        const view = new Uint8Array(data);
        for(let i = 0; i < view.length; i++) {
            const charCode = view[i];
            builder.push((charCode & mask) === 0 ? String.fromCharCode(charCode) : extendedAsciiTable.charAt(charCode ^ mask));
        }
        const text2 = builder.join('');

        return parseGedcom.parse(text2);
    } else {
        return parsed;
    }
}

function byTag(tag) {
    return obj => obj.tag === tag;
}

function byData(data) {
    return obj => obj.data === data;
}

function byChild(child) {
    return fam => fam.tree.filter(byTag(TAG_CHILD)).filter(byData(child.pointer)).length > 0;
}

function getFirst(array, def) {
    if (array.length > 0)
        return array[0];
    else
        return def;
}

function buildIndividual(json, config) {
    if(json === null) {
        const dummyEvent = {};
        return {id: null, name: '', surname: '', birth: dummyEvent, death: dummyEvent};
    }

    const names = json.tree.filter(byTag(TAG_NAME));
    let name = getFirst(names.flatMap(a => a.tree.filter(byTag(TAG_GIVEN_NAME)).map(o => o.data)), EMPTY).replace(/_/, ' '),
        surname = getFirst(names.flatMap(a => a.tree.filter(byTag(TAG_SURNAME)).map(o => o.data)), EMPTY).replace(/_/, ' ');
    const sex = getFirst(json.tree.filter(byTag(TAG_SEX)).map(s => s.data === 'M'), null);
    const canSign = getFirst(json.tree.filter(byTag(TAG_SIGNATURE)).map(s => s.data === TAG_YES), null);

    if(!name || !surname) { // Use NAME instead (compatibility with old software)
        names.map(o => {
            const split = o.data.split('/').map(s => s.trim().replace(/_/, ' '));
            if(!name)
                name = split[0];
            if(split.length > 1 && !surname)
                surname = split[1];
        })
    }

    const birthData = buildEvent(getFirst(json.tree.filter(byTag(TAG_BIRTH)), null), config),
        deathData = buildEvent(getFirst(json.tree.filter(byTag(TAG_DEATH)), null), config);

    return {id: json.pointer, name: name, surname: surname, birth: birthData, death: deathData, sex: sex, canSign: canSign};
}

function buildEvent(event, config) {
    if(event == null) {
        return {};
    }

    const date = getFirst(event.tree.filter(byTag(TAG_DATE)).map(o => o.data).map(s => {
        let trimed = s.trim();
        let isRepublican = false;
        if(trimed.startsWith(TAG_GREGORIAN)) {
            trimed = trimed.substring(TAG_GREGORIAN.length)
        } else if(trimed.startsWith(TAG_REPUBLICAN)) {
            trimed = trimed.substring(TAG_REPUBLICAN.length);
            isRepublican = true;
        }
        let split = trimed.trim().split(/\s+/);
        const objDef = {display: config.dates.showInvalidDates ? s : EMPTY};
        if(split.length === 0)
            return objDef;
        let prefix = '';
        const replacement = {[TAG_ABOUT]: '~', [TAG_BEFORE]: '<', [TAG_AFTER]: '>'};
        let isYearLegit = true;
        if(replacement[split[0]]) {
            if(split.length === 1)
                return objDef;
            isYearLegit = split[0] === TAG_ABOUT;
            prefix += replacement[split[0]];
            split = split.slice(1, split.length);
        }

        if(split.length > 3)
            return objDef;
        const year = parseInt(split[split.length - 1], 10);
        const yearDisplay = isRepublican ? republicanConversion[year - 1] : year + '';
        if(split[split.length - 1] !== year + '')
            return objDef;
        let obj = {};
        if(isYearLegit) {
            const republicanCalendarStart = 1792;
            obj.year = isRepublican ? year + republicanCalendarStart : year;
        }
        if(split.length === 1) {
            obj.display = prefix + yearDisplay;
            return obj;
        }
        const month = (isRepublican ? TAGS_MONTH_REPUBLICAN : TAGS_MONTH).indexOf(split[split.length - 2]) + 1;
        if(month === 0)
            return objDef;
        let day = 0;
        if(split.length !== 2) {
            day = split[0];
            const date = new Date(year, month - 1, day);
            const isValidDate = (Boolean(+date) && date.getDate() == day) || isRepublican; // Assume correct if republican, for now
            if(!isValidDate)
                return objDef;
        }
        if(config.dates.showYearsOnly) {
            obj.display = prefix + yearDisplay;
            return obj;
        } else {
            function padTwoDigits(n) {
                const s = n.toString();
                return s.length === 1 ? '0' + s : s;
            }
            const sep = '/';
            if(day === 0)
                obj.display = padTwoDigits(month) + sep + yearDisplay;
            else
                obj.display = padTwoDigits(day) + sep + padTwoDigits(month) + sep + yearDisplay;
            return obj;
        }
    }), EMPTY);
    const place = getFirst(event.tree.filter(byTag(TAG_PLACE)).map(o => {
        const original = o.data;
        const obj = {};
        let reduced;
        const split = original.split(/\s*,\s*/);
        if((config.places.hasSpecialFormat || (split.length === 5 || split.length === 6) && (!split[1] || parseInt(split[1]) + '' === split[1]))
            && Math.max(...[config.places.townIndex, config.places.departementIndex, config.places.countryIndex]) < split.length) {
            if(config.places.subdivisionIndex < split.length) // Special case
                obj.subdivision = split[config.places.subdivisionIndex];
            obj.town = split[config.places.townIndex];
            obj.departement = split[config.places.departementIndex];
            obj.country = split[config.places.countryIndex];
            reduced = (obj.subdivision ? obj.subdivision + ', ' : '') + obj.town;
        } else {
            if(split.length < 3) {
                reduced = original;
            } else {
                if(split.length > 3) {
                    obj.subdivision = split.slice(0, split.length - 3).map(s => s.trim()).join(', ');
                }
                obj.town = split[split.length - 3];
                obj.departement = split[split.length - 2];
                obj.country = split[split.length - 1];
                reduced = (obj.subdivision ? obj.subdivision + ', ' : '') + obj.town;
            }
        }

        if(config.places.showPlaces) {
            if(config.places.showReducedPlaces) {
                obj.display = reduced;
            } else {
                obj.display = original;
            }
        } else {
            obj.display = '';
        }

        return obj;
    }), EMPTY);

    return {date: date, place: place};
}

function buildHierarchy(json, config) {

    const individuals = json.filter(byTag(TAG_INDIVIDUAL)), families = json.filter(byTag(TAG_FAMILY));

    const placeFormatArray = json.filter(byTag(TAG_HEAD)).flatMap(o => o.tree).filter(byTag(TAG_PLACE)).flatMap(o => o.tree).filter(byTag(TAG_FORMAT));
    let hasSpecialPlaceFormat = placeFormatArray.length > 0;

    // Defaults
    config.places.subdivisionIndex = 5;
    config.places.townIndex = 0;
    config.places.departementIndex = 2;
    config.places.countryIndex = 4;

    if(hasSpecialPlaceFormat) {
        const format = placeFormatArray[0].data.trim().split(/\s*,\s*/);
        const subdivision = "Subdivision", town = "Town", departement = "County", country = "Country";
        const placeSubdivisionPos = format.indexOf(subdivision), placeTownPos = format.indexOf(town), placeDepartementPos = format.indexOf(departement), placeCountryPos = format.indexOf(country);
        if(placeSubdivisionPos === -1 || placeTownPos === -1 || placeDepartementPos === -1 || placeCountryPos === -1) // what?
            hasSpecialPlaceFormat = false;
        else {
            config.places.subdivisionIndex = placeSubdivisionPos;
            config.places.townIndex = placeTownPos;
            config.places.departementIndex = placeDepartementPos;
            config.places.countryIndex = placeCountryPos;
        }
    }

    config.places.hasSpecialFormat = hasSpecialPlaceFormat;

    if (individuals.length === 0)
        return null;

    const rootIndividual = individuals.filter(i => i.pointer === config.root)[0];

    const maxHeight = config.maxGenerations - 1;

    function buildRecursive(individual, sosa, height) {

        let obj = buildIndividual(individual, config);
        obj.sosa = sosa;
        obj.generation = height;

        if (height < maxHeight) {
            const familyA = individual != null ? families.filter(byChild(individual)) : [];

            if(familyA.length === 0 && config.showMissing) {
                obj.children = [buildRecursive(null, sosa * 2, height + 1), buildRecursive(null, sosa * 2 + 1, height + 1)];
                obj.marriage = {};
            } else if(familyA.length > 0) {
                const family = familyA[0];

                function getParent(tag) {
                    const parent = family.tree.filter(byTag(tag)).flatMap(id => individuals.filter(ind => ind.pointer === id.data));
                    return !config.showMissing || parent.length > 0 ? parent : [null];
                }

                const husbandA = getParent(TAG_HUSBAND), wifeA = getParent(TAG_WIFE);

                const parents = (husbandA.map(h => buildRecursive(h, sosa * 2, height + 1)))
                    .concat(wifeA.map(w => buildRecursive(w, sosa * 2 + 1, height + 1)));

                if (parents.length > 0) {
                    obj.children = parents;

                    obj.marriage = buildEvent(getFirst(family.tree.filter(byTag(TAG_MARRIAGE)), null), config);
                }
            }
        }
        return obj;
    }

    return buildRecursive(rootIndividual, 1, 0);
}

function drawFan(json, config) {

    const data = buildHierarchy(json, config);
    if(data === null) {
        window.alert("Impossible d'interpréter ce fichier");
        return;
    }

    const radius = 400;


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
        .attr('font-family', 'Arial, serif');

    const scale = radius / totalWeight;
    const marginScale = 0.95;

    const center = svg.append('g')
        .attr('transform', 'translate(' + (width / 2) * (1 - marginScale) + ',' + (height / 2) * (1 - marginScale) + ') scale(' + marginScale + ', ' + marginScale + ')');

    const g = center.append('g')
        .attr('transform', 'translate(' + (width / 2) + ', ' + radius + ')' + ' scale(' + scale + ', ' + scale + ')');
    // FIXME scale margin != absolute margin

    const defs = g.append('defs');

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
            if(result !== null) {
                if(!set.has(result))
                    dataToColor.push(result);
                set.add(result);
            }
            if(tree.children) {
                tree.children.forEach(c => forEach(c))
            }
        }
        forEach(data);
        Math.seedrandom(42);

        // https://stackoverflow.com/a/6274381/4413709
        function shuffle(a) {
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
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
                if(d === null)
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
                if(d === null)
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
            if(result !== null)
                return hexToRgb(result ? config.colors.color1 : config.colors.color2);
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
            return '✝' + (d.data.death.date.display ? d.data.death.date.display : '') + (config.places.showPlaces && d.data.death.place && d.data.death.place.display ? ' ' + d.data.death.place.display : '');
    }

    function textRange(d) {
        let s = '';
        if(d.data.birth.date && d.data.birth.date.display)
            s += d.data.birth.date.display;
        if(d.data.death.date && d.data.death.date.display)
            s += ' - ' + d.data.death.date.display;
        return s;
    }

    // First individual
    generateTexts(isFirstLayer, [
        {text: d => d.data.name, size: weightFontFirst, bold: true},
        {text: d => d.data.surname, size: weightFontFirst, bold: true},
        {text: textBirth, size: weightFontFirst},
        {text: textDeath, size: weightFontFirst}
    ], "middle", false);

    // Secondary individuals
    generateTexts(isSecondLayer, [
        {text: d => d.data.name, size: weightFontOther, bold: true},
        {text: d => d.data.surname, size: weightFontOther, bold: true},
        {text: textBirth, size: weightFontOther},
        {text: textDeath, size: weightFontOther}
    ], "middle", false);

    // Third individuals
    generateTexts(isThirdLayer, [
        {text: d => d.data.name, size: weightFontOther, bold: true},
        {text: d => d.data.surname, size: weightFontOther, bold: true},
        {text: textBirth, size: weightFontOther},
        {text: textDeath, size: weightFontOther}
    ], "middle", false);

    // Fourth individuals
    generateTexts(isFourthLayer, [
        {text: d => d.data.name, size: weightFontOther, bold: true},
        {text: d => d.data.surname, size: weightFontOther, bold: true},
        {text: textRange, size: weightFontOther},
    ], "middle", false);

    // Fourth individuals
    generateTexts(isFifthLayer, [
        {text: d => d.data.name + ' ' + d.data.surname, size: weightFontOther, bold: true},
        {text: textRange, size: weightFontOther},
    ], "middle", false);

    // Fourth individuals
    generateTexts(isSixthLayer, [
        {text: d => d.data.name + ' ' + d.data.surname, size: weightFontOther, bold: true},
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

            if(overflows()) {
                // Pseudo invariant: solution lies between lower and upper
                let lower = step, upper = size, mid;
                // Binary search
                while(upper - lower > step) {
                    mid = (lower + upper) / 2;
                    textPath.css('font-size', mid);
                    if(overflows()) {
                        upper = mid;
                    } else {
                        lower = mid;
                    }
                }
                textPath.css('font-size', lower);
            }

        }
    );

}

