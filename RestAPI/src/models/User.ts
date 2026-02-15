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

// -- Start IUser
export interface IUserModel {
  kind: UserTypeEnum;
  username: string;
}

// === Data Transfer Objects ===================================================
//
// =============================================================================

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

// -- Start IPermanentUser
export interface IPermanentUserModel extends IUserModel{
  email: string;

  // -- sensitive fields: ensure they are omitted from public-facing views
  passwordHashed: string;
}

// -- define protected fields for later omission from public view
type PermanentUserProtectedFields =
  | "passwordHashed"
;

// === Data Transfer Objects ===================================================
//
// =============================================================================

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

    // -- instance methods
    methods: {
      // -- Data transfer mappings
      async populateAttribs(): Promise<IUser> {
        // nothing to populate
        return this;
      },
      async populateFull(): Promise<IUser> {
        // nothing to populate
        return this;
      },
      // toPublicView(): IUserPublicView {
      //   return toPublicView(this.toObject({ virtuals: true }));
      // },// -- end toPublicView
      // toAttribView(): IUserAttribView {
      //   return toAttribView(this.toObject({ virtuals: true }));
      // }// -- end toAttribView
    }
  }
);// -- end userSchema

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
    email:    { type: String, required: false, unique: true },
    passwordHashed: { type: String, required: false },
  },
  {
    toJSON: {
      transform: (_, ret: Partial<IPermanentUserDocument>): IPermanentUserPublicView => {
        delete ret.passwordHashed;

        return ret as IPermanentUserPublicView;
      }
    },
  }
));

userSchema.virtual('id').get(function() {
  return this._id;
});

// -- User Model
export const User = model<IUser>("User", userSchema, "users");
