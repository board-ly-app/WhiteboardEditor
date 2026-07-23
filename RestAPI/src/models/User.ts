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

export type UserIdType = Types.ObjectId;

export type UserTypeEnum = 
  | "permanent"
  | "temp"
;

if (! process.env.TEMP_USER_EXPIRATION_SECS) {
  throw new Error('TEMP_USER_EXPIRATION_SECS not set in environment');
}

const TEMP_USER_EXPIRATION_SECS = parseInt(process.env.TEMP_USER_EXPIRATION_SECS);

// === IUser ========================================================================
//  
// Base user model containing fields shared by all user types in the system.
// 
// ==================================================================================
export interface IUserModel {
  username: string;
  kind: UserTypeEnum;
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
  kind: 'permanent';
  email: string;

  // -- sensitive fields: ensure they are omitted from public-facing views
  passwordHashed: string;
}

// -- define protected fields for later omission from protected views
type PermanentUserProtectedFields =
  | UserProtectedFields
  | "passwordHashed"
;

// -- define fields restricted from the general public (i.e. non-whiteboard
// owners)
type PermanentUserPublicRestrictedFields =
  | PermanentUserProtectedFields
  | "email"
;

// === Permanent Data Transfer Objects =========================================

// -- User with id and other basic document info
export type IPermanentUserDocument = ViewDocument<IPermanentUserModel>;

// -- User, excluding sensitive fields
export type IPermanentUserPublicView = Omit<IPermanentUserDocument, PermanentUserPublicRestrictedFields>;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type IPermanentUserAttribView = IPermanentUserPublicView;

// -- Projection intended for a user to view their own account.
// Includes all but the most sensitive fields (i.e. the hashed password)
export type IPermanentUserSelfView = Omit<IPermanentUserDocument, PermanentUserProtectedFields>;

// -- Projection that includes fields only visible to whiteboard owners who have
// shared a whiteboard with the user (namely, their email address).
export type IPermanentUserWBOwnerView = Omit<IPermanentUserDocument, PermanentUserProtectedFields>;

export type IPermanentUserVirtual = DocumentVirtualBase;

export type PermanentUserModelType = Model<IPermanentUserDocument, {}, {}, IPermanentUserVirtual>;

// -- User as a Mongo document
export type IPermanentUser = 
  & IPermanentUserDocument
  & DocumentViewMethods<IPermanentUser, IPermanentUserPublicView, IPermanentUserAttribView>
  & {
    toSelfView: () => IPermanentUserSelfView;
    toWBOwnerView: () => IPermanentUserWBOwnerView;
  }
  & Document <Types.ObjectId>
;
// -- End IPermanentUser


// === ITempUser=====================================================================
// 
// Represents a temporary guest user that expires after a limited session duration.
//
// ==================================================================================
export interface ITempUserModel extends IUserModel{
  kind: 'temp';
  createdAt: Date;
}

// === Temp Data Transfer Objects ======================================

// -- User with id and other basic document info
export type ITempUserDocument = ViewDocument<ITempUserModel>;

// -- User, excluding sensitive fields
type TempUserProtectedFields =
  | UserProtectedFields
;

// -- define fields restricted from the general public (i.e. non-whiteboard
// owners)
type TempUserPublicRestrictedFields =
  | TempUserProtectedFields
;

export type ITempUserPublicView = Omit<ITempUserDocument, TempUserPublicRestrictedFields>;

// -- Public view, excluding vector attributes
// -- In this case, there are no vector attributes
export type ITempUserAttribView = ITempUserPublicView;

// -- Projection intended for a user to view their own account.
// Includes all but the most sensitive fields (i.e. the hashed password)
export type ITempUserSelfView = Omit<ITempUserDocument, TempUserProtectedFields>;

export type ITempUserWBOwnerView = Omit<ITempUserDocument, TempUserProtectedFields>;

export type ITempUserVirtual = DocumentVirtualBase;

export type TempUserModelType = Model<ITempUserDocument, {}, {}, ITempUserVirtual>;

// -- User as a Mongo document
export type ITempUser = 
  & ITempUserDocument
  & DocumentViewMethods<ITempUser, ITempUserPublicView, ITempUserAttribView>
  & {
    toSelfView: () => ITempUserSelfView;
    toWBOwnerView: () => ITempUserWBOwnerView;
  }
  & Document <Types.ObjectId>
;
// -- End ITempUser

export type IUserType = 
  | IPermanentUser
  | ITempUser
;

export type IUserTypePublicView =
  | IPermanentUserPublicView
  | ITempUserPublicView
;

export type IUserTypeAttribView =
  | IPermanentUserAttribView
  | ITempUserAttribView
;

export type IUserTypeWBOwnerView =
  | IPermanentUserWBOwnerView
  | ITempUserWBOwnerView
;

// === REST Request Body Definitions ===========================================
//
// Definitions for REST API request bodies.
//
// =============================================================================

// -- for POST
export interface CreatePermanentUserRequest extends IPermanentUserModel {
  password: string;
}

export interface ConvertTempUserRequest extends IPermanentUserModel {
  password: string;
}

// -- for PATCH
export type PatchPermanentUserData = Partial<CreatePermanentUserRequest>;

// -- (must be authorized)
export type PatchPermanentUserRequest = PatchPermanentUserData;

// -- for PUT
export type PutPermanentUserData = IPermanentUserDocument;

export type PutPermanentUserRequest = PutPermanentUserData;

// -- for DELETE
export interface DeletePermanentUserData {
  // requires additional password confirmation
  password?: string;
}

export type DeletePermanentUserRequest = DeletePermanentUserData;

// === Data Transfer Mappings ==================================================
//
// Maps a full Permanent User model into various views (i.e. public, attrib)
//
// =============================================================================

const permanentUserToPublicView = (user: IPermanentUser): IPermanentUserPublicView => {
  const {
    _id,
    passwordHashed: _passwordHashed,
    email: _email,
    ...out
  } = user;

  return out;
};// -- end permanentUserToPublicView

// -- identical to toPublicView, in this case
const permanentUserToAttribView = permanentUserToPublicView;

const permanentUserToSelfView = (user: IPermanentUser): IPermanentUserSelfView => {
  const {
    _id,
    passwordHashed: _passwordHashed,
    ...out
  } = user;

  return out;
};// -- end permanentUserToSelfView

const permanentUserToWBOwnerView = (user: IPermanentUser): IPermanentUserWBOwnerView => {
  const {
    _id,
    passwordHashed: _passwordHashed,
    ...out
  } = user;

  return out;
};// -- end permanentUserToWBOwnerView

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

// -- identical to toPublicView, in this case
const tempUserToSelfView = tempUserToPublicView;

// -- identical to toPublicView, in this case
const tempUserToWBOwnerView = tempUserToPublicView;

// === userSchema ==============================================================
//
// Defines how user objects are stored/interacted with.
//
// =============================================================================
const userSchema = new Schema<IUserType, UserModelType, {}, {}, IUserVirtual>(
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
      },// -- end toAttribView
      toSelfView(): IPermanentUserSelfView {
        return permanentUserToSelfView(this.toObject({ virtuals: true }));
      },// -- end toSelfView
      toWBOwnerView(): IPermanentUserWBOwnerView {
        return permanentUserToWBOwnerView(this.toObject({ virtuals: true }));
      },// -- end toWBOwnerView
    },
  },
));

// === tempUserSchema ==============================================================
//
// Defines how temporary user objects are stored/interacted with.
//
// =============================================================================
const tempUserSchema = new Schema<ITempUser, TempUserModelType, {}, {}, ITempUserVirtual>(
  // -- fields
  {
    createdAt: {
      type: Date,
      expires: TEMP_USER_EXPIRATION_SECS,
    },
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
      },// -- end toAttribView
      toSelfView(): ITempUserSelfView {
        return tempUserToSelfView(this.toObject({ virtuals: true }));
      },// -- end toSelfView
      toWBOwnerView(): ITempUserWBOwnerView {
        return tempUserToWBOwnerView(this.toObject({ virtuals: true }));
      },// -- end toWBOwnerView
    },
  }
);// -- end tempUserSchema

userSchema.discriminator('temp', tempUserSchema);

userSchema.virtual('id').get(function() {
  return this._id;
});

// -- User Model
export const User = model<IUserType>("User", userSchema, "users");

export const isIPermanentUser = (user: IUserType): user is IPermanentUser => {
  return user.kind === 'permanent';
}

export const isITempUser = (user: IUserType): user is ITempUser => {
  return user.kind === 'temp';
}
