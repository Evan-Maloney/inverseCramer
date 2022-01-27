const functions = require("firebase-functions");
require('dotenv').config();


const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.API_KEY,
  organization: process.env.USER_KEY,

});
const openai = new OpenAIApi(configuration);

const Alpaca = require('@alpacahq/alpaca-trade-api');
const alpaca = new Alpaca({
  keyId: process.env.API_KEY_ALPACA,
  secretKey: process.env.SECRET_KEY,
  paper: true,
});

const puppeteer = require('puppeteer');

async function scrape() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('https://twitter.com/jimcramer', {
    waitUntil: 'networkidle2',
  });

  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'example.png' });

  const tweets = await page.evaluate( async () => {
    return document.body.innerText;
  });

  await browser.close();

  return tweets;

}

exports.helloWorld = functions.https.onRequest(async (request, response) => {

  response.send('test');

});

exports.getRickQuick = functions.runWith({ memory: '4GB'}).pubsub
.schedule('0 10 ** 1-5')
.timeZone('America/New_York')
.onRun(async (ctx) => {
  console.log('This will run M-F at 10:00 AM Eastern!');

  const tweets = await scrape(); 
  const gptCompletion = await openai.createCompletion('text-davinci-001', {
      prompt: `${tweets}. Jim Cramer recommends selling the following stock tickers: `,
      temperature: 0.7,
      max_tokens: 32,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    const stocksToBuy = gptCompletion.data.choices[0].text.match(/\b[A-Z]+\b/g);

    console.log(`Thanks for the tips Jim! ${stocksToBuy}`);

    if (!stocksToBuy) {
      console.log('sitting this one out');
      return null;
    }

    const cancel = await alpaca.cancelAllOrders();
    const liquidate = await alpaca.cancelAllPositions();

    const account = await alpaca.getAccount();

    console.log(`dry powder: ${account.buying_power}`);

    const order = await alpaca.createOrder({
      symbol: stocksToBuy[0],

      notional: account.buying_power * 0.5,
      side: 'buy',
      type: 'market',
      time_in_force: 'day',

    });

    response.send(order)

});





