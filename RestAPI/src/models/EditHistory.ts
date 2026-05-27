// === EditHistory.ts ==========================================================
//
// Events storing the edit history of a whiteboard.
//
// Each edit history event contains
//  - The author, as a user id reference
//  - The whiteboard, as a whiteboard id reference
//  - A timestamp
//
// The API currently does not expore the edit history to users. Manipulating
// edit history takes place solely via the web socket server.
//
// =============================================================================

import {
  Schema,
  Types,
  type Document,
  type Model,
} from "mongoose";

import type {
  DocumentVirtualBase,
  DocumentViewMethods,
  ViewDocument,
} from './Model';

import {
  type IUserPublicView,
  type IUserAttribView,
} from './User';

import {
  type ICanvasDocument,
  type IShapeDocument,
  canvasSchema,
  shapeSchema,
} from './Whiteboard';

export type EditKindEnum = 
  | 'create_shapes'
  | 'update_shapes'
  | 'delete_shapes'
  | 'create_canvas'
  | 'delete_canvas'
  | 'merge_canvas'
;

export const EDIT_KIND_ENUM = [
  'create_shapes',
  'update_shapes',
  'delete_shapes',
  'create_canvas',
  'delete_canvas',
  'merge_canvas',
];

interface IEditModel <UserType> {
  kind: EditKindEnum;
  author: UserType;
  whiteboard: Types.ObjectId;
  committedAt: Date;
}

export type IEditDocument <UserType> = ViewDocument<IEditModel <UserType>>;

export type EditProtectedFields = "";
export type IEditPublicView = Omit<IEditDocument <IUserPublicView>, EditProtectedFields>;
// -- Attrib view is identical to public view, as there are no vector types
export type IEditAttribView = Omit<IEditDocument <IUserAttribView>, EditProtectedFields>;

export type IEditVirtual = DocumentVirtualBase;

export type EditModelType <UserType> = Model<IEditDocument <UserType>, {}, {}, IEditVirtual>;

export type IEdit <UserType> =
  & IEditDocument <UserType>
  & DocumentViewMethods<IEdit <UserType>, IEditPublicView, IEditAttribView>
  & Document <Types.ObjectId>
;

export interface ICreateShapesEditModel <UserType> extends IEditModel <UserType> {
  kind: 'create_shapes';
  shapes: IShapeDocument[];
}

export type ICreateShapesEditDocument <UserType> = ViewDocument<ICreateShapesEditModel <UserType>>;

type CreateShapesEditProtectedFields = "";

export type ICreateShapesEditPublicView = Omit<
  ICreateShapesEditDocument <IUserPublicView>, CreateShapesEditProtectedFields
>;

export type ICreateShapesEditAttribView = Omit<
  ICreateShapesEditDocument <IUserAttribView>, CreateShapesEditProtectedFields
>;

export type ICreateShapesEdit <UserType> =
  & ICreateShapesEditDocument <UserType>
  & DocumentViewMethods<
    ICreateShapesEdit <UserType>, ICreateShapesEditPublicView, ICreateShapesEditAttribView
  >
  & Document <Types.ObjectId>
;

export type CreateShapesEditModelType = Model<
  ICreateShapesEditDocument <Types.ObjectId>, {}, {}, IEditVirtual
>;

interface ShapeUpdate {
  shapeId: Types.ObjectId;
  oldFields: Record<string, any>;
  newFields: Record<string, any>;
}

export interface IUpdateShapesEditModel <UserType> extends IEditModel <UserType> {
  kind: 'update_shapes';
  updates: ShapeUpdate[];
}

export type IUpdateShapesEditDocument <UserType> = ViewDocument<IUpdateShapesEditModel <UserType>>;

type UpdateShapesEditProtectedFields = "";

export type IUpdateShapesEditPublicView = Omit<
  IUpdateShapesEditDocument <IUserPublicView>, UpdateShapesEditProtectedFields
>;

export type IUpdateShapesEditAttribView = Omit<
  IUpdateShapesEditDocument <IUserAttribView>, UpdateShapesEditProtectedFields
>;

export type IUpdateShapesEdit <UserType> =
  & IUpdateShapesEditDocument <UserType>
  & DocumentViewMethods<
    IUpdateShapesEdit <UserType>, IUpdateShapesEditPublicView, IUpdateShapesEditAttribView
  >
  & Document <Types.ObjectId>
;

export type UpdateShapesEditModelType = Model<
  IUpdateShapesEditDocument <Types.ObjectId>, {}, {}, IEditVirtual
>;

export interface IDeleteShapesEditModel <UserType> extends IEditModel <UserType> {
  kind: 'delete_shapes';
  shapes: IShapeDocument[];
}

export type IDeleteShapesEditDocument <UserType> = ViewDocument<IDeleteShapesEditModel <UserType>>;

type DeleteShapesEditProtectedFields = "";

export type IDeleteShapesEditPublicView = Omit<
  IDeleteShapesEditDocument <IUserPublicView>, DeleteShapesEditProtectedFields
>;

export type IDeleteShapesEditAttribView = Omit<
  IDeleteShapesEditDocument <IUserAttribView>, DeleteShapesEditProtectedFields
>;

export type IDeleteShapesEdit <UserType> =
  & IDeleteShapesEditDocument <UserType>
  & DocumentViewMethods<
    IDeleteShapesEdit <UserType>, IDeleteShapesEditPublicView, IDeleteShapesEditAttribView
  >
  & Document <Types.ObjectId>
;

export type DeleteShapesEditModelType = Model<
  IDeleteShapesEditDocument <Types.ObjectId>, {}, {}, IEditVirtual
>;

export interface ICreateCanvasEditModel <UserType> extends IEditModel <UserType> {
  kind: 'create_canvas';
  canvas: ICanvasDocument <UserType>;
}

export type ICreateCanvasEditDocument <UserType> = ViewDocument<ICreateCanvasEditModel <UserType>>;

type CreateCanvasEditProtectedFields = "";

export type ICreateCanvasEditPublicView = Omit<
  ICreateCanvasEditDocument <IUserPublicView>, CreateCanvasEditProtectedFields
>;

export type ICreateCanvasEditAttribView = Omit<
  ICreateCanvasEditDocument <IUserAttribView>, CreateCanvasEditProtectedFields
>;

export type ICreateCanvasEdit <UserType> =
  & ICreateCanvasEditDocument <UserType>
  & DocumentViewMethods<
    ICreateCanvasEdit <UserType>, ICreateCanvasEditPublicView, ICreateCanvasEditAttribView
  >
  & Document <Types.ObjectId>
;

export type CreateCanvasEditModelType = Model<
  ICreateCanvasEditDocument <Types.ObjectId>, {}, {}, IEditVirtual
>;

export interface IDeleteCanvasEditModel <UserType> extends IEditModel <UserType> {
  kind: 'delete_canvas';
  canvas: ICanvasDocument <UserType>;
}

export type IDeleteCanvasEditDocument <UserType> = ViewDocument<IDeleteCanvasEditModel <UserType>>;

type DeleteCanvasEditProtectedFields = "";

export type IDeleteCanvasEditPublicView = Omit<
  IDeleteCanvasEditDocument <IUserPublicView>, DeleteCanvasEditProtectedFields
>;

export type IDeleteCanvasEditAttribView = Omit<
  IDeleteCanvasEditDocument <IUserAttribView>, DeleteCanvasEditProtectedFields
>;

export type IDeleteCanvasEdit <UserType> =
  & IDeleteCanvasEditDocument <UserType>
  & DocumentViewMethods<
    IDeleteCanvasEdit <UserType>, IDeleteCanvasEditPublicView, IDeleteCanvasEditAttribView
  >
  & Document <Types.ObjectId>
;

export type DeleteCanvasEditModelType = Model<
  IDeleteCanvasEditDocument <Types.ObjectId>, {}, {}, IEditVirtual
>;

export interface IMergeCanvasEditModel <UserType> extends IEditModel <UserType> {
  kind: 'merge_canvas';
  childCanvas: ICanvasDocument <UserType>;
}

export type IMergeCanvasEditDocument <UserType> = ViewDocument<IMergeCanvasEditModel <UserType>>;

type MergeCanvasEditProtectedFields = "";

export type IMergeCanvasEditPublicView = Omit<
  IMergeCanvasEditDocument <IUserPublicView>, MergeCanvasEditProtectedFields
>;

export type IMergeCanvasEditAttribView = Omit<
  IMergeCanvasEditDocument <IUserAttribView>, MergeCanvasEditProtectedFields
>;

export type IMergeCanvasEdit <UserType> =
  & IMergeCanvasEditDocument <UserType>
  & DocumentViewMethods<
    IMergeCanvasEdit <UserType>, IMergeCanvasEditPublicView, IMergeCanvasEditAttribView
  >
  & Document <Types.ObjectId>
;

export type MergeCanvasEditModelType = Model<
  IMergeCanvasEditDocument <Types.ObjectId>, {}, {}, IEditVirtual
>;

const editSchema = new Schema<
  IEdit <Types.ObjectId>, EditModelType <Types.ObjectId>, {}, {}, IEditVirtual
>(
  // -- Fields
  {
    kind: {
      type: String,
      enum: [
        'create_shapes',
        'update_shapes',
        'delete_shapes',
        'create_canvas',
        'delete_canvas',
        'merge_canvas',
      ],
      required: true
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    whiteboard: {
      type: Schema.Types.ObjectId,
      ref: 'Whiteboard',
      required: true,
    },
    committedAt: {
      type: Schema.Types.Date,
      required: true,
    },
  },
  // -- Options
  {
    discriminatorKey: 'kind',
    // -- not all shape data defined in schema
    strict: false,
    minimize: false,
    toObject: {
      virtuals: true,
    },
    toJSON: {
      virtuals: true,
    },
  },
);// -- end editSchema

// === Enumerated Edit Types ===================================================
//
// =============================================================================
editSchema.discriminator(
  'create_shapes', new Schema<ICreateShapesEdit <Types.ObjectId>,
  CreateShapesEditModelType, {}, {}, IEditVirtual> (
    // -- fields
    {
      shapes: {
        type: [shapeSchema],
        required: true,
      },
    },
    // -- options
    {
      // -- API currently doesn't provide access to edit history; this is left
      // to the web socket server
    },
  )
);// -- end create_shapes

editSchema.discriminator(
  'update_shapes', new Schema<IUpdateShapesEdit <Types.ObjectId>,
  UpdateShapesEditModelType, {}, {}, IEditVirtual> (
    // -- fields
    {
      updates: {
        type: [new Schema<ShapeUpdate>({
          shapeId: {
            type: Schema.Types.ObjectId,
            required: true,
          },
          oldFields: {
            type: Schema.Types.Map,
            required: true,
          },
          newFields: {
            type: Schema.Types.Map,
            required: true,
          },
        })],
        required: true,
      },
    },
    // -- options
    {
      // -- API currently doesn't provide access to edit history; this is left
      // to the web socket server
    },
  )
);// -- end update_shapes

editSchema.discriminator(
  'delete_shapes', new Schema<IDeleteShapesEdit <Types.ObjectId>,
  DeleteShapesEditModelType, {}, {}, IEditVirtual> (
    // -- fields
    {
      shapes: {
        type: [shapeSchema],
        required: true,
      },
    },
    // -- options
    {
      // -- API currently doesn't provide access to edit history; this is left
      // to the web socket server
    },
  )
);// -- end delete_shapes

editSchema.discriminator(
  'create_canvas', new Schema<ICreateCanvasEdit <Types.ObjectId>,
  CreateCanvasEditModelType, {}, {}, IEditVirtual> (
    // -- fields
    {
      canvas: {
        type: canvasSchema,
        required: true,
      },
    },
    // -- options
    {
      // -- API currently doesn't provide access to edit history; this is left
      // to the web socket server
    },
  )
);// -- end create_canvas

editSchema.discriminator(
  'delete_canvas', new Schema<IDeleteCanvasEdit <Types.ObjectId>,
  DeleteCanvasEditModelType, {}, {}, IEditVirtual> (
    // -- fields
    {
      canvas: {
        type: canvasSchema,
        required: true,
      },
    },
    // -- options
    {
      // -- API currently doesn't provide access to edit history; this is left
      // to the web socket server
    },
  )
);// -- end delete_canvas

editSchema.discriminator(
  'merge_canvas', new Schema<IMergeCanvasEdit <Types.ObjectId>,
  MergeCanvasEditModelType, {}, {}, IEditVirtual> (
    // -- fields
    {
      childCanvas: {
        type: canvasSchema,
        required: true,
      },
    },
    // -- options
    {
      // -- API currently doesn't provide access to edit history; this is left
      // to the web socket server
    },
  )
);// -- end merge_canvas
