const parseGedcom = require('parse-gedcom');

const Utils = require('./utils');

const EMPTY = "";
const TAG_HEAD = "HEAD", TAG_ENCODING = "CHAR", TAG_FORMAT = "FORM", TAG_INDIVIDUAL = "INDI", TAG_FAMILY = "FAM", TAG_CHILD = "CHIL", TAG_HUSBAND = "HUSB", TAG_WIFE = "WIFE",
    TAG_NAME = "NAME", TAG_GIVEN_NAME = "GIVN", TAG_SURNAME = "SURN", TAG_BIRTH = "BIRT", TAG_DEATH = "DEAT", TAG_SEX = "SEX",
    TAG_DATE = "DATE", TAG_PLACE = "PLAC", TAG_MARRIAGE = "MARR", TAG_SIGNATURE = "SIGN", TAG_EVENT = "EVEN", TAG_TYPE = "TYPE", TAG_NOTE = "NOTE", TAG_OCCUPATION = "OCCU";
const TAG_YES = "YES", TAG_ANSI = "ANSI";
const TAG_ABOUT = 'ABT', TAG_BEFORE = 'BEF', TAG_AFTER = 'AFT';
const TAG_GREGORIAN = '@#DGREGORIAN@', TAG_REPUBLICAN = '@#DFRENCH R@';
const TAGS_MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TAGS_MONTH_REPUBLICAN = ['VEND', 'BRUM', 'FRIM', 'NIVO', 'PLUV', 'VENT', 'GERM', 'FLOR', 'PRAI', 'MESS', 'THER', 'FRUC', 'COMP'];

const VALUE_OCCUPATION = "Occupation";

const republicanConversion = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];


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
    if(json == null) {
        const dummyEvent = {};
        return {id: null, name: '', surname: '', birth: dummyEvent, death: dummyEvent};
    }

    const names = json.tree.filter(byTag(TAG_NAME));
    let name = getFirst(names.flatMap(a => a.tree.filter(byTag(TAG_GIVEN_NAME)).map(o => o.data)), EMPTY).replace(/_/, ' '),
        surname = getFirst(names.flatMap(a => a.tree.filter(byTag(TAG_SURNAME)).map(o => o.data)), EMPTY).replace(/_/, ' ');
    const sex = getFirst(json.tree.filter(byTag(TAG_SEX)).map(s => s.data === 'M'), null);
    const canSign = getFirst(json.tree.filter(byTag(TAG_SIGNATURE)).map(s => s.data === TAG_YES), null);
    const occupations = json.tree.filter(byTag(TAG_OCCUPATION)).map(d => d.data);
    const occupationsOld = json.tree.filter(byTag(TAG_EVENT)).map(e => e.tree).filter(e => e.filter(byTag(TAG_TYPE))
        .some(e => e.data === VALUE_OCCUPATION)).flatMap(e => e.filter(byTag(TAG_NOTE)).map(n => n.data));

    const firstOccupation = getFirst(occupations.concat(occupationsOld), null);

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

    return {id: json.pointer, name: name, surname: surname, birth: birthData, death: deathData, sex: sex, canSign: canSign, occupation: firstOccupation};
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
            const sep = '/';
            if(day === 0)
                obj.display = Utils.padTwoDigits(month) + sep + yearDisplay;
            else
                obj.display = Utils.padTwoDigits(day) + sep + Utils.padTwoDigits(month) + sep + yearDisplay;
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

    function buildRecursive(individual, parent, sosa, height) {

        // TODO: `individual` can be null thus raising an excepting on `individual.pointer`

        let obj = buildIndividual(individual, config);
        obj.sosa = sosa;
        obj.generation = height;
        if(individual == null) { // Special case: placeholder individuals
            obj.sex = sosa % 2 === 0;
        }

        if(config.computeChildrenCount) { // On-demand property
            const forTag = obj.sex == null ? null : (obj.sex ? TAG_HUSBAND : TAG_WIFE);
            const familiesAsParent = families.filter(f => f.tree.some(t => t.tag === forTag && individual != null && t.data === individual.pointer)).flatMap(f => f.tree.filter(byTag(TAG_CHILD)));
            obj.childrenCount = individual != null ? familiesAsParent.length : null;
        }

        if (height < maxHeight) {
            const familyA = individual != null ? families.filter(byChild(individual)) : [];

            if(familyA.length === 0 && config.showMissing) {
                obj.children = [buildRecursive(null, obj, sosa * 2, height + 1), buildRecursive(null, obj, sosa * 2 + 1, height + 1)];
                obj.marriage = {};
            } else if(familyA.length > 0) {
                const family = familyA[0];

                function getParent(tag) {
                    const parent = family.tree.filter(byTag(tag)).flatMap(id => individuals.filter(ind => ind.pointer === id.data));
                    return !config.showMissing || parent.length > 0 ? parent : [null];
                }

                const husbandA = getParent(TAG_HUSBAND), wifeA = getParent(TAG_WIFE);

                const parents = (husbandA.map(h => buildRecursive(h, obj, sosa * 2, height + 1)))
                    .concat(wifeA.map(w => buildRecursive(w, obj, sosa * 2 + 1, height + 1)));

                if (parents.length > 0) {
                    obj.children = parents;

                    obj.marriage = buildEvent(getFirst(family.tree.filter(byTag(TAG_MARRIAGE)), null), config);
                }
            }
        }

        obj.parent = _ => parent;

        return obj;
    }

    return buildRecursive(rootIndividual, null, 1, 0);
}

function toJson(data) {

    const view = new Uint8Array(data);
    const text = Utf8ArrayToStr(view);
    const parsed = parseGedcom.parse(text);

    const isAnsi = getFirst(parsed.filter(byTag(TAG_HEAD)).flatMap(a => a.tree.filter(byTag(TAG_ENCODING)).map(a => a.data)), null) === TAG_ANSI;

    if(isAnsi) { // Conversion and reparsing needed
        console.log("ANSI detected, converting");
        const extendedAsciiTable = "€?‚ƒ„…†‡ˆ‰Š‹Œ?Ž??‘’“”•–—˜™š›œ?žŸ?¡¢£¤¥¦§¨©ª«¬?®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ"; // Let's hope this doesn't cause issues with IDEs
        const builder = [];
        const mask = 0x80;

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

function getIndividualsList(json) {
    return json.filter(byTag(TAG_INDIVIDUAL)).map(
        ind => buildIndividual(ind, {dates: {showInvalidDates: false, showYearsOnly: true}, places: {showPlaces: false}})
    );
}

// http://www.onicos.com/staff/iz/amuse/javascript/expert/utf.txt
function Utf8ArrayToStr(array) {
    let out, i, len, c;
    let char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4)
        {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
            // 0xxxxxxx
            out += String.fromCharCode(c);
            break;
            case 12: case 13:
            // 110x xxxx   10xx xxxx
            char2 = array[i++];
            out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
            break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }
    return out;
}

module.exports = {
    buildIndividual: buildIndividual,
    toJson: toJson,
    buildHierarchy: buildHierarchy,
    getIndividualsList: getIndividualsList
};
