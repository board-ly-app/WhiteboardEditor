import { useState } from 'react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppModal } from "@/components/ui/app-modal";
import AllowedUsersPopover from '@/components/AllowedUsersPopover';

interface CreateCanvasMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (canvas: NewCanvas) => void;
}

// Add more fields later (height, width, etc.)
export interface  NewCanvas {
  canvasName: string;
  allowedUsers: string[];
}

function CreateCanvasMenu({
  open,
  onOpenChange,
  onCreate,
}: CreateCanvasMenuProps) {
  const [canvasName, setCanvasName] = useState("");
  const [newCanvasAllowedUsers, setNewCanvasAllowedUsers] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!canvasName.trim()) {
      alert("Canvas name cannot be empty");
      return;
    }

    onCreate({
      canvasName,
      allowedUsers: newCanvasAllowedUsers,
    });

    setCanvasName("");
    setNewCanvasAllowedUsers([]);
    onOpenChange(false);
  }

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Create New Canvas"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Canvas Name</Label>
        <Input
          id="name"
          value={canvasName}
          onChange={(e) => setCanvasName(e.target.value)}
          placeholder="Enter name"
        />

        <Label htmlFor="users">Allowed Users</Label>

        <AllowedUsersPopover
          selected={newCanvasAllowedUsers}
          onChange={setNewCanvasAllowedUsers}
        />
      </div>
    </AppModal>
  );
}

export default CreateCanvasMenu;
