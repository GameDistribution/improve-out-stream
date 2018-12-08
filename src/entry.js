'use strict';

import SDK from './main';

// Get the settings.
const settings = (typeof OUTSTREAM_OPTIONS === 'object' && OUTSTREAM_OPTIONS)
    ? OUTSTREAM_OPTIONS
    : {};

// Create the instance.
window.idoutstream = new SDK(settings);
