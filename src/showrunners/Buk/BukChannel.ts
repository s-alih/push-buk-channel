import { Inject, Service } from 'typedi';
import { add, Logger } from 'winston';
import config from '../../config';
import bukSettings from './Buksettings.json';
import bukABI from './BukABI.json';
import bukMarketABI from './BukMarketABI.json';
import { EPNSChannel } from '../../helpers/epnschannel';
import { IBukSchema, IUserBookSchema, BukModel, UserBookModel } from './BukModel';
import axios from 'axios';

@Service()
export default class BukChannel extends EPNSChannel {
  constructor(@Inject('logger') public logger: Logger, @Inject('cached') public cached) {
    super(logger, {
      networkToMonitor: config.web3PolygonMumbaiProvider,
      dirname: __dirname,
      name: 'Buk',
      url: 'https://buk.vercel.app/',
      useOffChain: true,
    });
  }

  BUK_CONTRACT_ADDRESS = bukSettings.bukContractAddress;
  BUK_MARKET_CONTRACT_ADDRESS = bukSettings.bukMarketContractAddress;

  async sendBookingNotifications(simulate) {
    this.logInfo(`send booking alert`);

    // getting subscribers to the channel

    const subscribers = simulate.logicOverride.mode
      ? simulate.logicOverride.subscriber
      : await this.getChannelSubscribers();

    const buk = await this.getContract(this.BUK_CONTRACT_ADDRESS, JSON.stringify(bukABI));

    const bookFilter = buk.contract.filters.Booked();

    const blockNos = await this.getBlockNumbers(simulate, buk.contract, 1);
    let fromBlock = blockNos.fromBlock;
    let toBlock = blockNos.toBlock;

    if (fromBlock == 'latest') {
      this.logInfo(`From Block is the latest running for first time... Aborting`);
      await this.setBukDataintoDB({ bookedBlock: toBlock });
      return;
    }

    this.logInfo(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);

    // fetching booking events
    const bookEvents = await buk.contract.queryFilter(bookFilter, fromBlock, toBlock);
    // booking events fetched

    this.logInfo(` No Of evts : ${bookEvents.length}`);
    for (const evt of bookEvents) {
      try {
        let { args } = evt;

        const message = `Hotel booking is Successful`;
        const payloadMsg = `Your hotel booking through Buk is successful`;

        this.logInfo(payloadMsg);
        console.log('Booked user', args.user);
        console.log('subscribers', subscribers);
        console.log(subscribers.indexOf(args.user) > -1);

        if (subscribers.includes(args.user.toLowerCase())) {
          console.log('condition satisfied');
          await this.sendNotification({
            recipient: simulate.txOverride.mode ? this.channelAddress : args.user.toLowerCase(),
            image: null,
            message: payloadMsg,
            payloadMsg: payloadMsg,
            title: message,
            notificationType: 3,
            payloadTitle: message,
            simulate: simulate,
            cta: 'https://buk.vercel.app/',
          });
        }
        const BookingDetails = await buk.contract.bookingDetails(evt.args.nftId);
        // storing user booking information to db
        let userBookData = new UserBookModel({
          address: evt.args.user.toLowerCase(),
          isSold: false,
          checkInTime: BookingDetails.time,
          _id: evt.args.nftId,
        });
        await this.setUserBookDataInToDB(userBookData);
      } catch (error) {
        this.logError(error);
      }
    }
    await this.setBukDataintoDB({ bookedBlock: toBlock });
  }

  async sendPrecheckInReminder(simulate) {
    this.logInfo(`send precheck in alert`);

    // getting subscribers to the channel
    const subscribers = simulate.logicOverride.mode
      ? simulate.logicOverride.subscriber
      : await this.getChannelSubscribers();
    console.log(subscribers);
    const buk = await this.getContract(this.BUK_CONTRACT_ADDRESS, JSON.stringify(bukABI));

    let checkInWindow = await buk.contract.checkInTime();

    // get all stored user bookings
    let usersBooking = await this.getAllUserBookDataFromDB();

    for (let user of usersBooking) {
      try {
        let { checkInTime } = user;
        console.log('check in time', checkInTime);
        console.log('current time', this.timestamp);
        let subscriber = user.address;
        console.log('minter', user);

        let owners = await this.getOwnerOfNFT(user.id);
        console.log('NFT users', owners);

        if (this.timestamp < checkInTime - checkInWindow) {
          for (let owner of owners) {
            console.log('owner', owner);
            if (subscribers.includes(owner)) {
              console.log('condition satisfied');
              const message = `Check in remainder`;
              const payloadMsg = `Check in window is open for your hotel booking, please check in!`;

              await this.sendNotification({
                recipient: simulate.txOverride.mode ? this.channelAddress : owner,
                image: null,
                message: payloadMsg,
                payloadMsg: payloadMsg,
                title: message,
                notificationType: 3,
                payloadTitle: message,
                simulate: simulate,
                cta: 'https://buk.vercel.app/',
              });
            }
          }
          // can delete the user data from db no meaning to store after all the use
          await this.deleteUserDataFromDB(user.id);
        }
      } catch (error) {
        console.log(error.message);
      }
    }
  }

  async sendCancelBookingNotification(simulate) {
    this.logInfo(`send cancel booking alert`);

    // getting subscribers to the channel

    const subscribers = simulate.logicOverride.mode
      ? simulate.logicOverride?.subscriber
      : await this.getChannelSubscribers();

    const buk = await this.getContract(this.BUK_CONTRACT_ADDRESS, JSON.stringify(bukABI));

    const bookFilter = buk.contract.filters.BookingCancelled();

    const blockNos = await this.getBlockNumbers(simulate, buk.contract, 2);
    let fromBlock = blockNos.fromBlock;
    let toBlock = blockNos.toBlock;

    if (fromBlock == 'latest') {
      this.logInfo(`From Block is the latest running for first time... Aborting`);
      await this.setBukDataintoDB({ bookingCancelledBlock: toBlock });
      return;
    }

    this.logInfo(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);

    // fetching booking cancelation events
    const bookCancelEvents = await buk.contract.queryFilter(bookFilter, fromBlock, toBlock);
    // booking cancelations events fetched

    this.logInfo(` No Of evts : ${bookCancelEvents.length}`);
    for (const evt of bookCancelEvents) {
      try {
        let { args } = evt;

        const message = `Cancelation alert!`;
        const payloadMsg = `Successfully canceled your hotel booking`;

        this.logInfo(payloadMsg);
        console.log('Booked user', args.user);
        console.log('subscribers', subscribers);
        console.log(subscribers.indexOf(args.user) > -1);

        if (subscribers.includes(args.user.toLowerCase())) {
          console.log('condition satisfied');
          await this.sendNotification({
            recipient: simulate?.txOverride?.mode ? this.channelAddress : args.user.toLowerCase(),
            image: null,
            message: payloadMsg,
            payloadMsg: payloadMsg,
            title: message,
            notificationType: 3,
            payloadTitle: message,
            simulate: simulate,
            cta: 'https://buk.vercel.app/',
          });
        }
        // delete user data form db
        await this.deleteUserDataFromDB(args.id);
      } catch (error) {
        this.logError(error);
      }
    }
    await this.setBukDataintoDB({ bookingCancelledBlock: toBlock });
  }

  async sendListingNotifs(simulate) {
    this.logInfo(`send listing notification`);

    // getting subscribers to the channel
    const subscribers = simulate?.logicOverride?.mode
      ? simulate.logicOverride.subscriber
      : await this.getChannelSubscribers();

    const bukMarket = await this.getContract(this.BUK_MARKET_CONTRACT_ADDRESS, JSON.stringify(bukMarketABI));

    const bookFilter = bukMarket.contract.filters.saleCreated();

    const blockNos = await this.getBlockNumbers(simulate, bukMarket.contract, 3);
    let fromBlock = blockNos.fromBlock;
    let toBlock = blockNos.toBlock;

    if (fromBlock == 'latest') {
      this.logInfo(`From Block is the latest running for first time... Aborting`);
      await this.setBukDataintoDB({ saleCreatedBlock: toBlock });
      return;
    }

    this.logInfo(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);

    // fetching new sales events
    const newListingEvents = await bukMarket.contract.queryFilter(bookFilter, fromBlock, toBlock);

    this.logInfo(` No Of evts : ${newListingEvents.length}`);
    for (const evt of newListingEvents) {
      try {
        let { args } = evt;

        const message = `Listing is successful `;
        const payloadMsg = `Listing of hotel booking to market is successfull`;

        this.logInfo(payloadMsg);
        console.log('Booked user', args.seller);
        console.log('subscribers', subscribers);
        if (subscribers.includes(args.seller.toLowerCase())) {
          console.log('condition satisfied');
          await this.sendNotification({
            recipient: simulate.txOverride.mode ? this.channelAddress : args.seller.toLowerCase(),
            image: null,
            message: payloadMsg,
            payloadMsg: payloadMsg,
            title: message,
            notificationType: 3,
            payloadTitle: message,
            simulate: simulate,
            cta: 'https://buk.vercel.app/',
          });
        }
      } catch (error) {
        this.logError(error);
      }
    }
    await this.setBukDataintoDB({ saleCreatedBlock: toBlock });
  }

  async sendCheckoutNotifs(simulate) {
    this.logInfo(`send checkout notification`);

    // getting subscribers to the channel
    const subscribers = simulate.logicOverride.mode
      ? simulate.logicOverride.subscriber
      : await this.getChannelSubscribers();

    const buk = await this.getContract(this.BUK_CONTRACT_ADDRESS, JSON.stringify(bukABI));

    const bookFilter = buk.contract.filters.CheckedOut();

    const blockNos = await this.getBlockNumbers(simulate, buk.contract, 5);
    let fromBlock = blockNos.fromBlock;
    let toBlock = blockNos.toBlock;

    if (fromBlock == 'latest') {
      this.logInfo(`From Block is the latest running for first time... Aborting`);
      await this.setBukDataintoDB({ checkedOutBlock: toBlock });
      return;
    }

    this.logInfo(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);

    // fetching all checkout events
    const checkoutEvents = await buk.contract.queryFilter(bookFilter, fromBlock, toBlock);

    this.logInfo(` No Of evts : ${checkoutEvents.length}`);
    for (const evt of checkoutEvents) {
      try {
        let { args } = evt;

        const message = `Thank you for your stay!`;
        const payloadMsg = `Thank your for your stay. See you soon!`;

        this.logInfo(payloadMsg);
        console.log('Booked user', args.user);
        console.log('subscribers', subscribers);

        if (subscribers.includes(args.user.toLowerCase())) {
          console.log('condition satisfied');
          await this.sendNotification({
            recipient: simulate.txOverride.mode ? this.channelAddress : args.user.toLowerCase(),
            image: null,
            message: payloadMsg,
            payloadMsg: payloadMsg,
            title: message,
            notificationType: 3,
            payloadTitle: message,
            simulate: simulate,
            cta: 'https://buk.vercel.app/',
          });
        }
      } catch (error) {
        this.logError(error);
      }
    }
    await this.setBukDataintoDB({ checkedOutBlock: toBlock });
  }

  async sendListingSoldNotifs(simulate) {
    this.logInfo(`send listing sold notification`);

    // getting subscribers to the channel
    const subscribers = simulate.logicOverride.mode
      ? simulate.logicOverride.subscriber
      : await this.getChannelSubscribers();

    const bukMarket = await this.getContract(this.BUK_MARKET_CONTRACT_ADDRESS, JSON.stringify(bukMarketABI));

    const bookFilter = bukMarket.contract.filters.ItemBought();

    const blockNos = await this.getBlockNumbers(simulate, bukMarket.contract, 4);
    let fromBlock = blockNos.fromBlock;
    let toBlock = blockNos.toBlock;

    if (fromBlock == 'latest') {
      this.logInfo(`From Block is the latest running for first time... Aborting`);
      await this.setBukDataintoDB({ itemBoughtBlock: toBlock });
      return;
    }

    this.logInfo(`fromBlock: ${fromBlock}, toBlock: ${toBlock}`);

    this.logInfo('fetching item bought events');
    const itemBoughtEvents = await bukMarket.contract.queryFilter(bookFilter, fromBlock, toBlock);
    this.logInfo('Item bought events fetched sucessfully');

    this.logInfo(` No Of evts : ${itemBoughtEvents.length}`);
    for (const evt of itemBoughtEvents) {
      try {
        let { args } = evt;
        let tokenId = args.tokenId;
        let userData = await this.getUserBookDataFromDB(tokenId);
        console.log('userData', userData);
        if (!userData.isSold) {
          const message = `Your listing sold successfully!`;
          const payloadMsg = `Your hotel booking nft is sold successfully`;

          this.logInfo(payloadMsg);
          console.log('Booked user', userData.address);
          console.log('subscribers', subscribers);
          console.log(subscribers.indexOf(userData.address) > -1);

          if (subscribers.includes(userData.address)) {
            console.log('condition satisfied');
            await this.sendNotification({
              recipient: simulate.txOverride.mode ? this.channelAddress : userData.address,
              image: null,
              message: payloadMsg,
              payloadMsg: payloadMsg,
              title: message,
              notificationType: 3,
              payloadTitle: message,
              simulate: simulate,
              cta: 'https://buk.vercel.app/',
            });
          }
          userData.isSold = true;
          await this.setUserBookDataInToDB(userData);
        }
      } catch (error) {
        this.logError(error);
      }
    }
    await this.setBukDataintoDB({ itemBoughtBlock: toBlock });
  }

  // Get owner of the nft
  async getOwnerOfNFT(tokenId) {
    let chain = 'matic-testnet';
    let address = this.BUK_CONTRACT_ADDRESS;
    let query = `auth_key=q4L6DlxJwM5dETCKQpTu58esyUHyiUV7257b9Ubz&tokenId=${tokenId}`;
    let url = `https://api.unmarshal.com/v1/${chain}/address/${address}/nftholders?${query}`;

    let response = await axios.get(url);
    return response.data;
  }

  async getBlockNumbers(simulate, contract, option) {
    this.logInfo(`Getting Block Numbers option: ${option}`);
    const bukData = await this.getBukDataFromDB();
    let blockFromDB;
    switch (option) {
      case 1:
        blockFromDB = bukData?.bookedBlock;
      case 2:
        blockFromDB = bukData?.bookingCancelledBlock;
      case 3:
        blockFromDB = bukData?.saleCreatedBlock;
      case 4:
        blockFromDB = bukData?.itemBoughtBlock;
      case 5:
        blockFromDB = bukData?.checkedOutBlock;
    }

    let fromBlock = simulate?.logicOverride?.mode ? simulate?.logicOverride?.fromBlock : blockFromDB ?? 'latest';

    let toBlock = simulate?.logicOverride?.mode
      ? simulate?.logicOverride?.toBlock
      : await contract.provider.getBlockNumber();

    const result = {
      fromBlock: fromBlock,
      toBlock: toBlock,
    };
    return result;
  }

  // Get BUK from DB
  async getBukDataFromDB() {
    this.logInfo(`Getting Buk Data from DB..`);
    const doc = await BukModel.findOne({ _id: 'BUK_DATA' });
    this.logInfo(`Buk Data obtained`);
    this.log(doc);
    return doc;
  }
  // Set Buk Data in DB
  async setBukDataintoDB(bukData: IBukSchema) {
    this.logInfo(`Setting Buk Data In DB`);
    this.log(bukData);
    await BukModel.findOneAndUpdate({ _id: 'BUK_DATA' }, bukData, { upsert: true });
  }

  // Get USER BUK from DB
  async getUserBookDataFromDB(id: string) {
    this.logInfo(`Getting user Data from DB..`);
    const doc = await UserBookModel.findOne({ _id: id });
    this.logInfo(`user Data obtained`);
    this.log(doc);
    return doc;
  }

  // Delete USER BUK from DB
  async deleteUserDataFromDB(id: string) {
    this.logInfo(`Deleting user data from db`);
    const doc = await UserBookModel.findOneAndDelete({ _id: id });
    this.logInfo(`user Data deleted successfully`);
    this.log(doc);
    return doc;
  }

  // Get BUK from DB
  async getAllUserBookDataFromDB() {
    this.logInfo(`Getting all user data from DB`);
    const doc = await UserBookModel.find();
    this.logInfo(`all user data is obtained`);
    this.log(doc);
    return doc;
  }

  // Set Buk Data in DB
  async setUserBookDataInToDB(userBookData: IUserBookSchema) {
    this.logInfo(`Setting User Data In DB`);
    this.log(userBookData);
    await UserBookModel.findOneAndUpdate({ _id: userBookData._id }, userBookData, { upsert: true });
  }
}
