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

export interface RenameWhiteboardFormProps {
  currentName: string;
  onSubmit: (newName: string) => Promise<unknown>;
  onCancel: () => unknown;
}

export const RenameWhiteboardForm = ({
  currentName,
  onSubmit,
  onCancel,
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
    <div>
      <form onSubmit={handleSubmit}>
        <h1 className="text-lg font-semibold">Rename "{currentName}"</h1>
        <div className="flex flex-row justify-center pt-2 gap-2">
          <Input
            type="text"
            name="newName"
            placeholder="New whiteboard name"
            value={newName}
            onChange={handleNewNameChange}
            autoFocus
          />
          <Button
            disabled={!canSubmit}
            status={renameButtonStatus}
            type="submit"
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};// -- end RenameWhiteboardForm
