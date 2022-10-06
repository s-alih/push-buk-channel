import { ethers } from 'ethers';
import path from 'path';
import { Container } from 'typedi';
import { Logger } from 'winston';
import config from '../config';
import showrunnersHelper from './showrunnersHelper';
// import { NotificationDetailsModel, INotificationDetails } from '../showrunners/monitoring/monitoringModel';
import * as EpnsAPI from '@epnsproject/sdk-restapi';
import { AccountId } from 'caip';

export interface ChannelSettings {
  networkToMonitor: string;
  dirname: string;
  name: string;
  url: string;
  address?: string;
  useOffChain: boolean;
  isPolygon?: boolean;
}

export interface ISendNotificationParams {
  recipient: string;
  title: string;
  message: string;
  payloadTitle: string;
  payloadMsg: string;
  notificationType: number;
  cta?: string;
  image: string;
  expiry?: number;
  hidden?: boolean;
  simulate: boolean | Object;
  timestamp?: number;
  retry?: boolean;
  offChain?: boolean;
}

interface newStandardPK {
  pk: string;
  chainId: string;
  wallet: string;
  caip10: string;
}

export class EPNSChannel {
  constructor(public logger: Logger, cSettings: ChannelSettings) {
    this.cSettings = cSettings;
    this.init();
  }

  walletKey: newStandardPK;
  channelAddress: string;
  epnsSDK: any;
  cSettings: ChannelSettings;
  failedNotificationsModel: any;
  // channel monitoring service
  jobId: any;
  // channel monitoring service

  private formatWalletKey(walletKey) {
    return walletKey.startsWith('0x') ? walletKey : `0x${walletKey}`;
  }

  private async getWalletKey(dirname: string) {
    dirname = path.basename(dirname);
    this.logInfo('Getting WalletKey for %s', dirname);

    const wallets = config.showrunnerWallets[`${dirname}`];
    const currentWalletInfo = await showrunnersHelper.getValidWallet(dirname, wallets);

    this.logInfo('currentWalletInfo: %o', currentWalletInfo);

    const walletKeyID = `wallet${currentWalletInfo.currentWalletID}`;
    const walletInfo = wallets[walletKeyID];
    const isOldStandard = typeof walletInfo === 'string' || walletInfo instanceof String ? true : false;

    let walletKeyMeta = {
      pk: isOldStandard ? this.formatWalletKey(walletInfo) : this.formatWalletKey(walletInfo.PK),
      chainId: isOldStandard ? `eip155:1` : walletInfo.CHAIN_ID,
    };

    this.logInfo('WalletKey Obtained');

    // const wallet = ethers.utils.computeAddress(walletKeyMeta.pk);
    const wallet = this.cSettings?.address ?? ethers.utils.computeAddress(walletKeyMeta.pk);

    const walletKeyObject = {
      pk: walletKeyMeta.pk,
      chainId: walletKeyMeta.chainId,
      wallet: wallet,
      caip10: this.getCAIPAddress(wallet),
    };

    return walletKeyObject;
  }

  //   Initialize and load this.Settings
  async init() {
    this.logInfo('Initializing Channel : %s', this.cSettings.name);
    try {
      this.walletKey = await this.getWalletKey(this.cSettings.dirname);
      this.channelAddress = this.cSettings?.address ?? ethers.utils.computeAddress(this.walletKey.pk);
      this.logInfo(`channelAddress : ${this.channelAddress}`);

      this.logInfo('Channel Initialization Complete');
    } catch (error) {
      this.logError(error);
    }
  }

  public get timestamp() {
    return Math.floor(Date.now() / 1000);
  }

  // public async getSdk() {
  //   if (this.epnsSDK) {
  //     return this.epnsSDK;
  //   }
  //   await this.init();
  //   return this.epnsSDK;
  // }

  //   --------------------------------------------------
  //   Logging Related
  //
  //
  private get logBase() {
    return `[${new Date(Date.now())}]-[${this.cSettings.name} Channel]- `;
  }

  public get blockNoKey() {
    return `${this.cSettings.name.toUpperCase()}_BLOCK_NO`;
  }

  public logInfo(msg: string, ...args: any[]) {
    this.logger.info(`${this.logBase} ${msg}`, ...args);
  }

  public log(msg: any) {
    this.logger.info(`${this.logBase} %o`, msg);
  }

  public logDebug(msg: string, ...args: any[]) {
    this.logger.debug(`${this.logBase} ${msg}`, ...args);
  }

  public logError(err) {
    this.logger.error(`${this.logBase} %o`, err);
  }

  //   ---------------------------------------------------

  //
  // Notification Related
  // ---------------------------------
  public convertToCAIP(recipients: string | Array<string>) {
    let caipRecipients = recipients;

    if (Array.isArray(recipients)) {
      caipRecipients = [];

      recipients.forEach((add: string) => {
        caipRecipients.push(this.getCAIPAddress(add));
      });
    } else {
      caipRecipients = this.getCAIPAddress(recipients);
    }

    return caipRecipients;
  }

  async sendNotification(params: ISendNotificationParams) {
    const isOffChain = params.offChain ?? this.cSettings.useOffChain ?? false;
    const globalRetryIfFailed = params.retry === undefined ? true : params.retry;
    try {
      this.logInfo('------------------------');
      this.logInfo(`Sending Notification`);
      this.logInfo('------------------------');
      params.payloadMsg = params.payloadMsg + `[timestamp: ${params?.timestamp ?? this.timestamp}]`;

      const signer = new ethers.Wallet(this.walletKey.pk);

      // apiResponse?.status === 204, if sent successfully!
      let apiResponsePayload = {
        signer,
        type: params.notificationType,
        identityType: 2, // direct payload
        notification: {
          title: params.title,
          body: params.message,
        },
        payload: {
          title: params.payloadTitle,
          body: params.payloadMsg,
          cta: params?.cta ?? this.cSettings?.url,
          img: params.image,
        },
        channel: this.walletKey.caip10,
        env: config.showrunnersEnv,
      };

      if (params.notificationType != 1) {
        const caipRecipients = this.convertToCAIP(params.recipient);
        apiResponsePayload['recipients'] = caipRecipients;
      }
      const apiResponse = await EpnsAPI.payloads.sendNotification(apiResponsePayload);
      if (apiResponse?.status === 204) {
        this.logInfo('Notification sent successfully!');
      }

      // const tx = await sdk.sendNotification(
      //   params.recipient,
      //   params.title,
      //   params.message,
      //   params.payloadTitle,
      //   params.payloadMsg,
      //   params.notificationType,
      //   params?.cta ?? this.cSettings?.url,
      //   params.image,
      //   params.simulate,
      //   {
      //     offChain: isOffChain,
      //   },
      // );

      // const { retry = false } = tx;
      // // if its offchain and it fails then use retry logic
      // if (isOffChain && retry && globalRetryIfFailed) {
      //   // if sending this notification fails for any reason then resend it
      //   this.saveFailedNotification(params);
      //   // if sending this notification fails for any reason then resend it
      // }
      // // await this.countNotification(retry);
      // this.logInfo(`transaction ${this.cSettings.name}: %o`, tx);
      // return tx;
    } catch (error) {
      this.logError(`Failed to send notification for channel ${this.cSettings.name}`);
      if (isOffChain) {
        // if sending this notification fails for any reason then resend it
        this.saveFailedNotification(params);
        // if sending this notification fails for any reason then resend it
      }
      this.logError(error);
    }
  }
  /**
   * A method which would help persevere failed messages to the database
   */
  async saveFailedNotification(params: ISendNotificationParams) {
    try {
      const signer = new ethers.Wallet(this.walletKey);
      // get the model and create a new entry for the recently failed job
      params.payloadMsg = params.payloadMsg + `[timestamp: ${params?.timestamp ?? this.timestamp}]`;
      const caipRecipients = [];
      if (params.notificationType === 4 && Array.isArray(params.recipient)) {
        params.recipient.forEach((add) => {
          caipRecipients.push(this.getCAIPAddress(add));
        });
      }
      const notificationPayload = await EpnsAPI.payloads.sendNotification({
        signer,
        type: params.notificationType,
        identityType: 2, // direct payload
        notification: {
          title: params.title,
          body: params.message,
        },
        payload: {
          title: params.payloadTitle,
          body: params.payloadMsg,
          cta: params?.cta ?? this.cSettings?.url,
          img: params.image,
        },
        channel: this.getCAIPAddress(this.channelAddress),
        recipients: caipRecipients.length ? caipRecipients : this.getCAIPAddress(params.recipient), // your channel address
        env: config.showrunnersEnv,
      });

      this.failedNotificationsModel = Container.get('retryModel');
      // add extra check to prevent thrownig errors if a model is not present
      if (this.failedNotificationsModel) {
        const data = { payload: notificationPayload, lastAttempted: new Date() };
        await this.failedNotificationsModel.insertMany([data]);
      }
    } catch (err) {
      this.logError(err.message);
    }
  }
  // async countNotification(retry: Boolean) {
  //   if (!this.jobId) return;
  //   let positiveInc = Number(!retry); // if retry is false then the notification went through
  //   let negativeInc = Number(retry); // if retry is true, then notification failed from the server side

  //   // increment the job model notifications send by this value and the endtime
  //   const notif = await NotificationDetailsModel.findOneAndUpdate(
  //     { _id: this.jobId },
  //     {
  //       $inc: { notificationCount: positiveInc, failedNotificationCount: negativeInc },
  //       $set: { endDateTime: Date.now() },
  //     },
  //     { new: true },
  //   );
  //   this.logInfo(`logging Notification for ${this.cSettings.name} as ${JSON.stringify(notif)}`);
  // }

  // async logJobToDB() {
  //   const { name: channelName } = this.cSettings;
  //   try {
  //     const { channelAddress } = this;

  //     const newData = new NotificationDetailsModel({
  //       channelName,
  //       channelAddress,
  //     });

  //     const newJob = await newData.save();
  //     this.jobId = newJob._id;
  //     this.logInfo(`logging Job for ${this.cSettings.name}`);
  //   } catch (e) {
  //     this.logError('Failded to save Notification Deatils of ' + channelName);
  //   }
  // }

  getCAIPAddress(address: string) {
    try {
      let chainID = '1';
      if (this.cSettings?.isPolygon) {
        chainID = config.showrunnersEnv === 'staging' ? '8001' : '137';
      } else {
        chainID = config.showrunnersEnv === 'staging' ? '5' : '1';
      }
      const accountId = new AccountId({
        chainId: { namespace: 'eip155', reference: chainID.toString() },
        address,
      });
      return accountId.toString();
    } catch (e) {
      this.logError(e);
    }
  }

  async getChannelSubscribers() {
    try {
      const res = await EpnsAPI.channels._getSubscribers({
        channel: this.getCAIPAddress(this.channelAddress),
        env: config.showrunnersEnv,
      });
      return res;
    } catch (e) {
      this.logError(e);
    }
  }

  async getContract(address: string, abi) {
    try {
      const parsedNetwork = parseInt(this.cSettings.networkToMonitor)
        ? parseInt(this.cSettings.networkToMonitor)
        : this.cSettings.networkToMonitor;
      const provider = ethers.getDefaultProvider(parsedNetwork, {
        etherscan: config.etherscanAPI ? config.etherscanAPI : null,
        infura: config.infuraAPI
          ? { projectId: config.infuraAPI.projectID, projectSecret: config.infuraAPI.projectSecret }
          : null,
        alchemy: config.alchemyAPI ? config.alchemyAPI : null,
        quorum: 1,
      });
      const contract = new ethers.Contract(address, abi, provider);
      return {
        provider,
        contract,
      };
    } catch (e) {
      this.logError(e);
    }
  }

  async getInteractableContract(network: any, PK: any, address: string, abi: any) {
    try {
      const parsedNetwork = parseInt(network) ? parseInt(network) : network;
      const provider = ethers.getDefaultProvider(parsedNetwork, {
        etherscan: config.etherscanAPI ? config.etherscanAPI : null,
        infura: config.infuraAPI
          ? { projectId: config.infuraAPI.projectID, projectSecret: config.infuraAPI.projectSecret }
          : null,
        alchemy: config.alchemyAPI ? config.alchemyAPI : null,
        quorum: 1,
      });
      var contractWithSigner = null;
      const contract = new ethers.Contract(address, abi, provider);
      if (PK) {
        var wallet = new ethers.Wallet(PK, provider);
        contractWithSigner = contract.connect(wallet);
      }
      return {
        provider,
        contract,
        contractWithSigner,
      };
    } catch (e) {
      this.logError(e);
    }
  }
}
