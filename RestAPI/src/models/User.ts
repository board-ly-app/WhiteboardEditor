import {
  Schema,
  model,
  Types,
  type Document,
  type Model,
} from "mongoose";

import type {
  ViewDocument,
  DocumentViewMethods,
  DocumentVirtualBase,
} from './Model';

import type {
  AuthorizedRequestBody
} from './Auth';

export type UserIdType = Types.ObjectId;

export type UserTypeEnum = 
  | "permanent"
  | "temp"
;

// === IUser ========================================================================
//  
// Base user model containing fields shared by all user types in the system.
// 
// ==================================================================================
export interface IUserModel {
  kind: UserTypeEnum;
  username: string;
}

// === Base Data Transfer Objects ======================================

// -- User with id and other basic document info
export type IUserDocument = ViewDocument<IUserModel>;

// -- User, excluding sensitive fields
export type UserProtectedFields = "";
export type IUserPublicView = Omit<IUserDocument, UserProtectedFields>;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type IUserAttribView = IUserPublicView;

export type IUserVirtual = DocumentVirtualBase;

export type UserModelType = Model<IUserDocument, {}, {}, IUserVirtual>;

// -- User as a Mongo document
export type IUser = 
  & IUserDocument
  & DocumentViewMethods<IUser, IUserPublicView, IUserAttribView>
  & Document <Types.ObjectId>
;
// -- End IUser


// === IPermanentUser================================================================
// 
// Represents a registered user account with persistent identity and login credentials.
//
// ==================================================================================
export interface IPermanentUserModel extends IUserModel{
  email: string;

  // -- sensitive fields: ensure they are omitted from public-facing views
  passwordHashed: string;
}

// -- define protected fields for later omission from public view
type PermanentUserProtectedFields =
  | "passwordHashed"
;

// === Permanent Data Transfer Objects =========================================

// -- User with id and other basic document info
export type IPermanentUserDocument = ViewDocument<IPermanentUserModel>;

// -- User, excluding sensitive fields
export type IPermanentUserPublicView = Omit<IPermanentUserDocument, PermanentUserProtectedFields>;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type IPermanentUserAttribView = IPermanentUserPublicView;

export type IPermanentUserVirtual = DocumentVirtualBase;

export type PermanentUserModelType = Model<IPermanentUserDocument, {}, {}, IPermanentUserVirtual>;

// -- User as a Mongo document
export type IPermanentUser = 
  & IPermanentUserDocument
  & DocumentViewMethods<IPermanentUser, IPermanentUserPublicView, IPermanentUserAttribView>
  & Document <Types.ObjectId>
;
// -- End IPermanentUser


// === ITempUser=====================================================================
// 
// Represents a temporary guest user that expires after a limited session duration.
//
// ==================================================================================
export interface ITempUserModel extends IUserModel{
  tempExpiresAt: Date;
}

// === Temp Data Transfer Objects ======================================

// -- User with id and other basic document info
export type ITempUserDocument = ViewDocument<ITempUserModel>;

// -- User, excluding sensitive fields
export type TempUserProtectedFields = 
  | UserProtectedFields
;

export type ITempUserPublicView = Omit<ITempUserDocument, TempUserProtectedFields>;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type ITempUserAttribView = ITempUserPublicView;

export type ITempUserVirtual = DocumentVirtualBase;

export type TempUserModelType = Model<ITempUserDocument, {}, {}, ITempUserVirtual>;

// -- User as a Mongo document
export type ITempUser = 
  & ITempUserDocument
  & DocumentViewMethods<ITempUser, ITempUserPublicView, ITempUserAttribView>
  & Document <Types.ObjectId>
;
// -- End ITempUser


// === REST Request Body Definitions ===========================================
//
// Definitions for REST API request bodies.
//
// =============================================================================

// -- for POST
export interface CreatePermanentUserRequest extends IPermanentUserModel {
  password: string;
}

// -- for PATCH
export type PatchPermanentUserData = Partial<CreatePermanentUserRequest>;

// -- (must be authorized)
export type PatchPermanentUserRequest = AuthorizedRequestBody & PatchPermanentUserData;

// -- for PUT
export type PutPermanentUserData = IPermanentUserDocument;

export type PutPermanentUserRequest = AuthorizedRequestBody & PutPermanentUserData;

// -- for DELETE
export interface DeletePermanentUserData {
  // requires additional password confirmation
  id: Types.ObjectId;
  password: string;
}

export type DeletePermanentUserRequest = AuthorizedRequestBody & DeletePermanentUserData;

// === Data Transfer Mappings ==================================================
//
// Maps a full Permanent User model into various views (i.e. public, attrib)
//
// =============================================================================

const permanentUserToPublicView = (user: IPermanentUser): IPermanentUserPublicView => {
  const {
    _id,
    passwordHashed,
    ...out
  } = user;

  return out;
};// -- end permanentUserToPublicView

// -- identical to toPublicView, in this case
const permanentUserToAttribView = permanentUserToPublicView;

// === Data Transfer Mappings ==================================================
//
// Maps a temporary User model into various views (i.e. public, attrib)
//
// =============================================================================

const tempUserToPublicView = (user: ITempUser): ITempUserPublicView => {
  const {
    _id,
    ...out
  } = user;
  
  return out; // Just return original user, nothing to hide
};// -- end tempUserToPublicView

// -- identical to toPublicView, in this case
const tempUserToAttribView = tempUserToPublicView;

// === userSchema ==============================================================
//
// Defines how user objects are stored/interacted with.
//
// =============================================================================
const userSchema = new Schema<IUser, UserModelType, {}, {}, IUserVirtual>(
  // -- fields
  {
    kind: { type: String, enum: ['permanent', 'temp'], required: true },
    username: { type: String, required: true, unique: true },
  },
  {
    // -- options
    discriminatorKey: 'kind',
    // --- do not commit data not defined in schema
    strict: true,
    // --- do not omit empty fields
    minimize: false,

    // -- data transformation
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  }
);// -- end userSchema

// Define the user schema index to have a unique email for permanent users only
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: "permanent",
      email: { $exists: true }
    }
  }
);

// === permanentUserSchema ==============================================================
//
// Defines how permanent user objects are stored/interacted with.
//
// =============================================================================
userSchema.discriminator(
  'permanent', new Schema<IPermanentUser, PermanentUserModelType, {}, {}, IPermanentUserVirtual>
  (
  // -- fields
  {
    email:    { type: String, required: false },
    passwordHashed: { type: String, required: false },
  },
  {
    toJSON: {
      transform: (_, ret: Partial<IPermanentUserDocument>): IPermanentUserPublicView => {
        delete ret.passwordHashed;

        return ret as IPermanentUserPublicView;
      }
    },
    // -- instance methods
    methods: {
      // -- Data transfer mappings
      async populateAttribs(): Promise<IPermanentUser> {
        // nothing to populate
        return this;
      },
      async populateFull(): Promise<IPermanentUser> {
        // nothing to populate
        return this;
      },
      toPublicView(): IPermanentUserPublicView {
        return permanentUserToPublicView(this.toObject({ virtuals: true }));
      },// -- end toPublicView
      toAttribView(): IPermanentUserAttribView {
        return permanentUserToAttribView(this.toObject({ virtuals: true }));
      }// -- end toAttribView
    },
  },
));

// === tempUserSchema ==============================================================
//
// Defines how temporary user objects are stored/interacted with.
//
// =============================================================================
userSchema.discriminator(
  'temp', new Schema<ITempUser, TempUserModelType, {}, {}, ITempUserVirtual>
  (
  // -- fields
  {
    tempExpiresAt: { type: Date, required: true },
  },
  {
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
      transform: (_, ret: Partial<ITempUser>) => {
        delete ret._id;

        return ret as ITempUserPublicView;
      }
    },
    // -- instance methods
    methods: {
      // -- Data transfer mappings
      async populateAttribs(): Promise<ITempUser> {
        // nothing to populate
        return this;
      },
      async populateFull(): Promise<ITempUser> {
        // nothing to populate
        return this;
      },
      toPublicView(): ITempUserPublicView {
        return tempUserToPublicView(this.toObject({ virtuals: true }));
      },// -- end toPublicView
      toAttribView(): ITempUserAttribView {
        return tempUserToAttribView(this.toObject({ virtuals: true }));
      }// -- end toAttribView
    },
  }
));

userSchema.virtual('id').get(function() {
  return this._id;
});

// -- User Model
export const User = model<IUser>("User", userSchema, "users");

export type IUserType = 
  | IPermanentUser
  | ITempUser
;

export const isIPermanentUser = (user: IUserType): user is IPermanentUser => {
  return user.kind === 'permanent';
}

export const isITempUser = (user: IUserType): user is ITempUser => {
  return user.kind === 'temp';
}