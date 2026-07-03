// -- std imports
import {
  useState,
  useCallback,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

// -- local imports
import {
  type WhiteboardIdType,
  type WhiteboardAttribs,
} from '@/types/WebSocketProtocol';

import {
  cn,
} from "@/lib/utils"

import {
  type ButtonStatus,
  Button,
} from '@/components/ui/button';

import { AppModal } from '@/components/ui/app-modal';

import {
  type RootState,
} from '@/store';

import {
  selectWhiteboardById,
} from '@/store/whiteboards/whiteboardsSelectors';

const FORM_ID = 'delete-whiteboard-form';

export interface DeleteWhiteboardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whiteboardId: WhiteboardIdType;
  onSubmit: () => Promise<unknown>;
}

type ComponentStatus =
  | { name: 'default'; }
  | { name: 'deletion_unconfirmed'; }
  | { name: 'deletion_confirmation_pending'; progress: number; }
  | { name: 'deletion_confirmed'; }
;

export const DeleteWhiteboardForm = ({
  open,
  onOpenChange,
  whiteboardId,
  onSubmit,
}: DeleteWhiteboardFormProps) => {
  // The confirmation key is a user input that confirms that the user really
  // intends to carry out the intended action
  const CONFIRMATION_KEY = 'Delete';
  const [confirmationKeyEntry, setConfirmationKeyEntry] = useState<string>('');
  const [deleteButtonStatus, setDeleteButtonStatus] = useState<ButtonStatus>('enabled');

  const whiteboardAttribs : WhiteboardAttribs | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId),
    lodash.isEqual
  );

  const handleConfirmationKeyEntryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();

      setConfirmationKeyEntry(e.currentTarget.value);
    },
    [setConfirmationKeyEntry]
  );// -- end handleConfirmationKeyEntryChange

  const handleSubmit = useCallback((ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();

      setDeleteButtonStatus('pending');

      onSubmit()
        .finally(() => {
          setDeleteButtonStatus('enabled');
        });
    },
    [onSubmit, setDeleteButtonStatus]
  );// -- end handleSubmit

  // -- derived state
  let status : ComponentStatus;

  if (confirmationKeyEntry === '') {
    status = { name: 'default' };
  } else if (confirmationKeyEntry === CONFIRMATION_KEY) {
    status = { name: 'deletion_confirmed' };
  } else if (CONFIRMATION_KEY.substring(0, confirmationKeyEntry.length) === confirmationKeyEntry) {
    const progress = confirmationKeyEntry.length / CONFIRMATION_KEY.length;

    status = { name: 'deletion_confirmation_pending', progress };
  } else {
    status = { name: 'deletion_unconfirmed' };
  }

  const confirmationKeyEntryClassnameBase = "placeholder:italic outline-2 rounded-sm p-1";
  let confirmationKeyEntryClassname : string;

  if (! whiteboardAttribs) {
    return null;
  }

  switch (status.name) {
    case 'default':
    {
        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
        );
    }
    break;
    case 'deletion_confirmed':
    {
        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
          "outline-green-600",
        );
    }
    break;
    case 'deletion_confirmation_pending':
    {
        const {
          progress,
        } = status;
        const colorStart = 100;
        const colorLimit = 600;
        const colorStep = 100;
        const colorScale = (colorLimit - colorStart);
        const colorLevel = (Math.floor(
          (progress * colorScale) / colorStep
        ) * colorStep) + colorStart;

        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
          `outline-green-${colorLevel}`,
        );
    }
    break;
    case 'deletion_unconfirmed':
    {
        confirmationKeyEntryClassname = cn(
          confirmationKeyEntryClassnameBase,
          "outline-red-600"
        );
    }
    break;
    default:
      throw new Error(`Unrecognized status "${status}"`);
  }// -- end status.name

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete "${whiteboardAttribs.name}"?`}
      footer={
        <>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            form={FORM_ID}
            disabled={status.name !== 'deletion_confirmed'}
            status={deleteButtonStatus}
            type="submit"
            variant="destructive"
          >
            Delete
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <p>
          This action cannot be undone. Please type "{CONFIRMATION_KEY}" below to
          confirm.
        </p>
        <input
          type="text"
          name="confirmationKeyEntry"
          placeholder={CONFIRMATION_KEY}
          value={confirmationKeyEntry}
          onChange={handleConfirmationKeyEntryChange}
          className={confirmationKeyEntryClassname}
        />
      </form>
    </AppModal>
  );
};// -- end DeleteWhiteboardForm
