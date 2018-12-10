'use strict';

/* eslint-disable */
function extendDefaults(source, properties) {
    let property;
    for (property in properties) {
        if (properties.hasOwnProperty(property)) {
            if (properties[property] !== null &&
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

    let domain = referrer.replace(/^(?:https?:\/\/)?(?:\/\/)?(?:www\.)?/i, '').
        split('/')[0];

    if (document.referrer.indexOf('localhost') !== -1) {
        domain = 'gamedistribution.com';
    }

    return domain;
}

/**
 * _onVisibilityChange
 * @param {Object} el
 * @param {Function} callback
 * @return {Function}
 * @private
 */
function onVisibilityChange(el, callback) {
    let oldVisible = false;
    return () => {
        const visible = isElementInViewport(el);
        if (visible !== oldVisible) {
            oldVisible = visible;
            if (typeof callback === 'function') {
                callback();
            }
        }
    };
}

/**
 * _isElementInViewport
 * @param {Object} el
 * @return {boolean}
 * @private
 */
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    const height = getRatioHeight(el.offsetWidth, 9, 16);

    const top = rect.top + height / 2 <
        (window.innerHeight / 2 || document.documentElement.clientHeight / 2);
    const right = rect.right >= 0;
    const bottom = rect.bottom >= 0;
    const left = rect.left <
        (window.innerWidth || document.documentElement.clientWidth);

    return top && right && bottom && left;
}

/**
 * getRatioHeight
 * @param {Number} width
 * @param {Number} ratioHeight
 * @param {Number} ratioWidth
 * @return {Number}
 * @private
 */
function getRatioHeight(width, ratioHeight, ratioWidth) {
    const ratio = width / ratioWidth;
    return ratio * ratioHeight;
}

/**
 * debounce
 * Ensures a function won't be called before a defined amount of time.
 * Ex:
 *    on window resize, ensure a function won't be called
 *    until the user stopped resizing window for {time param}
 *
 * @param { function } fn Callback to be executed after debounce
 * @param { int } time Time to wait before function execution
 * @return {function(...[*])}
 */
function debounce(fn, time = 300) {
    // Store active timeout.
    let timeout;

    return (...args) => {
        // Clear active timeout to prevent fn execution
        clearTimeout(timeout);
        // Start a new timeout
        timeout = setTimeout(fn.bind(null, ...args), time);
    };
}

export {
    extendDefaults,
    getParentDomain,
    onVisibilityChange,
    getRatioHeight,
    debounce,
};
/* eslint-enable */
