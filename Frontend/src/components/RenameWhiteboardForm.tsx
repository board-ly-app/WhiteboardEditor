// -- std imports
import {
  useState,
  useCallback,
} from 'react';

// -- local imports
import {
  type ButtonStatus,
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';
import { AppModal } from '@/components/ui/app-modal';
import ErrorTextNotification from './ui/error-text-notification';
import { MAX_TITLE_LENGTH } from '@/app.config';

const FORM_ID = 'rename-whiteboard-form';

export interface RenameWhiteboardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSubmit: (newName: string) => Promise<unknown>;
}

export const RenameWhiteboardForm = ({
  open,
  onOpenChange,
  currentName,
  onSubmit,
}: RenameWhiteboardFormProps): React.JSX.Element => {
  const [newName, setNewName] = useState<string>(currentName);
  const [renameButtonStatus, setRenameButtonStatus] = useState<ButtonStatus>('enabled');

  const handleNewNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();

      setNewName(e.currentTarget.value);
    },
    [setNewName]
  );// -- end handleNewNameChange

  const handleSubmit = useCallback(
    (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();

      setRenameButtonStatus('pending');

      onSubmit(newName)
        .finally(() => {
          setRenameButtonStatus('enabled');
        });
    },
    [onSubmit, newName, setRenameButtonStatus]
  );// -- end handleSubmit

  // -- derived state
  const trimmedName = newName.trim();
  const canSubmit = trimmedName.length > 0 && trimmedName !== currentName;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Rename "${currentName}"`}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            form={FORM_ID}
            type="submit"
            className='border bg-card-background text-white'
            disabled={!canSubmit}
            status={renameButtonStatus}
          >
            Rename
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col">
        <Input
          type="text"
          name="newName"
          placeholder="New whiteboard name"
          value={newName}
          onChange={handleNewNameChange}
          autoFocus
          maxLength={MAX_TITLE_LENGTH}
        />
        <ErrorTextNotification
          show={newName.length >= MAX_TITLE_LENGTH}
          message={`You've reached the maximum title length of ${MAX_TITLE_LENGTH} characters.`}
        />
      </form>
    </AppModal>
  );
};// -- end RenameWhiteboardForm
