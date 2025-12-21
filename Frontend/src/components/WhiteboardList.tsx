// === WhiteboardList.tsx ======================================================
//
// Displays a list of whiteboards in whiteboard cards.
//
// Assumes the calling function is fetching the whiteboards using react-query or
// a similar service. For this reason, the component assumes a status of
// 'loading', 'ready', or 'error', which indicates whether the component should
// render the passed-in whiteboards, a loading message, or an error message.
//
// NOTE: Error messages will be displayed to user; ensure error messages don't
// contain any sensitive server-side information. The API call from which the
// messages are derived should not expose any such information to the client.
//
// =============================================================================

import {
  LoaderCircle,
} from 'lucide-react';

// -- local imports
import type {
  Whiteboard
} from '@/types/APIProtocol';

import WhiteboardCard from '@/components/WhiteboardCard';

export type WhiteboardListProps = 
  // NOTE: message will be displayed to user; ensure it doesn't contain any
  // sensitive server-side information. The API call from which this message is
  // derived should not expose any such information to the client.
  | { status: 'error';  message: string; }
  | { status: 'loading'; }
  | { status: 'ready'; whiteboardsAttribs: Whiteboard[]; }
;

const WhiteboardList = (props: WhiteboardListProps): React.JSX.Element => {
  switch (props.status) {
    case 'error':
    {
        const {
          message
        } = props;

        console.log('Error fetching whiteboards for WhiteboardList:', message);

        return (
          <div>
            <p className="text-lg text-h3-text font-bold text-center m-12">
              Error: {message}
            </p>
          </div>
        );
    }
    case 'loading':
    {
        return (
          <div>
            <p className="text-lg text-h3-text font-bold justify-center m-12 flex space-x-2">
              <LoaderCircle className='animate-spin'/> 
              <span>Loading...</span>
            </p>
          </div>
        );
    }
    case 'ready':
    {
        const {
          whiteboardsAttribs
        } = props;

        if (whiteboardsAttribs.length < 1) {
          return (
            <p className="pb-10 text-center text-lg font-bold font-arial text-h3-text italic">
              No whiteboards to display
            </p>
          );
        } else {
          return (
            <ul
              className="flex flex-col md:flex-row justify-center flex-wrap content-center"
            >
            {
              whiteboardsAttribs
                .map(attribs => (
                  <li
                    key={attribs.id}
                  >
                    <WhiteboardCard
                      {...attribs}
                      user_permissions={attribs.user_permissions.filter(up =>
                        up != null &&
                        ("user" in up ? up.user !== null : up.email !== null)
                      )}
                    />
                  </li>
              ))
            }
            </ul>
          );
        }
    }
    default:
    {
        console.error('Received unrecognized props for WhiteboardList:', props);

        return (
          <div>
            <p className="text-lg font-bold text-red">
              Error: invalid WhiteboardList props
            </p>
          </div>
        );
    }
  }
};// end WhiteboardList

export default WhiteboardList;
