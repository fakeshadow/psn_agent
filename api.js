/// 2chaptcha is used as bypass service for recaptcha v2.
///
/// This tool have nothing to do with the running of said service and no `soft_id` is used in the service call

'use strict';

const axios = require('axios');
const poll = require('promise-poller').default;

const config = require('./config.js');

class twocaptchaAPI {
    constructor({
        apiKey = null,
        proxy = null,
    }) {
        this.apiKey = apiKey;
        this.proxy = proxy;
        this.captchaId = null;
        this.captchaRes = null;
    };

    async in(pageUrl) {

        const data = this.proxy != null ? {
            key: this.apiKey,
            method: "userrecaptcha",
            googlekey: config.siteKey,
            invisible: 1,
            json: 1,
            pageurl: pageUrl,
            proxytype: this.proxy.type,
            proxy: this.proxy.address
        } : {
                key: this.apiKey,
                method: "userrecaptcha",
                googlekey: config.siteKey,
                invisible: 1,
                json: 1,
                pageurl: pageUrl,
            }

        const res = await axios({
            method: "post",
            url: config.recaptchaReqUrl,
            data: data,
        });

        if (res.data.status == 1) {
            this.captchaId = res.data.request;
        }
    }

    async out(delay = 15000, interval = 3000, retries = 30) {
        if (this.captchaId == null) {
            throw new Error('We do not have legit captchaId');
        }
        
        await delayFor(delay);

        return poll({
            taskFn: get_inner({ apiKey: this.apiKey, captchaId: this.captchaId }),
            interval,
            retries
        });
    }
}

module.exports = twocaptchaAPI;

async function delayFor(time) {
    return new Promise(res => setTimeout(res, time));
}

function get_inner({ apiKey, captchaId }) {
    const url = `${config.recaptchaResUrl}?key=${apiKey}&action=get&id=${captchaId}&json=1`;

    return async function () {
        return new Promise(async function (resolve, reject) {
            const res = await axios.get(url);

            const data = res.data;

            if (data.status === 0) {
                return reject(data.request);
            }

            resolve(data.request);
        })
    }
}