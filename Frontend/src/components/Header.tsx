import {
  Children,
} from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import {
  ChevronDown,
  TextAlignJustify,
} from "lucide-react";

// === Header ==================================================================
//
// Framework for displaying a floating header at the top of a page. Allows
// setting the title and adding buttons and other elements to toolbars on the
// left and right sides.
//
// =============================================================================

export interface HeaderProps {
  title: string;
  zIndex?: number;
  // Buttons and other elements to display on left side of header
  toolbarElemsLeft?: React.ReactNode[];
  // Buttons and other elements to display on right side of header
  toolbarElemsRight?: React.ReactNode[];
  noMarginTop?: boolean;
}

const Header = ({
  title,
  zIndex = 50,
  toolbarElemsLeft = [],
  toolbarElemsRight = [],
  noMarginTop,
}: HeaderProps): React.JSX.Element => {
  return (
    <>
      {/** Floating header **/}
      <div
        className="fixed top-1 left-0 right-0 max-h-15 backdrop-blur-md shadow-2xl rounded-lg border-border border-1 mx-5 lg:mx-30 m-1 px-3 py-2 bg-bar-background/80 toolbar-scale"
        style={{ zIndex }}
      > 
        <div className="grid grid-flow-col grid-cols-3"> 

          {/**
            Hamburger Menu, which stands in for both toolbars on small screens.

            Built on a popover rather than a navigation menu: a navigation menu
            opens on hover, whereas this should open on click like the other
            header menus. A dropdown menu is not suitable either, since several
            toolbar elements (notifications, active users, the profile menu)
            carry dropdowns of their own, which cannot be nested inside the
            items of another dropdown.
          **/}
          <Popover>
            <PopoverTrigger
              aria-label="Open menu"
              className="group flex md:hidden items-center gap-1 rounded-lg p-1 text-header-button-text hover:cursor-pointer hover:text-header-button-text-hover"
            >
              <TextAlignJustify />
              <ChevronDown className="w-4 h-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
            </PopoverTrigger>

            <PopoverContent
              align="start"
              className="flex w-auto min-w-40 max-w-[80vw] flex-col items-center gap-3 bg-dropdown-background"
            >
              {/**
                Empty toolbar slots are dropped rather than rendered, so that
                they do not occupy a row and leave the spacing between the
                remaining entries uneven.
              **/}
              {Children.toArray([...toolbarElemsLeft, ...toolbarElemsRight])}
            </PopoverContent>
          </Popover>

          {/* Left Side Items */}
          <div className="col-span-1 text-h2-text mx-4 gap-4 hidden md:flex items-center">
            {toolbarElemsLeft}
          </div>

          {/* Title */}
          <h1 className="col-span-1 md:flex-1 min-w-0 text-lg md:text-2xl text-header-title-text font-bold truncate text-center">
            {title}
          </h1>
          
          {/* Right Side Items */}
          <div className="col-span-1 text-h2-text mx-4 gap-4 hidden md:flex items-center justify-end">
            {toolbarElemsRight}
          </div>
        </div>
      </div>
      {/** Dummy static element to ensure header doesn't overlap top of page **/}
      {(!noMarginTop &&
        <div className="h-25">
        </div>
      )}
    </>
  );
};

export default Header;
