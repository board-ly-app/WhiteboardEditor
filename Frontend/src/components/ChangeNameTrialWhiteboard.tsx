import { useState } from "react";
import { Button } from "./ui/button";
import { AppModal } from "./ui/app-modal";

const FORM_ID = 'change-name-trial-whiteboard-form';

export interface ChangeNameTrialWhiteboardProps {
  open: boolean;
  onConfirm: (name: string) => void;
  onSkip: () => void;
}

const ChangeNameTrialWhiteboard = ({
  open,
  onConfirm,
  onSkip,
}: ChangeNameTrialWhiteboardProps) => {
  const [localNameEntry, setLocalNameEntry] = useState<string>('');

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (localNameEntry.trim()) {
      onConfirm(localNameEntry.trim());
    }
  };

  return (
    <AppModal
      open={open}
      // -- dismissing the modal (backdrop / esc / close button) skips the rename
      onOpenChange={(nextOpen) => { if (! nextOpen) onSkip(); }}
      title="Change the name of your trial whiteboard?"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onSkip}>
            Skip for now
          </Button>
          <Button 
            form={FORM_ID} 
            type="submit"
            className="border bg-card-background"
            disabled={localNameEntry.trim().length <= 0}
          >
            Confirm
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleFormSubmit}>
        <input
          type="text"
          placeholder="Enter new name"
          value={localNameEntry}
          onChange={(e) => setLocalNameEntry(e.target.value)}
          className={"border p-2 w-full my-2 rounded-md"}
          autoFocus
          required
        />
      </form>
    </AppModal>
  );
}

export default ChangeNameTrialWhiteboard;
