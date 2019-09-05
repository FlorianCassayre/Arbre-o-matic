// TODO start moving functions into this file

function padTwoDigits(n) {
    const s = n.toString();
    return s.length === 1 ? '0' + s : s;
}


module.exports = {
    padTwoDigits: padTwoDigits
};