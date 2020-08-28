import * as form from './form';

const warningsContainer = $('#warnings-container');

export function clear() {
    warningsContainer.empty();
}

export function display() {
    const warnings = [];

    clear();

    function containsSpecial(str) {
        const specialCharacters = "*_\"?|";
        for(let i = 0; i < specialCharacters.length; i++) {
            if(str.includes(specialCharacters[i])) {
                return true;
            }
        }
        return false;
    }

    if(containsSpecial(form.name) || containsSpecial(form.surname)) {
        warnings.push(__("insee.warnings.special_characters"));
    }
    if(form.event === 'birth') {
        const minBirth = 1850;
        if(form.before !== '0' && parseInt(form.before) < minBirth) {
            warnings.push(__("insee.warnings.early_birth"));
        }
    } else {
        const minDeath = 1970;
        if(form.before !== '0' && parseInt(form.before) < minDeath) {
            warnings.push(__("insee.warnings.early_death"));
        }
    }

    if(warnings.length > 0) {
        console.log("WARN"); // TODO
        const alert = $('#warning-template > #warning-alert');
        const alertCopy = alert.clone();
        const list = alertCopy.find('#warning-list');

        list.empty();
        warnings.forEach(warning => {
            const li = $("<li></li>").text(warning);
            list.append(li);
        });

        warningsContainer.html(alertCopy);
    }
}