import '../../scss/insee.scss'

const d3 = require('d3');

import {dom, library} from '@fortawesome/fontawesome-svg-core'

import { faBook, faFileCsv, faFileDownload, faFilter, faInfoCircle, faLink, faLongArrowAltLeft, faMars, faSearch, faSort, faVenus, faUndoAlt, faExclamationCircle, faWrench, faGlobe } from '@fortawesome/free-solid-svg-icons'
import {faGithub} from '@fortawesome/free-brands-svg-icons'

library.add(faBook, faSearch, faMars, faVenus, faInfoCircle, faLongArrowAltLeft, faFileDownload, faFileCsv, faFilter, faSort, faLink, faUndoAlt, faExclamationCircle, faWrench, faGlobe);

library.add(faGithub);

dom.i2svg();

dom.watch(); // Important because we are dynamically adding icons

import './ui' // Start app