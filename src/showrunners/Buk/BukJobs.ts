// Do Scheduling
// https://github.com/node-schedule/node-schedule
// *    *    *    *    *    *
// ┬    ┬    ┬    ┬    ┬    ┬
// │    │    │    │    │    │
// │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
// │    │    │    │    └───── month (1 - 12)
// │    │    │    └────────── day of month (1 - 31)
// │    │    └─────────────── hour (0 - 23)
// │    └──────────────────── minute (0 - 59)
// └───────────────────────── second (0 - 59, OPTIONAL)
// Execute a cron job every 5 Minutes = */5 * * * *
// Starts from seconds = * * * * * *
// {
//  "PK": "0x5a4d4c98c63e849f97aef15324834a399be563ec48b6264ccab5f71dfdc50cea" ,
//  "CHAIN_ID": "eip155:80001"
//}

import config from '../../config';
import logger from '../../loaders/logger';
import { Container } from 'typedi';
import schedule from 'node-schedule';
import BukChannel from './BukChannel';

export default () => {
  const startTime = new Date(new Date().setHours(0, 0, 0, 0));
  const threeHourRule = new schedule.RecurrenceRule();
  threeHourRule.hour = new schedule.Range(0, 23, 3);
  const channel = Container.get(BukChannel);
  threeHourRule.minute = 0;

  const tenMinuteRule = new schedule.RecurrenceRule();
  tenMinuteRule.minute = new schedule.Range(0, 59, 10);

  channel.logInfo(`     🛵 Scheduling Showrunner  [on 24 hours] `);

  schedule.scheduleJob({ start: startTime, rule: tenMinuteRule }, async function () {
    const taskName = `${channel.cSettings.name} booking notifications`;
    try {
      channel.sendBookingNotifications(false);
      channel.logInfo(`🐣 Cron Task Completed -- ${taskName}`);
    } catch (err) {
      logger.error(`[${new Date(Date.now())}] ❌ Cron Task Failed -- ${taskName}`);
      logger.error(`[${new Date(Date.now())}] Error Object: %o`, err);
    }
  });
  schedule.scheduleJob({ start: startTime, rule: threeHourRule }, async function () {
    const taskName = `${channel.cSettings.name} precheckIn reminder`;
    try {
      channel.sendPrecheckInReminder(false);
      channel.logInfo(`🐣 Cron Task Completed -- ${taskName}`);
    } catch (err) {
      logger.error(`[${new Date(Date.now())}] ❌ Cron Task Failed -- ${taskName}`);
      logger.error(`[${new Date(Date.now())}] Error Object: %o`, err);
    }
  });
  schedule.scheduleJob({ start: startTime, rule: threeHourRule }, async function () {
    const taskName = `${channel.cSettings.name} sendCancelBookingNotification`;
    try {
      channel.sendCancelBookingNotification(false);
      logger.info(`🐣 Cron Task Completed -- ${taskName}`);
    } catch (err) {
      logger.error(`❌ Cron Task Failed -- ${taskName}`);
      logger.error(`Error Object: %o`, err);
    }
  });
  channel.logInfo(`-- 🛵 Scheduling Showrunner ${channel.cSettings.name} -  Channel [on 3hr ]`);
  schedule.scheduleJob({ start: startTime, rule: threeHourRule }, async function () {
    const taskName = `${channel.cSettings.name} sendCheckoutNotifs`;
    try {
      channel.sendCheckoutNotifs(false);
      logger.info(`🐣 Cron Task Completed -- ${taskName}`);
    } catch (err) {
      logger.error(`❌ Cron Task Failed -- ${taskName}`);
      logger.error(`Error Object: %o`, err);
    }
  });
  channel.logInfo(`-- 🛵 Scheduling Showrunner ${channel.cSettings.name} -  Channel [on 3hr ]`);
  schedule.scheduleJob({ start: startTime, rule: tenMinuteRule }, async function () {
    const taskName = `${channel.cSettings.name} sendListingNotifs`;
    try {
      channel.sendListingNotifs(false);
      logger.info(`🐣 Cron Task Completed -- ${taskName}`);
    } catch (err) {
      logger.error(`❌ Cron Task Failed -- ${taskName}`);
      logger.error(`Error Object: %o`, err);
    }
  });
  channel.logInfo(`-- 🛵 Scheduling Showrunner ${channel.cSettings.name} -  Channel [on 3hr ]`);
  schedule.scheduleJob({ start: startTime, rule: threeHourRule }, async function () {
    const taskName = `${channel.cSettings.name} sendListingSoldNotifs`;
    try {
      channel.sendListingSoldNotifs(false);
      logger.info(`🐣 Cron Task Completed -- ${taskName}`);
    } catch (err) {
      logger.error(`❌ Cron Task Failed -- ${taskName}`);
      logger.error(`Error Object: %o`, err);
    }
  });
};
