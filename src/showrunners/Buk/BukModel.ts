import { model, Schema, Document } from 'mongoose';

export interface IUserBookSchema {
  _id: string;
  address?: string;
  checkInTime: number;
  isSold?: boolean;
}
export interface IBukSchema {
  user?: string;
  bookedBlock?: Number;
  bookingCancelledBlock?: Number;
  saleCreatedBlock?: Number;
  itemBoughtBlock?: Number;
  checkedOutBlock?: Number;
}

const UserBookDB = new Schema<IUserBookSchema>({
  _id: {
    type: String,
  },
  address: {
    type: String,
  },
  checkInTime: {
    type: Number,
  },
  isSold: {
    type: Boolean,
  },
});

const BukDB = new Schema<IBukSchema>({
  _id: {
    type: String,
  },
  bookedBlock: {
    type: Number,
  },
  bookingCancelledBlock: {
    type: Number,
  },
  saleCreatedBlock: {
    type: Number,
  },
  itemBoughtBlock: {
    type: Number,
  },
  checkedOutBlock: {
    type: Number,
  },
});

export const UserBookModel = model<IUserBookSchema>('UserBookDB', UserBookDB);
export const BukModel = model<IBukSchema>('BukDB', BukDB);
