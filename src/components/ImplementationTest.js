'use strict';

import EventBus from '../components/EventBus';

let instance = null;

/**
 * ImplementationTest
 */
class ImplementationTest {
    /**
     * Constructor of ImplementationTest.
     * @param {String} testing
     * @return {*}
     */
    constructor(testing) {
        // Make this a singleton.
        if (instance) {
            return instance;
        } else {
            instance = this;
        }

        this.testing = testing;
        this.eventBus = new EventBus();
    }

    /**
     * Start testing.
     */
    start() {
        const css = `
            #idoutstream__implementation {
                display: flex;
                box-sizing: border-box;
                position: fixed;
                z-index: 667;
                bottom: 0;
                left: 0;
                width: 100%;
                padding: 3px;
                background: #001c4a;
                box-shadow: 0 0 8px rgba(0, 0, 0, 0.8);
                color: #fff;
                font-family: Helvetica, Arial, sans-serif;
                font-size: 8px;
            }
            #idoutstream__implementation button {
                flex: 1;
                background: #006db6;
                padding: 3px 10px;
                margin: 2px;
                border: 0;
                border-radius: 3px;
                color: #fff;
                outline: 0;
                cursor: pointer;
                font-size: 8px;
                box-shadow: 0 0 0 transparent;
                text-shadow: 0 0 0 transparent;
                text-overflow: ellipsis;
                overflow: hidden;
                white-space: nowrap;
            }
            #idoutstream__implementation button:hover {
                background: #278CEB;
            }
            #idoutstream__implementation button:active {
                background: #278CEB;
            }
        `;

        const html = `
            <div id="idoutstream__implementation">
                <button id="idoutstream__hbgdDebug">Activate hbgd debug</button>
                <button id="idoutstream__hbgdConfig">Log idhbgd config</button>
                <button id="idoutstream__showAd">Show Ad</button>
                <button id="idoutstream__cancel">Cancel Ad</button>
                <button id="idoutstream__demo">Demo VAST tag</button>
                <button id="idoutstream__interval">Disable interval</button>
                <button id="idoutstream__closeDebug">Close</button>
            </div>
        `;

        // Add css
        const head = document.head || document.getElementsByTagName('head')[0];
        const style = document.createElement('style');
        style.type = 'text/css';
        if (style.styleSheet) {
            style.styleSheet.cssText = css;
        } else {
            style.appendChild(document.createTextNode(css));
        }
        head.appendChild(style);

        // Add html
        const body = document.body || document.getElementsByTagName('body')[0];
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.zIndex = '668';
        container.style.bottom = '0';
        container.innerHTML = html;
        body.appendChild(container);

        // Add listeners
        const showAd = document.getElementById('idoutstream__showAd');
        const cancelAd = document.getElementById('idoutstream__cancel');
        const demoAd = document.getElementById('idoutstream__demo');
        const requestInterval = document.getElementById(
            'idoutstream__interval');
        const hbgdDebug = document.getElementById('idoutstream__hbgdDebug');
        const hbgdConfig = document.getElementById('idoutstream__hbgdConfig');
        const closeDebug = document.getElementById('idoutstream__closeDebug');

        if (localStorage.getItem('idoutstream_tag')) {
            demoAd.innerHTML = 'Revert Vast tag';
            demoAd.style.background = '#ff8c1c';
        } else {
            demoAd.innerHTML = 'Demo VAST tag';
            demoAd.style.background = '#44a5ab';
        }

        if (localStorage.getItem('idoutstream_interval')) {
            requestInterval.innerHTML = 'Revert delay';
            requestInterval.style.background = '#ff8c1c';
        } else {
            requestInterval.innerHTML = 'Disable delay';
            requestInterval.style.background = '#44a5ab';
        }

        showAd.addEventListener('click', () => {
            window.idoutstream.showAdvertisement();
        });
        cancelAd.addEventListener('click', () => {
            window.idoutstream.videoAdInstance.cancel();
        });
        demoAd.addEventListener('click', () => {
            try {
                if (localStorage.getItem('idoutstream_tag')) {
                    localStorage.removeItem('idoutstream_tag');
                } else {
                    // const tag = 'https://pubads.g.doubleclick.net/gampad/' +
                    //     'ads?sz=640x480&iu=/124319096/external/' +
                    //     'single_ad_samples&ciu_szs=300x250&impl=' +
                    //     's&gdfp_req=1&env=vp&output=vast' +
                    //     '&unviewed_position_start=1&' +
                    //     'cust_params=deployment%3Ddevsite' +
                    //     '%26sample_ct%3Dlinear&correlator=';
                    const tag = `https://ad.360yield.com/advast?p=13292561&w=16&h=9&minduration={MINDURATION}&maxduration={MAXDURATION}&player_width={PLAYER_WIDTH}&player_height={PLAYER_HEIGHT}&referrer={PAGE_REFERRER}&vast_version={VAST_VERSION}&vpaid_version={VPAID_VERSION}&video_format_type={VIDEO_TYPE}`;
                    localStorage.setItem('idoutstream_tag', tag);
                }
                location.reload();
            } catch (error) {
                console.log(error);
            }
        });
        requestInterval.addEventListener('click', () => {
            try {
                if (localStorage.getItem('idoutstream_interval')) {
                    localStorage.removeItem('idoutstream_interval');
                } else {
                    localStorage.setItem('idoutstream_interval', 'true');
                }
                location.reload();
            } catch (error) {
                console.log(error);
            }
        });
        closeDebug.addEventListener('click', () => {
            try {
                if (localStorage.getItem('idoutstream_debug')) {
                    localStorage.removeItem('idoutstream_debug');
                } else {
                    localStorage.setItem('idoutstream_debug', 'true');
                }
                location.reload();
            } catch (error) {
                console.log(error);
            }
        });
        hbgdDebug.addEventListener('click', () => {
            try {
                window.idhbgd.debug(true);
            } catch (error) {
                console.log(error);
            }
        });
        hbgdConfig.addEventListener('click', () => {
            try {
                const config = window.idhbgd.getConfig();
                console.info(config);
            } catch (error) {
                console.log(error);
            }
        });
    }
}

export default ImplementationTest;
