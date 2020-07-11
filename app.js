// example command to run
// node app http://www.ufcstats.com/fighter-details/1338e2c7480bdf9e
// node app http://www.ufcstats.com/fighter-details/3a8176e15b9887c1
// node app http://www.ufcstats.com/fighter-details/8c0580d4fff106c1
// node app http://www.ufcstats.com/fighter-details/8c0580d4fff106c1

const pupHelper = require('./puppeteerhelper');
const selectors = require('./selectors');
const fs = require('fs');
let browser;

const run = async () => {
  try {
    const url = process.argv[2];
    browser = await pupHelper.launchBrowser();
  
    await fetchPerson(url);
    
    await browser.close();
  } catch (error) {
    if (browser) await browser.close();
    return error;
  }
};

const fetchPerson = (url) => new Promise(async (resolve, reject) => {
  let page;
  try {
    const person = {}
    page = await pupHelper.launchPage(browser);
    await page.goto(url, {timeout: 0, waitUntil: 'load'});
    await page.waitForSelector(selectors.infoContainer);
    
    person.name = await pupHelper.getTxt(selectors.name, page);

    person.nickName = await pupHelper.getTxt(selectors.nickName, page);
    
    const record = await pupHelper.getTxt(selectors.record, page);
    person.record = await splitRecord(record);

    person.details = await fetchDetails(page);

    person.fights = await fetchFights(page);
    
    fs.writeFileSync('person.json', JSON.stringify(person));
    await page.close();
    resolve(true);
  } catch (error) {
    if (page) await page.close();
    console.log(`Run Error: ${error}`);
    reject(error);
  }
})

const splitRecord = (record) => new Promise(async (resolve, reject) => {
  try {
    const returnVal = {};
    if (/\d+-\d+-\d+/gi.test(record)) {
      const rec = record.match(/\d+-\d+-\d+/gi)[0].trim();
      const allRecs = rec.split('-');
      returnVal.wins = allRecs[0];
      returnVal.lost = allRecs[1];
      returnVal.tie = allRecs[2];
    }

    resolve(returnVal);
  } catch (error) {
    console.log('splitRecord Error: ', error);
    reject(error);
  }
});

const fetchDetails = (page) => new Promise(async (resolve, reject) => {
  try {
    const details = {};

    await page.waitForSelector(selectors.props);
    const props = await page.$$(selectors.props);

    for (let i = 0; i < props.length; i++) {
      let propLabel = await pupHelper.getTxt('.b-list__box-item-title', props[i]);
      if (propLabel !== '') {
        propLabel = propLabel.replace(/[\s\.\,\:]/gi, '').trim().toLowerCase();
        const propValue = await page.evaluate(
          elm => elm.childNodes[2].textContent.trim(),
          props[i]
        )
        details[propLabel] = propValue;
      }
    }

    resolve(details);
  } catch (error) {
    console.log('fetchDetails Error: ', error);
    reject(error);
  }
});

const fetchFights = (page) => new Promise(async (resolve, reject) => {
  try {
    const fights = [];
    await page.waitForSelector(selectors.fightTr);

    const fightRows = await page.$$(selectors.fightTr);
    
    for (let rowNumber = 0; rowNumber < fightRows.length; rowNumber++) {
      const fight = {};
      
      fight['w/l'] = await pupHelper.getTxt(selectors.fightWr, fightRows[rowNumber]);
      if (fight['w/l'].toLowerCase() == 'win') fight['w/l'] = 'W';
      if (fight['w/l'].toLowerCase() == 'loss') fight['w/l'] = 'L';
      if (fight['w/l'].toLowerCase() == 'next') fight['w/l'] = 'N';
      if (fight['w/l'].toLowerCase() == 'nc') fight['w/l'] = 'NC';

      fight.event = {name: ''};
      fight.event.name = await pupHelper.getTxt(selectors.fightEvent, fightRows[rowNumber]);

      fight.method = await pupHelper.getTxt(selectors.fightMethod, fightRows[rowNumber]);
      
      fight.round = await pupHelper.getTxt(selectors.fightRound, fightRows[rowNumber]);
      
      fight.time = await pupHelper.getTxt(selectors.fightTime, fightRows[rowNumber]);
      
      fight.FOTN = false      // true when FIGHT in Method
      fight.POTN = false      // true when PERF in Method
      const FP = await pupHelper.getAttr(selectors.fightMethodFP, 'src', fightRows[rowNumber]);
      if (FP.endsWith('fight.png')) fight.FOTN = true;
      if (FP.endsWith('perf.png')) fight.POTN = true;

      fight.fighters = {};
      const fighterRows = await fightRows[rowNumber].$$(selectors.fighterName);

      for (let fRowNumber = 0; fRowNumber < fighterRows.length; fRowNumber++) {
        const fighterName = await page.evaluate(elm => elm.innerText.trim(), fighterRows[fRowNumber]);
        fight.fighters[fighterName] = {};

        if (fight['w/l'] != 'N') {
          fight.fighters[fighterName].STR = await pupHelper.getTxt(`td:nth-child(3) > p:nth-child(${fRowNumber + 1})`, fightRows[rowNumber])
          fight.fighters[fighterName].TD = await pupHelper.getTxt(`td:nth-child(4) > p:nth-child(${fRowNumber + 1})`, fightRows[rowNumber])
          fight.fighters[fighterName].SUB = await pupHelper.getTxt(`td:nth-child(5) > p:nth-child(${fRowNumber + 1})`, fightRows[rowNumber])
          fight.fighters[fighterName].PASS = await pupHelper.getTxt(`td:nth-child(6) > p:nth-child(${fRowNumber + 1})`, fightRows[rowNumber])
        }
      }
      
      fights.push(fight);
    }

    resolve(fights);
  } catch (error) {
    console.log('fetchFights Error: ', error);
    reject(error);
  }
});

run();
