/// This tool is for PSN account management automation only.
///
/// Please don't use it for spaming purpose.

/// Known limitation: 
/// - recaptcha resolve service is not at 100% success rate.
/// - Agent will halt if no recaptcah v2 appears in the login page. 
/// - QuerySelector could be halt because the query have possible different css ids according to localization.(Issue welcome)

'use strict';

const puppeteer = require('puppeteer');

const twocaptchaAPI = require('./api.js');
const config = require('./config.js');

class PSNAgent {
    constructor() {
        this.recaptcahResult = null;
    }

    async init(apiKey, proxy) {
        if (apiKey === null) {
            throw new Error("2captcha apiKey must be provided");
        }

        this.proxy = proxy;

        this.api = new twocaptchaAPI({
            apiKey: apiKey,
            proxy: proxy
        });

        // - We don't pass proxy_arg to puppeteer as for now proxy is not needed.
        // let proxy_arg;
        // const { type, address } = proxy;
        // if (type === "HTTP") {
        //     proxy_arg = `--proxy-server=${address}`;
        // } else {
        //     proxy_arg = `--proxy-server=${type}://${address}`;
        // }

        this.browser = await puppeteer.launch({
            // change this to false if you want to monitor the login process
            headless: true,
            slowMo: 20,
            defaultViewport: null,
            args: [
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                // proxy_arg
            ]
        });
    }

    async stop() {
        this.browser.close();
    }

    async get_npsso(username, password) {
        const page = await this.browser.newPage();

        await page.setUserAgent(config.userAgent);

        // setup an interceptor to sniff and change the request/response on the fly
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');
        await client.send('Network.setRequestInterception', {
            patterns: [
                {
                    urlPattern: '*',
                    resourceType: 'XHR',
                    interceptionStage: 'Request'
                }
            ]
        });
        client.on('Network.requestIntercepted', async ({ interceptionId, request }) => {
            let postData = null;

            // intercept the post request to auth api and inject our recaptcha result.
            if (request.method === "POST" && request.url.startsWith(config.autUrl)) {
                postData = request.postData.toString();
                if (postData.startsWith("grant_type=captcha")) {
                    if (this.recaptcahResult != null) {
                        const tokenStr = "response_token=";
                        postData = postData.substring(0, postData.indexOf(tokenStr));
                        postData = postData + tokenStr + this.recaptcahResult;
                    };
                }

                // We just try to parse all request into json and throw away all the failed ones.
                try {
                    const json = JSON.parse(postData);
                    if (json.npsso != null) {
                        this.npsso = json.npsso;
                        return;
                    }
                } catch (e) {
                    // we do nothing if the parse failed and sliently drop the error
                }
            }

            postData != null ?
                client.send('Network.continueInterceptedRequest', { interceptionId, postData })
                : client.send('Network.continueInterceptedRequest', { interceptionId });

        });

        // - This session is commented as we don't need proxy for now. It's a future proof bypass feature.
        // const proxy = this.proxy;
        // if (proxy.username != null && proxy.password != null) {
        //     await page.authenticate({ username: proxy.username, password: proxy.password });
        // }

        await page.goto(config.url);

        // ToDo: we assume rechaptcha v2 will be there which is not always the case.
        await page.waitForSelector('#g-recaptcha-response');

        // *. emberXX selector could be differ because localization
        await page.waitForSelector('#ember19');

        await page.focus('#ember19');
        await page.keyboard.type(username);

        await page.focus('#ember22');
        await page.keyboard.type(password);

        const submit = await page.$('#ember24');
        submit.click();

        await page.waitFor(2000);
        await this.api.in(page.url());
        this.recaptcahResult = await this.api.out();

        page.evaluate(() => widgetVerified(this));

        // wait for a max 20 seconds for the npsso inteceptor.
        let try_wait = 0;
        while (try_wait < 10) {
            await page.waitFor(2000);
            if (this.npsso === null) {
                if (try_wait === 9) {
                    throw new Error("Timeout when intercept npsso code");
                }
                try_wait += 1;
            } else {
                break;
            }
        }

        await client.detach();
        await page.close();
        return this.npsso;
    }

    async get_balance() {
        return this.api.get_balance();
    }
}

module.exports = PSNAgent;