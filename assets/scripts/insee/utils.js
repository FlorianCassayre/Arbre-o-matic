const is_plural = new Function('return ' + __('common.is_plural'))()

export function pluralize(count, singular, plural) {
    return is_plural(count) ? plural : singular;
}
