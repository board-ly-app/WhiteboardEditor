// -- std imports
import {
  useState,
  useCallback,
} from 'react';

import {
  useSelector,
} from 'react-redux';

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

import {
  type RootState,
} from '@/store';

import {
  selectWhiteboardById,
} from '@/store/whiteboards/whiteboardsSelectors';

export interface DeleteWhiteboardFormProps {
  whiteboardId: WhiteboardIdType;
  onSubmit: () => Promise<unknown>;
  onCancel: () => unknown;
}

type ComponentStatus = 
  | { name: 'default'; }
  | { name: 'deletion_unconfirmed'; }
  | { name: 'deletion_confirmation_pending'; progress: number; }
  | { name: 'deletion_confirmed'; }
;

export const DeleteWhiteboardForm = ({
  whiteboardId,
  onSubmit,
  onCancel,
}: DeleteWhiteboardFormProps) => {
  // The confirmation key is a user input that confirms that the user really
  // intends to carry out the intended action
  const CONFIRMATION_KEY = 'Delete';
  const [confirmationKeyEntry, setConfirmationKeyEntry] = useState<string>('');
  const [deleteButtonStatus, setDeleteButtonStatus] = useState<ButtonStatus>('enabled');

  const whiteboardAttribs : WhiteboardAttribs | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)
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
    <div>
      <form
        onSubmit={handleSubmit}
      >
        <h1>If you want to delete "{whiteboardAttribs.name}", please type "{CONFIRMATION_KEY}" below.</h1>
        <div className="flex flex-row justify-center pt-2 gap-2">
          <input
            type="text"
            name="confirmationKeyEntry"
            placeholder={CONFIRMATION_KEY}
            value={confirmationKeyEntry}
            onChange={handleConfirmationKeyEntryChange}
            className={confirmationKeyEntryClassname}
          />
          <Button
            disabled={status.name !== 'deletion_confirmed'}
            status={deleteButtonStatus}
            type="submit"
            variant="destructive"
          >
            Delete
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </div>
  );
};// -- end DeleteWhiteboardForm
