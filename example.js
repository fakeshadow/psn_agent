const PSNAgent = require('./index.js');

async function main() {
    const apiKey = "your api key";
    // Your psn account email and password. 
    // They are passed to puppeteer's headless chrome browser and only used on PSN login page.
    const user = { username: "your email", password: "your password" }

    const agent = new PSNAgent();
    try {
        await agent.init(apiKey);

        /* 
            Normally this would take 20+ seconds or even more.
            There is also a chance this call would fail for various reasons.
        */
        const { npsso, expires_at } = await agent.get_npsso(user.username, user.password);
        console.log(`this is your npsso code: ${npsso}\r\nWhich exprires at: ${expires_at} and it can be used by npm package: pxs-psn-api before that time`);

        const balance = await agent.get_balance();
        console.log(`this is your remaining balance of 2captcha service: ${balance}`);
    } catch (e) {
        console.log(`oops we got error: ${e}`);
    }

    await agent.stop();
}

main();