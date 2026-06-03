// === ActionRequestForm.tsx ===================================================
//
// Generalized form for presenting users with an action request, which they may
// choose to fulfill using one or more handlers, implemented as callback
// functions attached to buttons.
//
// =============================================================================

// -- local imports
import {
  Button,
} from '@/components/ui/button';

export interface ActionHandler {
  label: string;
  callback: () => unknown;
}// -- end interface ActionHandler

export interface ActionRequestFormProps {
  summary: string;
  handlers: ActionHandler[];
}// -- end interface ActionRequestFormProps

export const ActionRequestForm = ({
  summary,
  handlers,
}: ActionRequestFormProps): React.JSX.Element => {
  return (
    <div>
      <p>{summary}</p>

      <div className="flex flex-row justify-center">
        {handlers.map(handler => (
          <Button
            variant="default"
            size="default"
            onClick={handler.callback}
          >
            {handler.label}
          </Button>
        ))}
      </div>
    </div>
  );
};// -- end ActionRequestForm
