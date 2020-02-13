// Vendors
import './scripts/vendor/jquery'
import './scripts/vendor/bootstrap'

import { library, dom } from '@fortawesome/fontawesome-svg-core'

import { faLeaf } from '@fortawesome/free-solid-svg-icons'
library.add(faLeaf);

dom.i2svg();

dom.watch();

import './scss/home.scss'

// URLs
$('.service').on('click', function () {
    location.href = $(this).attr('data-url');
});