$('#help').on('click', function (e) { // Help button
    $('#help-modal').modal('show');
    e.preventDefault();
});

$('#api').on('click', function (e) { // API button
    $('#api-modal').modal('show');
    e.preventDefault();
});

$('document').ready(function() {
    $('[data-toggle=tooltip]').tooltip(); // Tooltips
});

export function scrollToTop() {
    $('html,body').animate({scrollTop: 0}, 'fast');
}
