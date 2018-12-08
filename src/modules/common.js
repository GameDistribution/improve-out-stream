'use strict';

/* eslint-disable */
function extendDefaults(source, properties) {
    let property;
    for (property in properties) {
        if (properties.hasOwnProperty(property)) {
            if(properties[property] !== null &&
                typeof properties[property] !== 'undefined') {
                source[property] = properties[property];
            }
        }
    }
    return source;
}

function getParentDomain() {
    let referrer = (window.location !== window.parent.location)
        ? (document.referrer && document.referrer !== '')
            ? document.referrer
            : document.location.host
        : document.location.host;

    let domain = referrer
        .replace(/^(?:https?:\/\/)?(?:\/\/)?(?:www\.)?/i, '')
        .split('/')[0];

    if (document.referrer.indexOf('localhost') !== -1) {
        domain = 'gamedistribution.com';
    }

    return domain;
}

export {
    extendDefaults,
    getParentDomain,
};
/* eslint-enable */
