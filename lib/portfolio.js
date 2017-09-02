'use strict';

require('dotenv').config();
const request = require('request');
const q = require('q');
const CryptoJS = require('crypto-js');
const pretty = require('prettyjson-256');

//
// [ BUY BTC & ETH DAILY ON BITSTAMP ]
// by @satoshinaire
// based on https://gist.github.com/levelsio/ee9539134035492ba77a7be1b49ed832 by @levelsio
//
// 2017-08-23
//
// 1) buy $40/day BTC
// 2) buy $10/day ETH
//
// add to CRON:
//
// @daily node portfolio-dca/daemon.js
//
// The MIT License (MIT)
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

class Portfolio {
  constructor () {
    //this.period = 600000; // 10 minutes
    this.period = 30000; // 30 seconds

    // find credentials on Bitstamp
    this.customerID = process.env.CUSTOMER_ID;
    this.bitstampKey = process.env.BITSTAMP_KEY;
    this.bitstampSecret = process.env.BITSTAMP_SECRET;

    // change values if you like
    this.btcToBuyInUSD = 400;
    this.ethToBuyInUSD = 100;

    this.status = {
      last_run: {
        btc: 0,
        eth: 0
      }
    };
  }

  get_price(crypto) {
    let deferred = q.defer();

    if ( ! this.due(this.status.last_run[crypto]) ) {
      deferred.reject();
    } else {
      this.status.last_run[crypto] = this.now();
      console.log('Getting latest ' + crypto.toUpperCase() + ' price...');

      let url = 'https://www.bitstamp.net/api/v2/ticker/' + crypto + 'usd';
      let reply = this.get_remote( url )
      .then((reply) => {
        console.log('$' + reply.ask);
        let buy_data = {
          crypto: crypto,
          price: reply.ask
        };
        deferred.resolve(buy_data);
      })
      .catch((err) => {
        console.log(err);
        deferred.reject(err);
      });
    }

    return deferred.promise;
  }

  do_buy(buy_data) {
    let deferred = q.defer();

    // TODO: Check for unreasonably large different from yesterday's price
    /*
    if ( buy_data.price < 1000 || buy_data.price > 10000 ) {
      let err = 'Exiting because BTC price either <$1,000 or >$10,000';
      console.log(err + "\n");
      deferred.reject(err);
    }
    */

    let cryptoToBuy = ( this.btcToBuyInUSD / buy_data.price).toFixed(8);

    console.log('Buying $' + this.btcToBuyInUSD + ' of ' + buy_data.crypto.toUpperCase() + ', which equals ' + cryptoToBuy + ' ' + buy_data.crypto.toUpperCase() + "\n");

    let url = 'https://www.bitstamp.net/api/v2/buy/market/' + buy_data.crypto + 'usd/';

    let d = new Date();
    let mt = d.getTime();
    let nonce = mt;

    let fields = {
      key: encodeURI(this.bitstampKey),
      signature: encodeURI(this.generateBitstampSignature(nonce)),
      nonce: encodeURI(nonce),
      amount: encodeURI(cryptoToBuy)
    };

    //url-ify the data for the POST
    let fields_string = '';
    let fields_string_blank = true;

    for ( let key in fields ) {
      if ( ! fields_string_blank ) {
        fields_string += '&';
      }
      fields_string += key + '=' + fields[key];
      fields_string_blank = false;
    }

    let reply = this.post_remote( url, fields, fields_string )
    .then((reply) => {
      deferred.resolve(reply);
    })
    .catch((err) => {
      deferred.reject(err);
    });

    return deferred.promise;
  }

  get_remote(url) {
    return new Promise((resolve, reject) => {
      let options = {
        url: url
      };
      request.get(options, (err, resp, body) => {
        if (err) {
          reject(err.message);
        }
        const output = JSON.parse(body);
        resolve(output);
      });
    });
  }

  post_remote(url, fields, fields_string) {
    return new Promise((resolve, reject) => {
      let options = {
        url: url,
        form: fields
      };
      request.post(options, (err, resp, body) => {
        if (err) {
          reject(err.message);
        }
        const output = JSON.parse(body);
        if (output.status == 'error') {
          let err = {
            message: output.reason['__all__'][0]
          }
          reject(err);
        }
        resolve(output);
      });
    });
  }

  due(last_run_instance) {
    let diff = this.now() - last_run_instance;

    if (diff > this.period) {
      return true;
    } else {
      return false;
    }
  }

  now() {
    let d = new Date();
    return d.getTime();
  }

  generateBitstampSignature(nonce) {
    let message = nonce + this.customerID + this.bitstampKey;
    let hash = CryptoJS.HmacSHA256(message, this.bitstampSecret);

    return hash.toString().toUpperCase();
  }
}

module.exports.Portfolio = Portfolio;
