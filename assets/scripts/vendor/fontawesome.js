import { library, dom } from '@fortawesome/fontawesome-svg-core'


import { faSpinner, faPlus, faMinus, faFolderOpen, faPrint, faDownload, faArrowsAlt, faExclamationTriangle, faQuestionCircle, faLongArrowAltLeft, faGlobe } from '@fortawesome/free-solid-svg-icons'
library.add(faSpinner, faPlus, faMinus, faFolderOpen, faPrint, faDownload, faArrowsAlt, faExclamationTriangle, faQuestionCircle, faLongArrowAltLeft, faGlobe);

import { faDotCircle, faFilePdf, faFileCode, faFileImage } from '@fortawesome/free-regular-svg-icons'
library.add(faDotCircle, faFilePdf, faFileCode, faFileImage);

import { faGithub } from '@fortawesome/free-brands-svg-icons'
library.add(faGithub);


// Automatically find any <i> tags in the page and replace those with <svg> elements
// https://fontawesome.com/how-to-use/with-the-api/methods/dom-i2svg
dom.i2svg();


// Watch the DOM automatic for any additional icons being added or modified
// dom.watch()
